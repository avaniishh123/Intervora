import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useHybridSocket } from '../hooks/useHybridSocket';
import { HybridEvaluationResult } from '../types/hybrid.types';
import '../styles/InterviewerPanel.css';

interface SentQuestion {
  questionId: string;
  text: string;
  sentAt: string;
}

export default function InterviewerPanelPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  // Role guard
  useEffect(() => {
    if (user && (user.role as string) !== 'interviewer' && user.role !== 'admin') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const [questionText, setQuestionText] = useState('');
  const [sentQuestions, setSentQuestions] = useState<SentQuestion[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [evaluation, setEvaluation] = useState<HybridEvaluationResult | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const questionIdCounter = useRef(0);

  const { joinSession, sendQuestion, endSession } = useHybridSocket({
    onLiveTranscript: (text) => setLiveTranscript(text),
    onEvaluationResult: (r) => setEvaluation(r),
    onSessionEnd: () => setSessionEnded(true),
  });

  useEffect(() => {
    if (sessionId) joinSession(sessionId, 'interviewer');
  }, [sessionId, joinSession]);

  function handleSend() {
    if (!questionText.trim() || !sessionId) return;
    const questionId = `q_${Date.now()}_${questionIdCounter.current++}`;
    sendQuestion(sessionId, questionText.trim(), questionId);
    setSentQuestions(prev => [...prev, {
      questionId,
      text: questionText.trim(),
      sentAt: new Date().toLocaleTimeString(),
    }]);
    setQuestionText('');
    setLiveTranscript('');
    setEvaluation(null);
  }

  function handleEnd() {
    if (!sessionId) return;
    if (window.confirm('End this interview session?')) {
      endSession(sessionId);
    }
  }

  if (sessionEnded) {
    return (
      <div className="interviewer-panel" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏁</div>
          <h2>Session Ended</h2>
          <button onClick={() => navigate('/dashboard')} style={{ marginTop: '1.5rem', padding: '0.75rem 2rem', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer' }}>
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="interviewer-panel">
      <div className="interviewer-panel__header">
        <span className="interviewer-panel__title">Interviewer Panel</span>
        <span className="interviewer-panel__badge">Human Interviewer</span>
      </div>

      <div className="interviewer-panel__grid">
        {/* Left: send question + log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="interviewer-panel__section">
            <div className="interviewer-panel__section-title">Send Question</div>
            <textarea
              className="interviewer-panel__question-input"
              placeholder="Type your question here..."
              value={questionText}
              onChange={e => setQuestionText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSend(); }}
            />
            <button
              className="interviewer-panel__send-btn"
              onClick={handleSend}
              disabled={!questionText.trim()}
            >
              Send Question (Ctrl+Enter)
            </button>
          </div>

          <div className="interviewer-panel__section" style={{ flex: 1 }}>
            <div className="interviewer-panel__section-title">Sent Questions</div>
            <div className="interviewer-panel__log">
              {sentQuestions.length === 0 && (
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.9rem' }}>No questions sent yet.</span>
              )}
              {sentQuestions.map(q => (
                <div key={q.questionId} className="interviewer-panel__log-item">
                  {q.text}
                  <div className="interviewer-panel__log-item__time">{q.sentAt}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: live transcript + evaluation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="interviewer-panel__section" style={{ flex: 1 }}>
            <div className="interviewer-panel__section-title">Candidate Live Transcript</div>
            <div className={`interviewer-panel__transcript${!liveTranscript ? ' interviewer-panel__transcript--empty' : ''}`}>
              {liveTranscript || 'Waiting for candidate to speak...'}
            </div>
          </div>

          {evaluation && (
            <div className="interviewer-panel__section">
              <div className="interviewer-panel__section-title">AI Evaluation</div>
              <div className="interviewer-panel__eval">
                <div className="interviewer-panel__eval-score">
                  <div className="interviewer-panel__eval-score__label">Technical</div>
                  <div className="interviewer-panel__eval-score__value">{evaluation.technicalScore}</div>
                </div>
                <div className="interviewer-panel__eval-score">
                  <div className="interviewer-panel__eval-score__label">Clarity</div>
                  <div className="interviewer-panel__eval-score__value">{evaluation.clarityScore}</div>
                </div>
                <div className="interviewer-panel__eval-score">
                  <div className="interviewer-panel__eval-score__label">Depth</div>
                  <div className="interviewer-panel__eval-score__value">{evaluation.depthScore}</div>
                </div>
                <div className="interviewer-panel__eval-score">
                  <div className="interviewer-panel__eval-score__label">Confidence</div>
                  <div className="interviewer-panel__eval-score__value">{evaluation.confidenceScore}</div>
                </div>
              </div>
              <div style={{ marginTop: '0.75rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                Composite: <strong style={{ color: '#10b981' }}>{evaluation.compositeScore}/100</strong>
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                {evaluation.feedback}
              </div>
            </div>
          )}
        </div>
      </div>

      <button className="interviewer-panel__end-btn" onClick={handleEnd}>
        End Session
      </button>
    </div>
  );
}
