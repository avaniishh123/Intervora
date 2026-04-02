/**
 * LiveInterviewPage — Real-time interview room for both interviewer and candidate.
 * Interviewer: sees AI question suggestions, sends messages, ends session.
 * Candidate: receives messages, responds, sees timer.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { useLiveSocket, LiveMessage } from '../hooks/useLiveSocket';
import '../styles/LiveInterview.css';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function LiveInterviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as any;

  const role: 'interviewer' | 'candidate' = state?.role ?? 'candidate';
  const jobRole: string = state?.jobRole ?? 'Software Engineer';
  const durationMinutes: number = state?.durationMinutes ?? 25;
  const participantId: string = state?.participantId ?? '';
  const participantName: string = state?.participantName ?? (role === 'interviewer' ? 'Interviewer' : 'Candidate');

  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [notification, setNotification] = useState('');
  const [prevQuestionsAsked, setPrevQuestionsAsked] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages]);

  const handleSessionEnd = useCallback(() => {
    setSessionEnded(true);
    if (role === 'interviewer' && sessionId) {
      navigate(`/live/report/${sessionId}`);
    }
  }, [role, sessionId, navigate]);

  const { sendMessage, emitEnd } = useLiveSocket({
    sessionId: sessionId!,
    participantRole: role,
    participantName,
    onMessage: (msg) => setMessages(prev => [...prev, msg]),
    onSessionEnd: handleSessionEnd,
    onParticipantJoined: (name, r) => setNotification(`${name} (${r}) joined the session`),
    onParticipantLeft: (name) => setNotification(`${name} left the session`),
    onTimerTick: (sLeft) => setSecondsLeft(sLeft),
  });

  // Emit session start via socket when interviewer enters
  useEffect(() => {
    if (role === 'interviewer' && sessionId) {
      // Notify socket to start timer
      // Timer is already started server-side via REST /start, socket just syncs
    }
  }, [role, sessionId]);

  // Clear notification after 4s
  useEffect(() => {
    if (!notification) return;
    const t = setTimeout(() => setNotification(''), 4000);
    return () => clearTimeout(t);
  }, [notification]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !sessionId) return;
    sendMessage(text);
    setInputText('');
    if (role === 'interviewer') {
      setPrevQuestionsAsked(prev => [...prev, text]);
    }
  };

  const handleEndSession = async () => {
    if (!sessionId) return;
    if (!window.confirm('End the session for all participants?')) return;
    try {
      await api.post(`/api/live/sessions/${sessionId}/end`);
    } catch { /* best-effort */ }
    emitEnd();
    handleSessionEnd();
  };

  const handleLeave = async () => {
    if (!window.confirm('Leave the session?')) return;
    try {
      await api.post(`/api/live/sessions/${sessionId}/leave`, { participantId });
    } catch { /* best-effort */ }
    navigate('/');
  };

  const fetchAiSuggestions = async () => {
    if (!sessionId || role !== 'interviewer') return;
    setAiLoading(true);
    try {
      const res = await api.post(`/api/live/sessions/${sessionId}/ai-suggest`, {
        previousQuestions: prevQuestionsAsked,
      });
      setAiSuggestions(res.data.data.suggestions ?? []);
    } catch {
      setAiSuggestions(['Tell me about your experience with ' + jobRole + '.']);
    } finally {
      setAiLoading(false);
    }
  };

  const useSuggestion = (text: string) => {
    setInputText(text);
    setAiSuggestions([]);
  };

  const timerPct = (secondsLeft / (durationMinutes * 60)) * 100;
  const timerColor = timerPct > 40 ? '#10b981' : timerPct > 15 ? '#f59e0b' : '#ef4444';

  if (sessionEnded && role === 'candidate') {
    return (
      <div className="li-page">
        <div className="li-card li-card--center">
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
          <h2 className="li-title">Interview Complete</h2>
          <p className="li-subtitle">
            Thank you for participating. The interviewer will share your performance report shortly.
          </p>
          <button className="li-start-btn" style={{ marginTop: '2rem' }} onClick={() => navigate('/')}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="li-room-page">
      {/* Top bar */}
      <div className="li-room-topbar">
        <div className="li-room-topbar-left">
          <span className="li-room-badge">👤 Human Interview</span>
          <span className="li-room-role">{role === 'interviewer' ? '🎙 Interviewer' : '👨‍💼 Candidate'}</span>
          <span className="li-room-jobrole">{jobRole}</span>
        </div>
        <div className="li-room-topbar-right">
          {/* Timer */}
          <div className="li-room-timer" style={{ color: timerColor }}>
            <svg className="li-timer-ring" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={timerColor} strokeWidth="2.5"
                strokeDasharray={`${timerPct} 100`}
                strokeLinecap="round"
                transform="rotate(-90 18 18)"
              />
            </svg>
            <span className="li-timer-text">{formatTime(secondsLeft)}</span>
          </div>
          {role === 'interviewer' && (
            <button className="li-end-btn" onClick={handleEndSession}>End Session</button>
          )}
          {role === 'candidate' && (
            <button className="li-leave-btn" onClick={handleLeave}>Leave</button>
          )}
        </div>
      </div>

      {notification && (
        <div className="li-notification">{notification}</div>
      )}

      <div className="li-room-body">
        {/* Chat panel */}
        <div className="li-chat-panel">
          <div className="li-chat-header">
            {role === 'interviewer' ? 'Interview Chat — Ask your questions here' : 'Interview Chat'}
          </div>
          <div className="li-chat-messages">
            {messages.length === 0 && (
              <div className="li-chat-empty">
                {role === 'interviewer'
                  ? 'Start the interview by sending your first question below, or use AI suggestions →'
                  : 'Waiting for the interviewer to send the first question…'}
              </div>
            )}
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`li-msg li-msg--${msg.senderRole === role ? 'self' : 'other'}`}
              >
                <div className="li-msg-meta">
                  <span className="li-msg-name">{msg.senderName}</span>
                  <span className="li-msg-role">{msg.senderRole}</span>
                  <span className="li-msg-time">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="li-msg-text">{msg.text}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="li-chat-input-row">
            <textarea
              className="li-chat-input"
              placeholder={role === 'interviewer' ? 'Type a question…' : 'Type your answer…'}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              rows={3}
            />
            <button className="li-send-btn" onClick={handleSend} disabled={!inputText.trim()}>
              Send
            </button>
          </div>
        </div>

        {/* AI Suggestions panel — interviewer only */}
        {role === 'interviewer' && (
          <div className="li-ai-panel">
            <div className="li-ai-header">
              🤖 AI Question Suggestions
              <span className="li-ai-subtitle">Powered by Gemini — only visible to you</span>
            </div>
            <button
              className="li-ai-refresh-btn"
              onClick={fetchAiSuggestions}
              disabled={aiLoading}
            >
              {aiLoading ? '⏳ Generating…' : '✨ Get Suggestions'}
            </button>
            {aiSuggestions.length > 0 && (
              <div className="li-ai-suggestions">
                {aiSuggestions.map((s, i) => (
                  <div key={i} className="li-ai-suggestion" onClick={() => useSuggestion(s)}>
                    <span className="li-ai-suggestion-num">{i + 1}</span>
                    <span className="li-ai-suggestion-text">{s}</span>
                    <span className="li-ai-use-btn">Use →</span>
                  </div>
                ))}
              </div>
            )}
            {aiSuggestions.length === 0 && !aiLoading && (
              <div className="li-ai-empty">
                Click "Get Suggestions" to receive AI-generated questions tailored for <strong>{jobRole}</strong>.
              </div>
            )}
            <div className="li-ai-note">
              💡 Candidates cannot see this panel. Use suggestions as inspiration or send them directly.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
