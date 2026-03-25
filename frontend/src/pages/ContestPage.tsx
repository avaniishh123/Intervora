import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useHybridSocket } from '../hooks/useHybridSocket';
import { useTurnGate } from '../hooks/useTurnGate';
import { useVoiceMode } from '../hooks/useVoiceMode';
import { HybridQuestion, HybridEvaluationResult, TimerTick } from '../types/hybrid.types';
import '../styles/HybridInterview.css';
import '../styles/Contest.css';

function formatMs(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function ContestPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const navigate = useNavigate();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<HybridQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [evaluation, setEvaluation] = useState<HybridEvaluationResult | null>(null);
  const [timer, setTimer] = useState<TimerTick>({ contestTimeRemaining: 0, questionTimeRemaining: 0 });
  const [sessionEnded, setSessionEnded] = useState(false);
  const [error, setError] = useState('');
  const [voiceMode, setVoiceMode] = useState(false);

  const answerRef = useRef(answer);
  answerRef.current = answer;

  const voice = useVoiceMode({ onLiveTranscript: (t) => setAnswer(t) });
  const gate = useTurnGate({
    onLock: () => voice.setAiSpeaking(true),
    onOpen: () => voice.setAiSpeaking(false),
  });

  const { joinSession, submitAnswer } = useHybridSocket({
    onQuestion: (q) => {
      setQuestion(q);
      setAnswer('');
      setEvaluation(null);
      gate.lock();
      setTimeout(() => gate.open(), 600);
    },
    onEvaluationResult: (r) => setEvaluation(r),
    onTimerTick: (t) => setTimer(t),
    onAnswerAutoSubmit: () => {
      // Server triggered auto-submit — submit current answer
      const text = answerRef.current.trim();
      if (question && sessionId) {
        voice.stop();
        gate.submit();
        submitAnswer(sessionId, question.questionId, text || '(no answer)', true);
      }
    },
    onSessionEnd: () => setSessionEnded(true),
    onError: (e) => setError(e.message),
  });

  // Retrieve sessionId from localStorage (set during setup)
  useEffect(() => {
    const stored = localStorage.getItem(`contest_session_${contestId}`);
    if (stored) {
      setSessionId(stored);
      joinSession(stored, 'contestant');
    }
  }, [contestId, joinSession]);

  useEffect(() => {
    if (gate.state === 'open' && voiceMode) voice.start();
  }, [gate.state]); // eslint-disable-line

  const handleSubmit = useCallback(() => {
    const text = answerRef.current.trim();
    if (!text || !question || !sessionId || gate.state !== 'open') return;
    voice.stop();
    gate.submit();
    submitAnswer(sessionId, question.questionId, text);
  }, [question, sessionId, gate, voice, submitAnswer]);

  if (sessionEnded) {
    return (
      <div className="contest-page" style={{ justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏆</div>
          <h2 style={{ marginBottom: '0.5rem' }}>Contest Complete</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>Results are being calculated...</p>
          <button
            onClick={() => navigate(`/hybrid/contest/${contestId}/leaderboard`)}
            style={{ padding: '0.75rem 2rem', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer', fontSize: '1rem' }}
          >
            View Leaderboard
          </button>
        </div>
      </div>
    );
  }

  const qUrgent = timer.questionTimeRemaining > 0 && timer.questionTimeRemaining < 15000;
  const cUrgent = timer.contestTimeRemaining > 0 && timer.contestTimeRemaining < 60000;

  const gateLabel =
    gate.state === 'locked' ? '⏳ Question Incoming...' :
    gate.state === 'open' ? '🎙 Your Turn' : '✅ Submitted';

  return (
    <div className="contest-page">
      <div className="contest-page__header">
        <span className="contest-page__title">
          🏆 Contest Mode
          <span className="contest-no-pause-badge" style={{ marginLeft: '0.75rem' }}>⚠ No Pause</span>
        </span>
        <div className="contest-timers">
          <div className={`contest-timer contest-timer--question${qUrgent ? ' contest-timer--urgent' : ''}`}>
            <div className="contest-timer__label">Question</div>
            <div className="contest-timer__value">{formatMs(timer.questionTimeRemaining)}</div>
          </div>
          <div className={`contest-timer contest-timer--contest${cUrgent ? ' contest-timer--urgent' : ''}`}>
            <div className="contest-timer__label">Total</div>
            <div className="contest-timer__value">{formatMs(timer.contestTimeRemaining)}</div>
          </div>
        </div>
      </div>

      <div className="contest-page__body">
        {error && <div className="hybrid-error-banner">{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <span className={`turn-gate-indicator turn-gate-indicator--${gate.state}`}>
            <span className="turn-gate-indicator__dot" />
            {gateLabel}
          </span>
        </div>

        <div className="hybrid-question-box">
          <div className="hybrid-question-box__label">Question</div>
          <div className="hybrid-question-box__text">
            {question ? question.text : 'Waiting for the contest to begin...'}
          </div>
        </div>

        <div className="hybrid-answer-area">
          <textarea
            className="hybrid-answer-area__textarea"
            placeholder={gate.state === 'locked' ? 'Wait for the question...' : 'Type or speak your answer...'}
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            disabled={gate.state !== 'open'}
          />
          <div className="hybrid-answer-area__controls">
            {voice.isSupported && (
              <button
                className={`hybrid-answer-area__voice-btn${voiceMode ? ' hybrid-answer-area__voice-btn--active' : ''}`}
                onClick={() => {
                  if (!voiceMode) { setVoiceMode(true); if (gate.state === 'open') voice.start(); }
                  else { setVoiceMode(false); voice.stop(); }
                }}
                disabled={gate.state !== 'open'}
              >
                {voiceMode && voice.isListening ? '🔴 Listening' : '🎙 Voice'}
              </button>
            )}
            <button
              className="hybrid-answer-area__submit-btn"
              onClick={handleSubmit}
              disabled={gate.state !== 'open' || !answer.trim()}
            >
              Submit Answer
            </button>
          </div>
        </div>

        {evaluation && (
          <div className="hybrid-eval-panel">
            <div className="hybrid-eval-panel__title">Score</div>
            <div className="hybrid-eval-panel__composite">Composite: {evaluation.compositeScore}/100</div>
            <div className="hybrid-eval-panel__feedback">{evaluation.feedback}</div>
          </div>
        )}
      </div>
    </div>
  );
}
