import { useState, useCallback, useEffect, useRef } from 'react';
import api from '../../services/api';

interface AnalysisSimulationProps {
  sessionId: string;
  task: any;
  jobRole: string;
  isSpeaking?: boolean; // true when AI TTS is active — stops mic to prevent feedback loop
  onSubmit: (result: { score: number; feedback: string; strengths: string[]; weaknesses: string[] }) => void;
  onScoreUpdate?: (score: number) => void; // called when Gemini finalizes the score
  onEvent: (type: string, data?: any) => void;
}

const CONTEXT_LABELS: Record<string, string> = {
  modelResults:        '📊 Model Results',
  datasetSummary:      '📋 Dataset Summary',
  testResults:         '🧪 Test Results',
  infrastructure:      '🏗️ Infrastructure Config',
  logs:                '📜 Security Logs',
  pipelineConfig:      '⚙️ Pipeline Configuration',
  observabilityData:   '📡 Observability Data',
  vulnerableCode:      '🔍 Code to Review',
  brokenCode:          '🐛 Broken Code',
  currentArchitecture: '☁️ Current Architecture',
};

interface AiFeedback {
  score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  improvements?: string[];
}

function FeedbackPanel({ feedback }: { feedback: AiFeedback }) {
  const { score } = feedback;
  const scoreColor = score >= 70 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const grade = score >= 80 ? 'Excellent' : score >= 65 ? 'Good' : score >= 50 ? 'Fair' : 'Needs Work';
  return (
    <div style={{
      marginTop: 24, background: '#0d1424', border: '1px solid #1e293b',
      borderRadius: 12, padding: '20px 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          border: `3px solid ${scoreColor}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 10, color: '#64748b' }}>/100</span>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>🤖 Gemini AI Evaluation</div>
          <div style={{ fontSize: 13, color: scoreColor, fontWeight: 600 }}>{grade}</div>
        </div>
      </div>

      <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.7, marginBottom: 16 }}>{feedback.feedback}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: feedback.improvements?.length ? 12 : 0 }}>
        {feedback.strengths.length > 0 && (
          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>✅ Strengths</div>
            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {feedback.strengths.map((s, i) => <li key={i} style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>{s}</li>)}
            </ul>
          </div>
        )}
        {feedback.weaknesses.length > 0 && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>⚠️ Areas to Improve</div>
            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {feedback.weaknesses.map((w, i) => <li key={i} style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>{w}</li>)}
            </ul>
          </div>
        )}
      </div>

      {feedback.improvements && feedback.improvements.length > 0 && (
        <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>💡 Suggestions</div>
          <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {feedback.improvements.map((imp, i) => <li key={i} style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>{imp}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function AnalysisSimulation({ sessionId, task, jobRole, isSpeaking, onSubmit, onScoreUpdate, onEvent }: AnalysisSimulationProps) {
  const [answers,      setAnswers]      = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set(['scenario']));
  const [aiFeedback,   setAiFeedback]   = useState<AiFeedback | null>(null);
  const [aiLoading,    setAiLoading]    = useState(false);
  // Voice state: tracks which question index is currently listening
  const [listeningIdx, setListeningIdx] = useState<number | null>(null);
  const recognitionRef = useRef<any>(null);
  const firstTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => firstTextareaRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  // Stop recognition on unmount
  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  // Stop voice recognition when AI TTS is speaking to prevent feedback loop
  useEffect(() => {
    if (isSpeaking && listeningIdx !== null) {
      recognitionRef.current?.stop();
      setListeningIdx(null);
    }
  }, [isSpeaking, listeningIdx]);

  const questions: string[] = task.questions || [];
  const totalWords = Object.values(answers).join(' ').trim().split(/\s+/).filter(Boolean).length;
  const allAnswered = questions.every((_, i) => (answers[i] || '').trim().split(/\s+/).filter(Boolean).length >= 20);

  const toggle = (key: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  const handleAnswerChange = useCallback((idx: number, value: string) => {
    setAnswers(prev => ({ ...prev, [idx]: value }));
    onEvent('answer_change', { taskId: task.id, questionIndex: idx });
  }, [task.id, onEvent]);

  // ── Voice input per question ──────────────────────────────────────────────
  const toggleVoice = useCallback((idx: number) => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    // Stop if already listening for this question
    if (listeningIdx === idx) {
      recognitionRef.current?.stop();
      setListeningIdx(null);
      return;
    }

    // Stop any existing recognition
    recognitionRef.current?.stop();

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    const committed = { text: answers[idx] || '' };

    rec.onresult = (e: any) => {
      let interim = '';
      let newFinal = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) newFinal += t;
        else interim += t;
      }
      if (newFinal) {
        const sep = committed.text && !committed.text.endsWith(' ') ? ' ' : '';
        committed.text = (committed.text + sep + newFinal).trim();
      }
      const display = interim
        ? (committed.text ? committed.text + ' ' + interim : interim)
        : committed.text;
      setAnswers(prev => ({ ...prev, [idx]: display }));
    };

    rec.onend = () => {
      setListeningIdx(null);
      // Commit final text
      setAnswers(prev => ({ ...prev, [idx]: committed.text }));
    };

    rec.onerror = (e: any) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        setListeningIdx(null);
      }
    };

    rec.start();
    recognitionRef.current = rec;
    setListeningIdx(idx);
  }, [listeningIdx, answers]);

  // ── Gemini inline evaluation ──────────────────────────────────────────────
  const fetchGeminiEvaluation = useCallback(async (combinedAnswers: string, immediateScore: number) => {
    setAiLoading(true);

    // ── Detect TTS contamination ──────────────────────────────────────────
    // If the answers contain phrases from the AI's own TTS output, the mic
    // captured the speaker audio. Detect and reject contaminated answers.
    const ttsMarkers = [
      'you scored', 'out of 100', 'generating your simulation',
      'you have completed all tasks', 'generating your report',
      'thank you for attending', 'we have come to the end',
    ];
    const lowerAnswers = combinedAnswers.toLowerCase();
    const isContaminated = ttsMarkers.some(marker => lowerAnswers.includes(marker));

    if (isContaminated) {
      console.warn('⚠️ TTS contamination detected in answers — mic captured AI speech. Skipping Gemini evaluation.');
      setAiFeedback({
        score: 0,
        feedback: 'It appears the microphone captured the AI interviewer\'s voice instead of your answer. Please type your responses or ensure your microphone is not picking up the speaker audio.',
        strengths: [],
        weaknesses: ['Voice input captured AI speech instead of candidate response'],
        improvements: ['Use headphones to prevent audio feedback', 'Type your answers directly in the text field'],
      });
      setAiLoading(false);
      return;
    }

    // Compute a content-based floor score so fallback is never 0 for real answers
    const wordCount = combinedAnswers.trim().split(/\s+/).filter(Boolean).length;
    const contentFloor = wordCount < 10 ? 10 : wordCount < 30 ? 30 : wordCount < 60 ? 45 : wordCount < 100 ? 55 : 60;
    const fallbackScore = Math.max(immediateScore, contentFloor);

    const fallback: AiFeedback = {
      score: fallbackScore,
      feedback: `Your analysis of "${task.title}" scored ${fallbackScore}/100. ${fallbackScore >= 70 ? 'Good understanding demonstrated.' : 'Review the evaluation criteria for improvement areas.'}`,
      strengths: fallbackScore >= 60 ? ['Demonstrated understanding of the topic', 'Provided structured responses'] : ['Attempted all questions'],
      weaknesses: fallbackScore < 60 ? ['Responses could be more detailed', 'Consider addressing all evaluation criteria explicitly'] : [],
      improvements: ['Add concrete examples to support your answers', 'Reference specific data points from the scenario'],
    };

    try {
      const prompt = `You are a senior ${jobRole} interviewer evaluating a simulation interview submission. Your job is to score the candidate FAIRLY and ACCURATELY.

## Task: ${task.title}
## Difficulty: ${task.difficulty || 'medium'}
## Scenario: ${task.scenario || task.description || ''}
## Evaluation Criteria: ${(task.evaluationCriteria || []).join('; ')}

## Candidate's Answers:
${combinedAnswers}

## CRITICAL SCORING RULES — READ CAREFULLY:
1. A score of 0 is ONLY for completely blank, gibberish, or totally off-topic answers. If the candidate wrote anything relevant, the minimum score is 15.
2. Partial credit is MANDATORY. If the candidate addresses even one evaluation criterion correctly, they earn at least 25 points.
3. Score based on: technical accuracy (40%), relevance to the scenario (25%), completeness (20%), reasoning quality (15%).
4. Do NOT penalize for writing style or grammar — only penalize for technical incorrectness or missing key concepts.

## Score Bands:
- 80-100: Technically correct, specific, demonstrates deep understanding, addresses all criteria
- 60-79: Mostly correct, minor gaps, addresses most criteria
- 40-59: Partial understanding, addresses some criteria, misses key concepts
- 20-39: Vague or mostly incorrect, addresses few criteria
- 1-19: Barely relevant, almost no correct content
- 0: Completely blank, pure gibberish, or zero relevance to the task

Evaluate with FAANG-level rigor. Be specific — reference the candidate's actual words in your feedback.

Respond ONLY with valid JSON (no markdown, no extra text):
{
  "score": <integer 0-100>,
  "feedback": "<3-4 sentence overall assessment referencing specific aspects of their answers>",
  "strengths": ["<specific strength from their actual answer>", "<another specific strength>"],
  "weaknesses": ["<specific gap or error in their answer>", "<another weakness>"],
  "improvements": ["<concrete actionable improvement>", "<another improvement>"]
}`;

      const res = await api.post('/api/gemini/generate-raw', { prompt }, { timeout: 30000 });
      const raw: string = res.data?.data?.text || res.data?.text || '';
      const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed && typeof parsed.score === 'number') {
          // Enforce content floor — never show 0 for a non-empty, non-contaminated answer
          const finalScore = wordCount >= 10
            ? Math.max(contentFloor, Math.min(100, Math.round(parsed.score)))
            : Math.min(100, Math.max(0, Math.round(parsed.score)));
          const result: AiFeedback = {
            score: finalScore,
            feedback: parsed.feedback || fallback.feedback,
            strengths: Array.isArray(parsed.strengths) && parsed.strengths.length > 0 ? parsed.strengths : fallback.strengths,
            weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : fallback.weaknesses,
            improvements: Array.isArray(parsed.improvements) ? parsed.improvements : fallback.improvements,
          };
          setAiFeedback(result);
          // Update the sidebar score with the real Gemini score
          onScoreUpdate?.(result.score);
          return;
        }
      }
    } catch (err) {
      console.warn('Gemini inline evaluation failed, using fallback:', err);
    } finally {
      setAiLoading(false);
    }
    setAiFeedback(fallback);
    // Update sidebar with fallback score (still better than the raw immediate score)
    onScoreUpdate?.(fallback.score);
  }, [jobRole, task, onScoreUpdate]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting || submitted) return;
    setIsSubmitting(true);
    const combined = questions.map((q, i) => `Q${i + 1}: ${q}\nA: ${answers[i] || '(No answer)'}`).join('\n\n');
    try {
      const res = await api.post(`/api/simulation/${sessionId}/submit`, {
        taskId: task.id, content: combined, language: 'text',
      }, { timeout: 15000 });
      const data = res.data.data;
      const score: number = data.score || 50;
      setSubmitted(true);
      onSubmit({ score, feedback: data.feedback, strengths: data.strengths || [], weaknesses: data.weaknesses || [] });
      // Trigger Gemini inline evaluation — non-blocking
      fetchGeminiEvaluation(combined, score);
    } catch (err: any) {
      console.error('Submit error:', err);
      // Fallback: compute score from word count and show feedback anyway
      const fallbackScore = Math.round(
        (questions.filter((_, i) => (answers[i] || '').trim().split(/\s+/).filter(Boolean).length >= 30).length / Math.max(questions.length, 1)) * 70
      );
      setSubmitted(true);
      onSubmit({ score: fallbackScore, feedback: 'Analysis submitted.', strengths: [], weaknesses: [] });
      fetchGeminiEvaluation(combined, fallbackScore);
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, isSubmitting, submitted, sessionId, task.id, questions, onSubmit, fetchGeminiEvaluation]);

  const difficultyColor =
    task.difficulty === 'easy' ? '#10b981' :
    task.difficulty === 'medium' ? '#f59e0b' : '#ef4444';

  const contextFields = Object.keys(CONTEXT_LABELS).filter(k => task[k]);

  return (
    <div className="sim-analysis-container">
      <div className="sim-task-header">
        <h3>{task.title}</h3>
        <span className="sim-difficulty-badge" style={{ background: difficultyColor }}>{task.difficulty}</span>
      </div>

      <div className="sim-context-block">
        <button className="sim-section-toggle" onClick={() => toggle('scenario')}>
          {expanded.has('scenario') ? '▼' : '▶'} 📋 Scenario
        </button>
        {expanded.has('scenario') && (
          <div className="sim-scenario-text">
            <p>{task.scenario || task.description}</p>
          </div>
        )}
      </div>

      {contextFields.map(key => {
        const data = task[key];
        const isCode = ['vulnerableCode', 'brokenCode', 'pipelineConfig'].includes(key);
        const label = CONTEXT_LABELS[key] || key;
        return (
          <div key={key} className="sim-context-block">
            <button className="sim-section-toggle" onClick={() => toggle(key)}>
              {expanded.has(key) ? '▼' : '▶'} {label}
            </button>
            {expanded.has(key) && (
              isCode
                ? <pre className="sim-code-block">{typeof data === 'string' ? data : JSON.stringify(data, null, 2)}</pre>
                : <pre className="sim-json-block">{JSON.stringify(data, null, 2)}</pre>
            )}
          </div>
        );
      })}

      {task.evaluationCriteria && (
        <div className="sim-context-block">
          <button className="sim-section-toggle" onClick={() => toggle('criteria')}>
            {expanded.has('criteria') ? '▼' : '▶'} 🎯 What We're Looking For
          </button>
          {expanded.has('criteria') && (
            <ul className="sim-criteria-list">
              {task.evaluationCriteria.map((c: string, i: number) => <li key={i}>{c}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="sim-questions-section">
        <h4>Your Analysis &nbsp;·&nbsp; {totalWords} words total</h4>
        {questions.map((q, i) => {
          const wc = (answers[i] || '').trim().split(/\s+/).filter(Boolean).length;
          const isListeningHere = listeningIdx === i;
          const srSupported = !!(
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
          );
          return (
            <div key={i} className="sim-question-block">
              <label className="sim-question-label">
                <span className="sim-q-num">Q{i + 1}</span>
                {q}
              </label>
              <div style={{ position: 'relative' }}>
                <textarea
                  ref={i === 0 ? firstTextareaRef : undefined}
                  className="sim-answer-textarea"
                  value={answers[i] || ''}
                  onChange={e => handleAnswerChange(i, e.target.value)}
                  placeholder={isListeningHere ? '🎤 Listening... speak your answer' : 'Type your detailed answer here...'}
                  rows={5}
                  disabled={submitted}
                  style={{ paddingRight: srSupported ? 48 : undefined }}
                />
                {srSupported && !submitted && (
                  <button
                    type="button"
                    onClick={() => toggleVoice(i)}
                    title={isListeningHere ? 'Stop recording' : 'Speak your answer'}
                    style={{
                      position: 'absolute', right: 10, bottom: 10,
                      width: 34, height: 34, borderRadius: '50%',
                      border: isListeningHere ? '2px solid #ef4444' : '1px solid #334155',
                      background: isListeningHere ? 'rgba(239,68,68,0.15)' : '#1e293b',
                      color: isListeningHere ? '#ef4444' : '#94a3b8',
                      cursor: 'pointer', fontSize: 15,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    {isListeningHere ? '⏹' : '🎤'}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <div className="sim-word-count" style={{ color: wc >= 20 ? '#10b981' : '#475569' }}>
                  {wc} words {wc < 20 ? `(${20 - wc} more needed)` : '✓'}
                </div>
                {isListeningHere && (
                  <span style={{ fontSize: 12, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1s ease-in-out infinite' }} />
                    Recording...
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="sim-submit-row">
        {!allAnswered && !submitted && (
          <span className="sim-submit-hint">Answer all questions with at least 20 words each.</span>
        )}
        <button
          className="sim-btn sim-btn-submit"
          onClick={handleSubmit}
          disabled={isSubmitting || submitted || !allAnswered}
        >
          {isSubmitting ? '⏳ Evaluating...' : submitted ? '✅ Submitted' : '📤 Submit Analysis'}
        </button>
      </div>

      {/* ── Inline AI Feedback suppressed for Simulation mode ── */}
    </div>
  );
}
