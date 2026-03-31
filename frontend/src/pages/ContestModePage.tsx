import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useNavGuard } from '../hooks/useNavGuard';
import { useVoiceMode } from '../hooks/useVoiceMode';
import '../styles/ContestMode.css';

// ── Types ────────────────────────────────────────────────────────────────────

interface MCQ {
  text: string;
  options: { A: string; B: string; C: string; D: string };
  correct: 'A' | 'B' | 'C' | 'D';
  difficulty: 'easy' | 'medium' | 'hard';
  explanation: string;
}

interface InterviewQ { id: string; text: string; }
interface InterviewEval { score: number; feedback: string; }
type Phase = 'setup' | 'loading' | 'mcq' | 'interview' | 'results';

// ── Duration config ──────────────────────────────────────────────────────────

const DURATION_CONFIG: Record<number, { mcqCount: number; interviewCount: number }> = {
  5:  { mcqCount: 15, interviewCount: 1 },
  10: { mcqCount: 20, interviewCount: 2 },
  15: { mcqCount: 25, interviewCount: 3 },
  20: { mcqCount: 30, interviewCount: 4 },
};
const DURATIONS = [5, 10, 15, 20];
const OPTION_KEYS: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

function fmt(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ContestModePage() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('setup');
  const [role, setRole] = useState('');
  const [duration, setDuration] = useState<number>(10);
  const [setupError, setSetupError] = useState('');

  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [interviewQs, setInterviewQs] = useState<InterviewQ[]>([]);

  const [mcqIdx, setMcqIdx] = useState(0);
  const [selected, setSelected] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [answered, setAnswered] = useState(false);
  const [mcqScore, setMcqScore] = useState(0);

  const [intIdx, setIntIdx] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [evalResult, setEvalResult] = useState<InterviewEval | null>(null);
  const [interviewScores, setInterviewScores] = useState<number[]>([]);

  const [totalSecs, setTotalSecs] = useState(0);
  const [qSecs, setQSecs] = useState(30);
  const [autoAdvance, setAutoAdvance] = useState(0); // incremented by timer to trigger auto-advance
  const totalRef = useRef(0);
  const qRef = useRef(30);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = phase === 'mcq' || phase === 'interview';
  const navGuard = useNavGuard(isActive);

  const voice = useVoiceMode({ onLiveTranscript: (t) => setAnswer(t) });

  // Keyboard shortcuts
  useEffect(() => {
    if (phase !== 'mcq' || answered) return;
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, 'A' | 'B' | 'C' | 'D'> = {
        a: 'A', b: 'B', c: 'C', d: 'D',
        '1': 'A', '2': 'B', '3': 'C', '4': 'D',
      };
      const key = map[e.key.toLowerCase()];
      if (key) handleSelectOption(key);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, answered, mcqIdx]);

  // Auto-advance when per-question timer expires
  useEffect(() => {
    if (autoAdvance === 0) return;
    if (phase === 'mcq') {
      // If not yet answered, mark as skipped then advance
      if (!answered) { setAnswered(true); }
      handleNextMCQ();
    } else if (phase === 'interview') {
      if (!evalResult && !submitting) handleNextInterview();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdvance]);

  const startTimers = useCallback((durationMins: number) => {
    const totalSeconds = durationMins * 60;
    totalRef.current = totalSeconds;
    qRef.current = 30;
    setTotalSecs(totalSeconds);
    setQSecs(30);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      totalRef.current -= 1;
      qRef.current -= 1;
      setTotalSecs(totalRef.current);
      setQSecs(qRef.current);
      if (totalRef.current <= 0) { clearInterval(timerRef.current!); setPhase('results'); }
      // Auto-advance question when per-question timer expires
      if (qRef.current <= 0) { qRef.current = 30; setQSecs(30); setAutoAdvance(v => v + 1); }
    }, 1000);
  }, []);

  const resetQTimer = useCallback(() => { qRef.current = 30; setQSecs(30); }, []);

  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

  async function handleStart() {
    if (!role.trim()) { setSetupError('Please enter a job role.'); return; }
    setSetupError('');
    setPhase('loading');
    const cfg = DURATION_CONFIG[duration];

    // Cap MCQ count per request to avoid Gemini timeouts — fetch in batches if needed
    const MCQ_BATCH_LIMIT = 10;
    const mcqTarget = cfg.mcqCount;

    let rawMcqs: MCQ[] = [];
    let lastError = '';

    // Retry up to 2 times for MCQ generation
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const batchCount = Math.min(mcqTarget, MCQ_BATCH_LIMIT);
        const mcqRes = await api.post('/api/gemini/generate-mcq', {
          role: role.trim(),
          count: batchCount,
          difficulty: 'mixed',
        }, { timeout: 45000 });

        const batch = parseMCQs(mcqRes.data?.data?.questions ?? [], batchCount);
        rawMcqs = batch;

        // If we need more and first batch succeeded, fetch a second batch
        if (mcqTarget > MCQ_BATCH_LIMIT && batch.length >= 5) {
          try {
            const mcqRes2 = await api.post('/api/gemini/generate-mcq', {
              role: role.trim(),
              count: Math.min(mcqTarget - batch.length, MCQ_BATCH_LIMIT),
              difficulty: 'mixed',
            }, { timeout: 45000 });
            const batch2 = parseMCQs(mcqRes2.data?.data?.questions ?? [], mcqTarget - batch.length);
            rawMcqs = [...batch, ...batch2];
          } catch {
            // Second batch failed — proceed with first batch only
          }
        }

        if (rawMcqs.length > 0) break; // success
        lastError = 'No valid MCQs returned. Please try again.';
      } catch (err: any) {
        lastError = err?.response?.data?.message || err?.message || 'MCQ generation failed.';
        if (attempt < 2) await new Promise(r => setTimeout(r, 1500));
      }
    }

    if (rawMcqs.length === 0) {
      setSetupError(`Failed to generate questions: ${lastError}`);
      setPhase('setup');
      return;
    }

    // Generate interview questions (with fallback)
    let rawInt: InterviewQ[] = [];
    try {
      const intRes = await api.post('/api/gemini/generate-questions', {
        role: role.trim(),
        count: cfg.interviewCount,
        difficulty: 'hard',
      }, { timeout: 30000 });
      rawInt = (intRes.data?.data?.questions ?? [])
        .slice(0, cfg.interviewCount)
        .map((q: any) => ({ id: q.id ?? String(Math.random()), text: q.text ?? String(q) }))
        .filter((q: InterviewQ) => q.text && q.text.length > 10);
    } catch {
      // Fallback interview questions if generation fails
      rawInt = Array.from({ length: cfg.interviewCount }, (_, i) => ({
        id: `fallback-${i}`,
        text: `Describe a challenging ${role.trim()} problem you solved and how you approached it.`,
      }));
    }

    setMcqs(rawMcqs);
    setInterviewQs(rawInt);
    setPhase('mcq');
    startTimers(duration);
  }

  function handleSelectOption(key: 'A' | 'B' | 'C' | 'D') {
    if (answered) return;
    setSelected(key);
    setAnswered(true);
    if (key === mcqs[mcqIdx]?.correct) setMcqScore(s => s + 1);
  }

  function handleNextMCQ() {
    const next = mcqIdx + 1;
    if (next >= mcqs.length) {
      if (interviewQs.length === 0) { setPhase('results'); }
      else { setPhase('interview'); resetQTimer(); }
    } else {
      setMcqIdx(next); setSelected(null); setAnswered(false); resetQTimer();
    }
  }

  async function handleSubmitAnswer() {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    voice.stop();
    try {
      const res = await api.post('/api/gemini/evaluate-answer', {
        question: interviewQs[intIdx],
        answer: answer.trim(),
        conversationHistory: [],
      });
      const ev = res.data?.data?.evaluation;
      const score = typeof ev?.score === 'number' ? ev.score : 0;
      const feedback = ev?.feedback ?? ev?.overallFeedback ?? 'No feedback available.';
      setEvalResult({ score, feedback });
      setInterviewScores(s => [...s, score]);
    } catch {
      setEvalResult({ score: 0, feedback: 'Could not evaluate answer.' });
      setInterviewScores(s => [...s, 0]);
    } finally { setSubmitting(false); }
  }

  function handleNextInterview() {
    const next = intIdx + 1;
    if (next >= interviewQs.length) { setPhase('results'); }
    else { setIntIdx(next); setAnswer(''); setEvalResult(null); voice.reset(); resetQTimer(); }
  }

  const mcqPct = mcqs.length > 0 ? Math.round((mcqScore / mcqs.length) * 100) : 0;
  const intAvg = interviewScores.length > 0
    ? Math.round(interviewScores.reduce((a, b) => a + b, 0) / interviewScores.length) : 0;
  const overall = interviewScores.length > 0 ? Math.round((mcqPct + intAvg) / 2) : mcqPct;

  const totalQs = mcqs.length + interviewQs.length;
  const doneQs = phase === 'mcq' ? mcqIdx : phase === 'interview' ? mcqs.length + intIdx : totalQs;
  const progressPct = totalQs > 0 ? (doneQs / totalQs) * 100 : 0;

  // ── Phase: Setup ─────────────────────────────────────────────────────────
  if (phase === 'setup') return (
    <SetupScreen
      role={role} setRole={setRole}
      duration={duration} setDuration={setDuration}
      error={setupError} onStart={handleStart}
      onBack={() => { navGuard.bypass(); navigate('/hybrid/setup'); }}
    />
  );

  // ── Phase: Loading ───────────────────────────────────────────────────────
  if (phase === 'loading') return (
    <div className="cm-page">
      <div className="cm-particles">
        {[...Array(12)].map((_, i) => <div key={i} className="cm-particle" style={{ '--i': i } as React.CSSProperties} />)}
      </div>
      <div className="cm-loading">
        <div className="cm-loading__orb">
          <div className="cm-loading__ring cm-loading__ring--1" />
          <div className="cm-loading__ring cm-loading__ring--2" />
          <div className="cm-loading__ring cm-loading__ring--3" />
          <span className="cm-loading__icon">⚡</span>
        </div>
        <div className="cm-loading__title">Generating Your Contest</div>
        <div className="cm-loading__sub">Crafting AI-powered questions for <span className="cm-loading__role">{role}</span></div>
        <div className="cm-loading__steps">
          <div className="cm-loading__step cm-loading__step--active">
            <span className="cm-loading__step-dot" />Analyzing role requirements
          </div>
          <div className="cm-loading__step cm-loading__step--active">
            <span className="cm-loading__step-dot" />Generating MCQ bank
          </div>
          <div className="cm-loading__step">
            <span className="cm-loading__step-dot" />Crafting interview questions
          </div>
        </div>
      </div>
    </div>
  );

  // ── Phase: Results ───────────────────────────────────────────────────────
  if (phase === 'results') return (
    <ResultsScreen
      role={role} duration={duration}
      mcqScore={mcqScore} mcqTotal={mcqs.length}
      mcqPct={mcqPct} intAvg={intAvg} overall={overall}
      onDashboard={() => { navGuard.bypass(); navigate('/dashboard'); }}
      onRetry={() => {
        navGuard.bypass();
        setPhase('setup');
        setMcqIdx(0); setSelected(null); setAnswered(false); setMcqScore(0);
        setIntIdx(0); setAnswer(''); setEvalResult(null); setInterviewScores([]);
        voice.reset();
      }}
    />
  );

  const currentMCQ = mcqs[mcqIdx];
  const currentInt = interviewQs[intIdx];
  const totalTimeSecs = duration * 60;
  const timerPct = totalSecs / totalTimeSecs;

  // ── Phase: MCQ / Interview ───────────────────────────────────────────────
  return (
    <div className="cm-page">
      <div className="cm-particles">
        {[...Array(8)].map((_, i) => <div key={i} className="cm-particle" style={{ '--i': i } as React.CSSProperties} />)}
      </div>

      {/* Topbar */}
      <div className="cm-topbar">
        <div className="cm-topbar__left">
          <div className="cm-topbar__brand">
            <span className="cm-topbar__bolt">⚡</span>
            <span className="cm-topbar__name">Contest</span>
          </div>
          <div className="cm-topbar__role-chip">{role}</div>
          <div className={`cm-phase-pill ${phase === 'mcq' ? 'cm-phase-pill--mcq' : 'cm-phase-pill--interview'}`}>
            {phase === 'mcq' ? '📝 MCQ Phase' : '🤖 Interview Phase'}
          </div>
        </div>
        <div className="cm-topbar__right">
          <div className="cm-timer-group">
            <div className={`cm-timer-block cm-timer-block--total${totalSecs <= 60 ? ' cm-timer-block--urgent' : ''}`}>
              <svg className="cm-timer-ring" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="2.5" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeDasharray={`${timerPct * 100} 100`} strokeLinecap="round"
                  transform="rotate(-90 18 18)" />
              </svg>
              <div className="cm-timer-block__inner">
                <span className="cm-timer-block__label">Total</span>
                <span className="cm-timer-block__val">{fmt(totalSecs)}</span>
              </div>
            </div>
            <div className={`cm-timer-block cm-timer-block--q${qSecs <= 10 ? ' cm-timer-block--urgent' : ''}`}>
              <div className="cm-timer-block__inner">
                <span className="cm-timer-block__label">Q Time</span>
                <span className="cm-timer-block__val">{fmt(qSecs)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="cm-progress-track">
        <div className="cm-progress-fill" style={{ width: `${progressPct}%` }} />
        <div className="cm-progress-glow" style={{ left: `${progressPct}%` }} />
      </div>

      {/* Body */}
      <div className="cm-body">
        {/* Nav dots */}
        <div className="cm-nav-strip">
          <div className="cm-nav-strip__info">
            <span className="cm-nav-strip__count">
              {phase === 'mcq'
                ? `Question ${mcqIdx + 1} of ${mcqs.length}`
                : `Interview ${intIdx + 1} of ${interviewQs.length}`}
            </span>
            <span className="cm-nav-strip__score">
              {phase === 'mcq' ? `Score: ${mcqScore}/${mcqIdx + (answered ? 1 : 0)}` : `MCQ: ${mcqPct}%`}
            </span>
          </div>
          <div className="cm-nav-dots">
            {(phase === 'mcq' ? mcqs : interviewQs).slice(0, 30).map((_, i) => (
              <div key={i} className={`cm-nav-dot${
                i < (phase === 'mcq' ? mcqIdx : intIdx) ? ' cm-nav-dot--done'
                : i === (phase === 'mcq' ? mcqIdx : intIdx) ? ' cm-nav-dot--active' : ''
              }`} />
            ))}
          </div>
        </div>

        {/* MCQ Panel */}
        {phase === 'mcq' && currentMCQ && (
          <div className="cm-card cm-mcq" key={mcqIdx}>
            <div className="cm-mcq__header">
              <span className={`cm-diff-badge cm-diff-badge--${currentMCQ.difficulty}`}>
                {currentMCQ.difficulty === 'easy' ? '🟢' : currentMCQ.difficulty === 'medium' ? '🟡' : '🔴'} {currentMCQ.difficulty}
              </span>
              <span className="cm-mcq__num">#{mcqIdx + 1}</span>
            </div>
            <div className="cm-mcq__question">{currentMCQ.text}</div>
            <div className="cm-mcq__options">
              {OPTION_KEYS.map((k, i) => {
                let cls = 'cm-option';
                if (answered) {
                  if (k === currentMCQ.correct) cls += ' cm-option--correct';
                  else if (k === selected) cls += ' cm-option--wrong';
                  else cls += ' cm-option--dim';
                } else if (k === selected) {
                  cls += ' cm-option--selected';
                }
                return (
                  <button key={k} className={cls} disabled={answered} onClick={() => handleSelectOption(k)}>
                    <span className="cm-option__key">{OPTION_LABELS[i]}</span>
                    <span className="cm-option__text">{currentMCQ.options[k]}</span>
                    {answered && k === currentMCQ.correct && <span className="cm-option__check">✓</span>}
                    {answered && k === selected && k !== currentMCQ.correct && <span className="cm-option__cross">✗</span>}
                  </button>
                );
              })}
            </div>
            {answered && (
              <div className="cm-mcq__footer">
                <div className={`cm-feedback ${selected === currentMCQ.correct ? 'cm-feedback--correct' : 'cm-feedback--wrong'}`}>
                  <span className="cm-feedback__icon">{selected === currentMCQ.correct ? '🎯' : '💡'}</span>
                  <div>
                    <div className="cm-feedback__verdict">
                      {selected === currentMCQ.correct ? 'Correct!' : `Incorrect — Answer: ${currentMCQ.correct}`}
                    </div>
                    <div className="cm-feedback__explain">{currentMCQ.explanation}</div>
                  </div>
                </div>
                <button className="cm-next-btn" onClick={handleNextMCQ}>
                  {mcqIdx + 1 >= mcqs.length
                    ? (interviewQs.length > 0 ? 'Start Interview Phase →' : 'View Results →')
                    : 'Next Question →'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Interview Panel */}
        {phase === 'interview' && currentInt && (
          <div className="cm-card cm-interview" key={intIdx}>
            <div className="cm-interview__ai-bar">
              <div className="cm-ai-avatar">
                <div className="cm-ai-avatar__pulse" />
                <span className="cm-ai-avatar__icon">🤖</span>
              </div>
              <div className="cm-ai-info">
                <div className="cm-ai-info__name">AI Interviewer</div>
                <div className="cm-ai-info__status">
                  <span className="cm-ai-info__dot" />
                  Question {intIdx + 1} of {interviewQs.length}
                </div>
              </div>
              <div className="cm-interview__phase-tag">Interview Phase</div>
            </div>
            <div className="cm-interview__q-box">
              <div className="cm-interview__q-accent" />
              <div className="cm-interview__q-text">{currentInt.text}</div>
            </div>
            <div className="cm-answer-section">
              <div className="cm-answer-label">
                <span>Your Answer</span>
                {voice.isListening && <span className="cm-voice-indicator">🔴 Recording...</span>}
              </div>
              <textarea
                className="cm-answer-textarea"
                placeholder="Type your answer here, or use voice input below..."
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                disabled={!!evalResult || submitting}
              />
              {!evalResult && (
                <div className="cm-answer-controls">
                  <button
                    className="cm-submit-btn"
                    onClick={handleSubmitAnswer}
                    disabled={!answer.trim() || submitting}
                  >
                    {submitting
                      ? <><span className="cm-submit-btn__spinner" /> Evaluating...</>
                      : '✓ Submit Answer'}
                  </button>
                  {voice.isSupported && (
                    <button
                      className={`cm-voice-btn${voice.isListening ? ' cm-voice-btn--active' : ''}`}
                      onClick={() => voice.isListening ? voice.stop() : voice.start()}
                      disabled={!!evalResult || submitting}
                    >
                      {voice.isListening ? '⏹ Stop' : '🎤 Voice'}
                    </button>
                  )}
                </div>
              )}
              {evalResult && (
                <div className="cm-eval-result">
                  <div className="cm-eval-result__header">
                    <div className="cm-eval-score">
                      <span className="cm-eval-score__num">{evalResult.score}</span>
                      <span className="cm-eval-score__denom">/10</span>
                    </div>
                    <div className="cm-eval-bar">
                      <div className="cm-eval-bar__fill" style={{ width: `${evalResult.score * 10}%` }} />
                    </div>
                  </div>
                  <div className="cm-eval-feedback">{evalResult.feedback}</div>
                  <button className="cm-next-btn" onClick={handleNextInterview}>
                    {intIdx + 1 >= interviewQs.length ? 'View Results →' : 'Next Question →'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SetupScreen ───────────────────────────────────────────────────────────────

function SetupScreen({ role, setRole, duration, setDuration, error, onStart, onBack }: {
  role: string; setRole: (v: string) => void;
  duration: number; setDuration: (v: number) => void;
  error: string; onStart: () => void; onBack: () => void;
}) {
  const cfg = DURATION_CONFIG[duration];
  return (
    <div className="cm-page cm-setup-page">
      <div className="cm-particles">
        {[...Array(15)].map((_, i) => <div key={i} className="cm-particle" style={{ '--i': i } as React.CSSProperties} />)}
      </div>
      <div className="cm-setup-wrap">
        <div className="cm-setup-card">
          <button className="cm-back-btn" onClick={onBack}>← Back</button>

          <div className="cm-setup-hero">
            <div className="cm-setup-hero__icon">⚡</div>
            <div className="cm-setup-hero__badge">AI Contest Mode</div>
            <h1 className="cm-setup-hero__title">Ready to Compete?</h1>
            <p className="cm-setup-hero__sub">
              AI-generated MCQs + live interview questions — tailored to your role, timed to the second.
            </p>
          </div>

          <div className="cm-setup-field">
            <label className="cm-field-label">Job Role</label>
            <div className="cm-input-wrap">
              <span className="cm-input-icon">💼</span>
              <input
                className="cm-setup-input"
                placeholder="e.g. Frontend Engineer, Data Scientist..."
                value={role}
                onChange={e => setRole(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onStart()}
                autoFocus
              />
            </div>
          </div>

          <div className="cm-setup-field">
            <label className="cm-field-label">Contest Duration</label>
            <div className="cm-duration-grid">
              {DURATIONS.map(d => {
                const c = DURATION_CONFIG[d];
                const active = duration === d;
                return (
                  <button
                    key={d}
                    className={`cm-dur-card${active ? ' cm-dur-card--active' : ''}`}
                    onClick={() => setDuration(d)}
                  >
                    <div className="cm-dur-card__glow" />
                    <div className="cm-dur-card__mins">{d}</div>
                    <div className="cm-dur-card__unit">min</div>
                    <div className="cm-dur-card__divider" />
                    <div className="cm-dur-card__detail">
                      <span>{c.mcqCount} MCQs</span>
                      <span>{c.interviewCount} Interview{c.interviewCount > 1 ? 's' : ''}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview strip */}
          <div className="cm-preview-strip">
            <div className="cm-preview-item">
              <span className="cm-preview-item__icon">📝</span>
              <span className="cm-preview-item__val">{cfg.mcqCount}</span>
              <span className="cm-preview-item__label">MCQs</span>
            </div>
            <div className="cm-preview-sep">+</div>
            <div className="cm-preview-item">
              <span className="cm-preview-item__icon">🤖</span>
              <span className="cm-preview-item__val">{cfg.interviewCount}</span>
              <span className="cm-preview-item__label">Interview{cfg.interviewCount > 1 ? 's' : ''}</span>
            </div>
            <div className="cm-preview-sep">=</div>
            <div className="cm-preview-item">
              <span className="cm-preview-item__icon">⏱</span>
              <span className="cm-preview-item__val">{duration}</span>
              <span className="cm-preview-item__label">Minutes</span>
            </div>
          </div>

          {error && <div className="cm-error-box">⚠ {error}</div>}

          <button className="cm-launch-btn" onClick={onStart} disabled={!role.trim()}>
            <span className="cm-launch-btn__glow" />
            <span className="cm-launch-btn__text">⚡ Launch Contest</span>
          </button>

          <div className="cm-setup-hints">
            <span>💡 Tip: Use keyboard shortcuts A/B/C/D during MCQs</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ResultsScreen ─────────────────────────────────────────────────────────────

function ResultsScreen({ role, duration, mcqScore, mcqTotal, mcqPct, intAvg, overall, onDashboard, onRetry }: {
  role: string; duration: number;
  mcqScore: number; mcqTotal: number; mcqPct: number;
  intAvg: number; overall: number;
  onDashboard: () => void; onRetry: () => void;
}) {
  const grade = overall >= 90 ? 'S' : overall >= 80 ? 'A' : overall >= 70 ? 'B' : overall >= 60 ? 'C' : 'D';
  const gradeColor = overall >= 80 ? '#10b981' : overall >= 60 ? '#f59e0b' : '#ef4444';
  const trophy = overall >= 80 ? '🏆' : overall >= 60 ? '🥈' : '🎯';

  return (
    <div className="cm-page cm-results-page">
      <div className="cm-particles">
        {[...Array(20)].map((_, i) => <div key={i} className="cm-particle cm-particle--result" style={{ '--i': i } as React.CSSProperties} />)}
      </div>
      <div className="cm-results-wrap">
        <div className="cm-results-card">
          <div className="cm-results-trophy">{trophy}</div>
          <div className="cm-results-title">Contest Complete</div>
          <div className="cm-results-meta">{role} · {duration} min</div>

          <div className="cm-results-grade-ring" style={{ '--grade-color': gradeColor } as React.CSSProperties}>
            <div className="cm-results-grade-ring__track" />
            <div className="cm-results-grade-ring__fill" style={{
              background: `conic-gradient(${gradeColor} ${overall}%, rgba(255,255,255,0.06) 0%)`
            }} />
            <div className="cm-results-grade-ring__center">
              <span className="cm-results-grade-ring__pct">{overall}%</span>
              <span className="cm-results-grade-ring__grade" style={{ color: gradeColor }}>{grade}</span>
            </div>
          </div>

          <div className="cm-results-stats">
            <div className="cm-stat-card">
              <div className="cm-stat-card__icon">📝</div>
              <div className="cm-stat-card__val">{mcqScore}/{mcqTotal}</div>
              <div className="cm-stat-card__label">MCQ Score</div>
              <div className="cm-stat-card__pct">{mcqPct}% correct</div>
            </div>
            <div className="cm-stat-card">
              <div className="cm-stat-card__icon">🤖</div>
              <div className="cm-stat-card__val">{intAvg > 0 ? `${intAvg}/10` : '—'}</div>
              <div className="cm-stat-card__label">Interview Avg</div>
              <div className="cm-stat-card__pct">AI evaluation</div>
            </div>
            <div className="cm-stat-card cm-stat-card--overall">
              <div className="cm-stat-card__icon">⭐</div>
              <div className="cm-stat-card__val">{overall}%</div>
              <div className="cm-stat-card__label">Overall</div>
              <div className="cm-stat-card__pct">Grade {grade}</div>
            </div>
          </div>

          <div className="cm-results-actions">
            <button className="cm-results-btn cm-results-btn--primary" onClick={onDashboard}>
              Back to Dashboard
            </button>
            <button className="cm-results-btn cm-results-btn--ghost" onClick={onRetry}>
              ⚡ Try Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function buildMCQPrompt(role: string, count: number): string {
  return `Generate exactly ${count} multiple-choice questions for a ${role} technical interview. 
Each question must be a JSON object with fields: text (string), options (object with A/B/C/D string values), correct (one of A/B/C/D), difficulty (easy/medium/hard), explanation (string). 
Mix difficulties: ~30% easy, ~40% medium, ~30% hard. Questions must be role-specific and test real technical knowledge. 
Return ONLY a JSON array of these objects, no extra text.`;
}

function parseMCQs(questions: any[], targetCount: number): MCQ[] {
  const result: MCQ[] = [];

  for (const q of questions) {
    // Direct MCQ object from the new /generate-mcq endpoint
    if (isMCQ(q)) { result.push(q); continue; }

    // Fallback: try parsing if it's a string
    if (typeof q === 'string') {
      try {
        const parsed = JSON.parse(q);
        if (Array.isArray(parsed)) result.push(...parsed.filter(isMCQ));
        else if (isMCQ(parsed)) result.push(parsed);
      } catch { /* skip unparseable strings */ }
      continue;
    }

    // Fallback: question has a text field but missing options — try inner parse
    if (q?.text) {
      try {
        const inner = JSON.parse(q.text);
        if (Array.isArray(inner)) result.push(...inner.filter(isMCQ));
        else if (isMCQ(inner)) result.push(inner);
      } catch { /* skip */ }
    }
  }

  return result.slice(0, targetCount);
}

function isMCQ(q: any): q is MCQ {
  return q && typeof q.text === 'string' && q.options &&
    typeof q.options.A === 'string' && typeof q.correct === 'string' &&
    ['A', 'B', 'C', 'D'].includes(q.correct);
}

function makeFallbackMCQ(text: string, idx: number): MCQ {
  const difficulties: MCQ['difficulty'][] = ['easy', 'medium', 'hard'];
  return {
    text,
    options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
    correct: 'A',
    difficulty: difficulties[idx % 3],
    explanation: 'Please refer to official documentation for the correct answer.',
  };
}
