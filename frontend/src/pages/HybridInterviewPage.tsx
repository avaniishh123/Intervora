import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useHybridSocket } from '../hooks/useHybridSocket';
import { useTurnGate } from '../hooks/useTurnGate';
import { useVoiceMode } from '../hooks/useVoiceMode';
import { useSessionTimer } from '../hooks/useSessionTimer';
import { useNavGuard } from '../hooks/useNavGuard';
import { HybridQuestion, HybridEvaluationResult } from '../types/hybrid.types';
import api from '../services/api';
import '../styles/HybridInterview.css';

const QUESTION_TIME_LIMIT = 120;
const TOTAL_QUESTIONS = 5;

interface QuestionRecord {
  question: HybridQuestion;
  answer: string;
  evaluation: HybridEvaluationResult | null;
}

function getSessionMode(sessionId: string): string {
  return sessionStorage.getItem(`hybrid_mode_${sessionId}`) || 'ai';
}
function getSessionJobRole(sessionId: string): string {
  return sessionStorage.getItem(`hybrid_jobrole_${sessionId}`) || 'Software Engineer';
}

export default function HybridInterviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const stateMode = (location.state as any)?.mode;
  const stateJobRole = (location.state as any)?.jobRole;
  const stateIsHost = (location.state as any)?.isHost ?? false;
  const stateParticipantId = (location.state as any)?.participantId ?? null;
  const stateParticipantName = (location.state as any)?.participantName ?? null;
  const stateStartedAt = (location.state as any)?.startedAt ?? null;

  const mode = stateMode || (sessionId ? getSessionMode(sessionId) : 'ai');
  const jobRole = stateJobRole || (sessionId ? getSessionJobRole(sessionId) : 'Software Engineer');

  // For human mode: host vs candidate role
  const isHost = mode === 'human' ? stateIsHost : false;
  const participantId = stateParticipantId;
  const participantName = stateParticipantName;

  const [question, setQuestion] = useState<HybridQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [evaluation, setEvaluation] = useState<HybridEvaluationResult | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [error, setError] = useState('');
  const [voiceMode, setVoiceMode] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT);
  const [timerActive, setTimerActive] = useState(false);
  const [history, setHistory] = useState<QuestionRecord[]>([]);
  const [allEvaluations, setAllEvaluations] = useState<HybridEvaluationResult[]>([]);
  const [aiQuestionLoading, setAiQuestionLoading] = useState(false);
  const [ttsActive, setTtsActive] = useState(false);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | undefined>(
    stateStartedAt ?? undefined
  );

  const answerRef = useRef(answer);
  answerRef.current = answer;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentQuestionRef = useRef<HybridQuestion | null>(null);
  const questionIndexRef = useRef(0);
  const historyRef = useRef<QuestionRecord[]>([]);
  historyRef.current = history;

  // Session elapsed timer — only shown in human mode
  const elapsedTime = useSessionTimer(mode === 'human' ? sessionStartedAt : undefined);

  // Nav guard — active during human mode session until ended
  const navGuard = useNavGuard(mode === 'human' && !sessionEnded);

  const voice = useVoiceMode({
    onLiveTranscript: (text) => setAnswer(text),
  });

  const gate = useTurnGate({
    onLock: () => voice.setAiSpeaking(true),
    onOpen: () => voice.setAiSpeaking(false),
  });

  // ── Timer ──────────────────────────────────────────────────────────────────
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerActive(false);
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setTimeLeft(QUESTION_TIME_LIMIT);
    setTimerActive(true);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { stopTimer(); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, [stopTimer]);

  // ── TTS ────────────────────────────────────────────────────────────────────
  const speakQuestion = useCallback((text: string, onDone: () => void) => {
    if (!window.speechSynthesis) { onDone(); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95;
    utt.pitch = 1;
    utt.onend = () => { setTtsActive(false); onDone(); };
    utt.onerror = () => { setTtsActive(false); onDone(); };
    setTtsActive(true);
    window.speechSynthesis.speak(utt);
  }, []);

  // ── Receive question ───────────────────────────────────────────────────────
  const receiveQuestion = useCallback((q: HybridQuestion) => {
    currentQuestionRef.current = q;
    setQuestion(q);
    setAnswer('');
    setEvaluation(null);
    setEvalLoading(false);
    questionIndexRef.current += 1;
    setQuestionIndex(questionIndexRef.current);
    gate.lock();
    startTimer();
    speakQuestion(q.text, () => {
      gate.open();
      if (voiceMode) voice.start();
    });
  }, [gate, startTimer, speakQuestion, voiceMode, voice]);

  // ── AI question generation ─────────────────────────────────────────────────
  const generateAiQuestion = useCallback(async () => {
    if (!sessionId) return;
    setAiQuestionLoading(true);
    setError('');
    try {
      const res = await api.post('/api/gemini/generate-questions', {
        role: jobRole,
        count: 1,
        difficulty: 'medium',
      });
      const questions = res.data?.data?.questions;
      const questionText =
        (Array.isArray(questions) && questions[0]?.text) ||
        `Tell me about your experience with ${jobRole}.`;
      const q: HybridQuestion = {
        questionId: `ai-q-${Date.now()}`,
        text: questionText,
        turnGate: 'locked',
      };
      receiveQuestion(q);
    } catch {
      const fallbacks = [
        `Tell me about your background in ${jobRole}.`,
        `What's a challenging problem you solved recently as a ${jobRole}?`,
        `How do you approach debugging complex issues in your work?`,
        `Describe your experience with system design and architecture.`,
        `What are your key strengths as a ${jobRole}?`,
      ];
      const idx = questionIndexRef.current % fallbacks.length;
      const q: HybridQuestion = {
        questionId: `ai-q-fallback-${Date.now()}`,
        text: fallbacks[idx],
        turnGate: 'locked',
      };
      receiveQuestion(q);
    } finally {
      setAiQuestionLoading(false);
    }
  }, [sessionId, jobRole, receiveQuestion]);

  // ── Socket ─────────────────────────────────────────────────────────────────
  const { joinSession, submitAnswer, sendLiveTranscript, endSession } = useHybridSocket({
    onQuestion: (q) => receiveQuestion(q),
    onEvaluationResult: (r) => {
      setEvaluation(r);
      setEvalLoading(false);
      setAllEvaluations(prev => [...prev, r]);
      if (currentQuestionRef.current) {
        setHistory(prev => [
          ...prev,
          { question: currentQuestionRef.current!, answer: answerRef.current, evaluation: r },
        ]);
      }
      stopTimer();
      if (mode === 'ai' && questionIndexRef.current < TOTAL_QUESTIONS) {
        setTimeout(() => generateAiQuestion(), 2500);
      } else if (mode === 'ai' && questionIndexRef.current >= TOTAL_QUESTIONS) {
        setTimeout(() => {
          if (sessionId) endSession(sessionId);
          setSessionEnded(true);
        }, 2500);
      }
    },
    onEvaluationTimeout: () => {
      setEvalLoading(false);
      setError('Evaluation timed out. Moving to next question...');
      stopTimer();
      if (mode === 'ai' && questionIndexRef.current < TOTAL_QUESTIONS) {
        setTimeout(() => generateAiQuestion(), 2000);
      }
    },
    onSessionEnd: () => {
      stopTimer();
      setSessionEnded(true);
    },
    onError: (e) => setError(e.message),
  });

  // ── Auto-submit on timer expiry ────────────────────────────────────────────
  useEffect(() => {
    if (timeLeft === 0 && gate.state === 'open' && question && sessionId) {
      const text = answerRef.current.trim() || '(No answer provided)';
      voice.stop();
      gate.submit();
      setEvalLoading(true);
      submitAnswer(sessionId, question.questionId, text, true);
      // Log answer event for human mode
      if (mode === 'human') {
        api.post(`/api/hybrid/rooms/${sessionId}/log-event`, {
          type: 'answer',
          participantId: participantId ?? undefined,
          participantName: participantName ?? undefined,
          content: text,
        }).catch(() => {});
      }
    }
  }, [timeLeft]); // eslint-disable-line

  // ── Session init ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    joinSession(sessionId, 'candidate');
    if (mode === 'ai') {
      setTimeout(() => generateAiQuestion(), 800);
    }
    // If human mode and startedAt not yet set, fetch it from room
    if (mode === 'human' && !sessionStartedAt) {
      api.get(`/api/hybrid/rooms/${sessionId}`)
        .then(res => {
          const room = res.data?.data?.room;
          if (room?.startedAt) setSessionStartedAt(room.startedAt);
        })
        .catch(() => {});
    }
    return () => {
      stopTimer();
      window.speechSynthesis?.cancel();
    };
  }, [sessionId]); // eslint-disable-line

  // ── Relay live transcript ──────────────────────────────────────────────────
  useEffect(() => {
    if (voiceMode && sessionId && voice.liveText) {
      sendLiveTranscript(sessionId, voice.liveText);
    }
  }, [voice.liveText]); // eslint-disable-line

  // ── Voice toggle ───────────────────────────────────────────────────────────
  const handleVoiceToggle = useCallback(() => {
    if (!voiceMode) {
      setVoiceMode(true);
      if (gate.state === 'open') voice.start();
    } else {
      setVoiceMode(false);
      voice.stop();
    }
  }, [voiceMode, gate.state, voice]);

  useEffect(() => {
    if (gate.state === 'open' && voiceMode) voice.start();
  }, [gate.state]); // eslint-disable-line

  // ── Submit answer ──────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    const text = answerRef.current.trim();
    if (!text || !question || !sessionId) return;
    if (gate.state !== 'open') return;
    voice.stop();
    gate.submit();
    stopTimer();
    setEvalLoading(true);
    submitAnswer(sessionId, question.questionId, text);
    // Log answer event for human mode
    if (mode === 'human') {
      api.post(`/api/hybrid/rooms/${sessionId}/log-event`, {
        type: 'answer',
        participantId: participantId ?? undefined,
        participantName: participantName ?? undefined,
        content: text,
      }).catch(() => {});
    }
  }, [question, sessionId, gate, voice, submitAnswer, stopTimer, mode, participantId, participantName]);

  // ── Leave session (candidate) ──────────────────────────────────────────────
  const handleLeaveSession = useCallback(async () => {
    if (!sessionId) return;
    if (!window.confirm('Are you sure you want to leave the session?')) return;
    stopTimer();
    window.speechSynthesis?.cancel();
    try {
      await api.post(`/api/hybrid/rooms/${sessionId}/leave`, {
        participantId: participantId ?? undefined,
        participantName: participantName ?? undefined,
      });
    } catch { /* best-effort */ }
    navGuard.bypass();
    navigate('/dashboard');
  }, [sessionId, participantId, participantName, stopTimer, navigate, navGuard]);

  // ── End session (host only) ────────────────────────────────────────────────
  const handleEndSession = useCallback(async () => {
    if (!sessionId) return;
    stopTimer();
    window.speechSynthesis?.cancel();
    if (mode === 'human' && isHost) {
      try {
        await api.post(`/api/hybrid/rooms/${sessionId}/end`);
      } catch { /* best-effort */ }
    } else {
      endSession(sessionId);
    }
    setSessionEnded(true);
  }, [sessionId, mode, isHost, stopTimer, endSession]);

  // ── Result Summary ─────────────────────────────────────────────────────────
  if (sessionEnded) {
    const avg = (key: keyof HybridEvaluationResult) => {
      if (!allEvaluations.length) return 0;
      return Math.round(
        allEvaluations.reduce((s, e) => s + (e[key] as number), 0) / allEvaluations.length
      );
    };
    const overallScore = avg('compositeScore');
    const badge = overallScore >= 80 ? '🏆' : overallScore >= 60 ? '🎯' : '📝';
    const verdict = overallScore >= 80 ? 'Excellent performance!' : overallScore >= 60 ? 'Good effort — keep improving.' : "Keep practicing — you'll get there.";

    return (
      <div className="hi-result">
        <div className="hi-result__card">
          <div className="hi-result__badge">{badge}</div>
          <h2 className="hi-result__title">Interview Complete</h2>
          <p className="hi-result__subtitle">{verdict}</p>
          <p className="hi-result__subtitle" style={{ marginTop: '-0.5rem' }}>
            {allEvaluations.length} question{allEvaluations.length !== 1 ? 's' : ''} answered
          </p>
          {mode === 'human' && sessionStartedAt && (
            <p className="hi-result__subtitle">Session duration: {elapsedTime}</p>
          )}

          <div className="hi-result__score-ring">
            <span className="hi-result__score-num">{overallScore}</span>
            <span className="hi-result__score-label">/ 100</span>
          </div>

          <div className="hi-result__breakdown">
            {[
              { label: 'Technical', val: avg('technicalScore') },
              { label: 'Clarity', val: avg('clarityScore') },
              { label: 'Depth', val: avg('depthScore') },
              { label: 'Confidence', val: avg('confidenceScore') },
            ].map(({ label, val }) => (
              <div key={label} className="hi-result__metric">
                <div className="hi-result__metric-label">{label}</div>
                <div className="hi-result__metric-bar">
                  <div className="hi-result__metric-fill" style={{ width: `${val}%` }} />
                </div>
                <div className="hi-result__metric-val">{val}</div>
              </div>
            ))}
          </div>

          {allEvaluations.length > 0 && (
            <div className="hi-result__insights">
              <div className="hi-result__insights-title">💡 Key Insights</div>
              {avg('technicalScore') < 60 && (
                <div className="hi-result__insight-item">Strengthen technical depth — practice core concepts for {jobRole}.</div>
              )}
              {avg('clarityScore') < 60 && (
                <div className="hi-result__insight-item">Work on communication clarity — structure answers with STAR method.</div>
              )}
              {avg('depthScore') < 60 && (
                <div className="hi-result__insight-item">Add more depth — include specific examples and metrics.</div>
              )}
              {avg('confidenceScore') < 60 && (
                <div className="hi-result__insight-item">Build confidence — practice out loud and record yourself.</div>
              )}
              {overallScore >= 80 && (
                <div className="hi-result__insight-item">Outstanding! You're well-prepared for {jobRole} interviews.</div>
              )}
            </div>
          )}

          {history.length > 0 && (
            <div className="hi-result__history">
              <div className="hi-result__history-title">Question Breakdown</div>
              {history.map((rec, i) => (
                <div key={i} className="hi-result__history-item">
                  <div className="hi-result__history-q">Q{i + 1}: {rec.question.text}</div>
                  <div className="hi-result__history-a">{rec.answer || '(no answer)'}</div>
                  {rec.evaluation && (
                    <div className="hi-result__history-score">
                      Score: {rec.evaluation.compositeScore}/100 — {rec.evaluation.feedback}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <button className="hi-result__btn" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const timerPct = (timeLeft / QUESTION_TIME_LIMIT) * 100;
  const timerColor = timeLeft > 60 ? '#10b981' : timeLeft > 30 ? '#f59e0b' : '#ef4444';

  const gateLabel =
    ttsActive ? '🔊 Interviewer speaking...' :
    aiQuestionLoading ? '⏳ Generating question...' :
    gate.state === 'locked' ? '⏳ Waiting for question...' :
    gate.state === 'open' ? '🎙 Your turn to answer' :
    '✅ Answer submitted — evaluating...';

  const modeLabel = mode === 'ai' ? '🤖 AI Interview' : mode === 'human' ? '👤 Human Interview' : '🏆 Contest';

  return (
    <div className="hi-page">
      {/* Top bar */}
      <div className="hi-topbar">
        <div className="hi-topbar__left">
          <button
            className="hi-back-btn"
            onClick={() => {
              navGuard.bypass();
              if (mode === 'human' && sessionId) {
                navigate(`/hybrid/waiting/${sessionId}`, { state: { jobRole } });
              } else {
                navigate('/dashboard');
              }
            }}
            title="Go back"
          >
            ←
          </button>
          <span className="hi-topbar__logo">{modeLabel}</span>
          <span className={`hi-gate hi-gate--${ttsActive ? 'locked' : gate.state}`}>
            <span className="hi-gate__dot" />
            {gateLabel}
          </span>
        </div>
        <div className="hi-topbar__right">
          {/* Session elapsed timer — human mode only */}
          {mode === 'human' && sessionStartedAt && (
            <span className="hi-session-timer">⏱ {elapsedTime}</span>
          )}
          <span className="hi-progress">
            Q {Math.min(questionIndex, TOTAL_QUESTIONS)} / {TOTAL_QUESTIONS}
          </span>
          {timerActive && (
            <div className="hi-timer" style={{ '--timer-color': timerColor } as React.CSSProperties}>
              <svg className="hi-timer__ring" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke={timerColor} strokeWidth="2.5"
                  strokeDasharray={`${timerPct} 100`}
                  strokeLinecap="round"
                  transform="rotate(-90 18 18)"
                />
              </svg>
              <span className="hi-timer__text">{timeLeft}s</span>
            </div>
          )}
          {/* Role-based controls — human mode only */}
          {mode === 'human' && isHost && questionIndex > 0 && (
            <button className="hi-end-btn hi-end-btn--host" onClick={handleEndSession} title="End session for all participants">
              End Session
            </button>
          )}
          {mode === 'human' && !isHost && (
            <button className="hi-leave-btn" onClick={handleLeaveSession} title="Leave session">
              Leave
            </button>
          )}
          {/* AI mode early end */}
          {mode === 'ai' && questionIndex > 0 && questionIndex < TOTAL_QUESTIONS && (
            <button className="hi-end-btn" onClick={handleEndSession} title="End session early">
              End
            </button>
          )}
        </div>
      </div>

      {/* Split body */}
      <div className="hi-body">
        <div className="hi-left">
          {error && (
            <div className="hi-error">
              {error}
              <button onClick={() => setError('')}>✕</button>
            </div>
          )}
          {voice.error && <div className="hi-error">{voice.error}</div>}

          <div className="hi-question">
            <div className="hi-question__label">
              {questionIndex > 0 ? `Question ${questionIndex} of ${TOTAL_QUESTIONS}` : 'Question'}
            </div>
            <div className="hi-question__text">
              {aiQuestionLoading ? (
                <span className="hi-question__placeholder">
                  <span className="hi-spinner" style={{ marginRight: '0.5rem' }} />
                  Generating your next question...
                </span>
              ) : question ? (
                <>
                  {ttsActive && <span className="hi-tts-indicator">🔊 </span>}
                  {question.text}
                </>
              ) : (
                <span className="hi-question__placeholder">
                  {mode === 'human'
                    ? 'Waiting for the interviewer to send the first question...'
                    : 'Preparing your first question...'}
                </span>
              )}
            </div>
          </div>

          <div className="hi-answer">
            <div className="hi-answer__label">
              Your Answer
              {voiceMode && voice.isListening && (
                <span className="hi-answer__voice-indicator"> 🔴 Recording</span>
              )}
            </div>
            <textarea
              className="hi-answer__textarea"
              placeholder={
                gate.state === 'locked' || ttsActive
                  ? 'Wait for the question to finish...'
                  : 'Type your answer here, or use voice mode...'
              }
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              disabled={gate.state !== 'open' || ttsActive}
            />
            <div className="hi-answer__controls">
              {voice.isSupported && (
                <button
                  className={`hi-voice-btn${voiceMode ? ' hi-voice-btn--active' : ''}`}
                  onClick={handleVoiceToggle}
                  disabled={gate.state !== 'open' || ttsActive}
                  title={voiceMode ? 'Stop voice' : 'Start voice input'}
                >
                  {voiceMode && voice.isListening ? '🔴 Listening...' : '🎙 Voice'}
                </button>
              )}
              <button
                className="hi-submit-btn"
                onClick={handleSubmit}
                disabled={gate.state !== 'open' || !answer.trim() || ttsActive}
              >
                {evalLoading ? (
                  <span className="hi-submit-btn__loading">
                    <span className="hi-spinner" /> Evaluating...
                  </span>
                ) : 'Submit Answer →'}
              </button>
            </div>
          </div>
        </div>

        {/* Right panel — AI Evaluation */}
        <div className="hi-right">
          <div className="hi-eval-header">AI Evaluation Panel</div>

          {!evaluation && !evalLoading && (
            <div className="hi-eval-empty">
              <div className="hi-eval-empty__icon">🤖</div>
              <div className="hi-eval-empty__text">
                Submit your answer to see real-time AI scoring across Technical, Clarity, Depth, and Confidence.
              </div>
            </div>
          )}

          {evalLoading && (
            <div className="hi-eval-loading">
              <div className="hi-eval-loading__spinner" />
              <div>Analyzing your answer...</div>
            </div>
          )}

          {evaluation && !evalLoading && (
            <div className="hi-eval-result">
              <div className="hi-eval-composite">
                <span className="hi-eval-composite__num">{evaluation.compositeScore}</span>
                <span className="hi-eval-composite__denom">/100</span>
              </div>

              <div className="hi-eval-scores">
                {[
                  { label: 'Technical', val: evaluation.technicalScore, icon: '⚙️' },
                  { label: 'Clarity', val: evaluation.clarityScore, icon: '💬' },
                  { label: 'Depth', val: evaluation.depthScore, icon: '🔍' },
                  { label: 'Confidence', val: evaluation.confidenceScore, icon: '💪' },
                ].map(({ label, val, icon }) => (
                  <div key={label} className="hi-eval-score">
                    <div className="hi-eval-score__top">
                      <span>{icon} {label}</span>
                      <span className="hi-eval-score__val">{val}</span>
                    </div>
                    <div className="hi-eval-score__bar">
                      <div
                        className="hi-eval-score__fill"
                        style={{
                          width: `${val}%`,
                          background: val >= 70 ? '#10b981' : val >= 50 ? '#f59e0b' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="hi-eval-feedback">
                <div className="hi-eval-feedback__label">Feedback</div>
                <div className="hi-eval-feedback__text">{evaluation.feedback}</div>
              </div>

              {questionIndex < TOTAL_QUESTIONS && mode === 'ai' && (
                <div className="hi-eval-next-hint">
                  Next question loading in a moment...
                </div>
              )}
            </div>
          )}

          <div className="hi-progress-dots">
            {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => (
              <div
                key={i}
                className={`hi-progress-dot${
                  i < questionIndex - 1 ? ' hi-progress-dot--done' :
                  i === questionIndex - 1 ? ' hi-progress-dot--current' : ''
                }`}
              />
            ))}
          </div>

          <div className="hi-session-info">
            <div className="hi-session-info__item">
              <span className="hi-session-info__label">Role</span>
              <span className="hi-session-info__val">{jobRole}</span>
            </div>
            <div className="hi-session-info__item">
              <span className="hi-session-info__label">Mode</span>
              <span className="hi-session-info__val">{modeLabel}</span>
            </div>
            {mode === 'human' && (
              <div className="hi-session-info__item">
                <span className="hi-session-info__label">You</span>
                <span className="hi-session-info__val">{isHost ? 'Interviewer' : (participantName ?? 'Candidate')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
