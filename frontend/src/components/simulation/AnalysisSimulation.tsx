import { useState, useCallback, useEffect, useRef } from 'react';
import api from '../../services/api';

interface AnalysisSimulationProps {
  sessionId: string;
  task: any;
  jobRole: string;
  onSubmit: (result: { score: number; feedback: string; strengths: string[]; weaknesses: string[] }) => void;
  onEvent: (type: string, data?: any) => void;
}

// Map task field keys to human-readable labels
const CONTEXT_LABELS: Record<string, string> = {
  modelResults:       '📊 Model Results',
  datasetSummary:     '📋 Dataset Summary',
  testResults:        '🧪 Test Results',
  infrastructure:     '🏗️ Infrastructure Config',
  logs:               '📜 Security Logs',
  pipelineConfig:     '⚙️ Pipeline Configuration',
  observabilityData:  '📡 Observability Data',
  vulnerableCode:     '🔍 Code to Review',
  brokenCode:         '🐛 Broken Code',
  currentArchitecture:'☁️ Current Architecture',
};

export default function AnalysisSimulation({ sessionId, task, onSubmit, onEvent }: AnalysisSimulationProps) {
  const [answers,      setAnswers]      = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set(['scenario']));
  const firstTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus first textarea on mount so typing works immediately
  useEffect(() => {
    const t = setTimeout(() => firstTextareaRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const questions: string[] = task.questions || [];
  const totalWords = Object.values(answers).join(' ').trim().split(/\s+/).filter(Boolean).length;
  const allAnswered = questions.every((_, i) => (answers[i] || '').trim().split(/\s+/).filter(Boolean).length >= 20);

  const toggle = (key: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  const handleAnswerChange = useCallback((idx: number, value: string) => {
    setAnswers(prev => ({ ...prev, [idx]: value }));
    onEvent('answer_change', { taskId: task.id, questionIndex: idx });
  }, [task.id, onEvent]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting || submitted) return;
    setIsSubmitting(true);
    const combined = questions.map((q, i) => `Q${i + 1}: ${q}\nA: ${answers[i] || '(No answer)'}`).join('\n\n');
    try {
      const res = await api.post(`/api/simulation/${sessionId}/submit`, {
        taskId: task.id, content: combined, language: 'text',
      });
      const data = res.data.data;
      setSubmitted(true);
      onSubmit({ score: data.score, feedback: data.feedback, strengths: data.strengths || [], weaknesses: data.weaknesses || [] });
    } catch (err: any) {
      console.error('Submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [answers, isSubmitting, submitted, sessionId, task.id, questions, onSubmit]);

  const difficultyColor =
    task.difficulty === 'easy' ? '#10b981' :
    task.difficulty === 'medium' ? '#f59e0b' : '#ef4444';

  // Find context data fields
  const contextFields = Object.keys(CONTEXT_LABELS).filter(k => task[k]);

  return (
    <div className="sim-analysis-container">
      {/* Task header */}
      <div className="sim-task-header">
        <h3>{task.title}</h3>
        <span className="sim-difficulty-badge" style={{ background: difficultyColor }}>{task.difficulty}</span>
      </div>

      {/* Scenario */}
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

      {/* Context data blocks */}
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
              isCode ? (
                <pre className="sim-code-block">{typeof data === 'string' ? data : JSON.stringify(data, null, 2)}</pre>
              ) : (
                <pre className="sim-json-block">{JSON.stringify(data, null, 2)}</pre>
              )
            )}
          </div>
        );
      })}

      {/* Evaluation criteria */}
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

      {/* Questions */}
      <div className="sim-questions-section">
        <h4>Your Analysis &nbsp;·&nbsp; {totalWords} words total</h4>
        {questions.map((q, i) => {
          const wc = (answers[i] || '').trim().split(/\s+/).filter(Boolean).length;
          return (
            <div key={i} className="sim-question-block">
              <label className="sim-question-label">
                <span className="sim-q-num">Q{i + 1}</span>
                {q}
              </label>
              <textarea
                ref={i === 0 ? firstTextareaRef : undefined}
                className="sim-answer-textarea"
                value={answers[i] || ''}
                onChange={e => handleAnswerChange(i, e.target.value)}
                placeholder="Type your detailed answer here..."
                rows={5}
                disabled={submitted}
              />
              <div className="sim-word-count" style={{ color: wc >= 20 ? '#10b981' : '#475569' }}>
                {wc} words {wc < 20 ? `(${20 - wc} more needed)` : '✓'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Submit row */}
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
    </div>
  );
}
