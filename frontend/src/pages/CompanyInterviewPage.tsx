import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import '../styles/CompanyInterview.css';

type InterviewerType = 'tech' | 'hiring' | 'hr';

interface Message {
  from: string;
  text: string;
  timestamp: number;
}

const COMPANY_ARCHETYPES = [
  { id: 'product',  label: 'Product Company',  description: 'Focus on scalability, user impact, and product thinking', color: '#3b82f6' },
  { id: 'service',  label: 'Service Company',  description: 'Focus on client delivery, process, and domain expertise',  color: '#8b5cf6' },
  { id: 'startup',  label: 'Startup',           description: 'Focus on ownership, speed, and cross-functional skills',   color: '#10b981' },
];

const INTERVIEWER_PERSONAS: Record<InterviewerType, { name: string; title: string; avatar: string }> = {
  tech:   { name: 'Alex Chen',      title: 'Technical Lead',  avatar: 'TL' },
  hiring: { name: 'Sarah Mitchell', title: 'Hiring Manager',  avatar: 'HM' },
  hr:     { name: 'James Park',     title: 'HR Specialist',   avatar: 'HR' },
};

const SEQUENCE: InterviewerType[] = ['tech', 'hiring', 'hr'];

export default function CompanyInterviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const role: string     = (location.state as any)?.role     || 'Software Engineer';
  const duration: number = (location.state as any)?.duration || 15;

  const [sessionId,      setSessionId]      = useState<string | null>(null);
  const [authReady,      setAuthReady]      = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [selectedArchetype, setSelectedArchetype] = useState<string>('product');
  const [archetypeConfirmed, setArchetypeConfirmed] = useState(false);
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [answer,         setAnswer]         = useState('');
  const [isThinking,     setIsThinking]     = useState(false);
  const [sessionEnded,   setSessionEnded]   = useState(false);
  const [timeRemaining,  setTimeRemaining]  = useState(duration * 60);
  const [timerActive,    setTimerActive]    = useState(false);
  const [currentPhase,   setCurrentPhase]   = useState(0);
  const [cameraStream,   setCameraStream]   = useState<MediaStream | null>(null);

  const cameraRef    = useRef<HTMLVideoElement | null>(null);
  const chatEndRef   = useRef<HTMLDivElement>(null);
  const timerRef     = useRef<number | null>(null);
  const answerRef    = useRef<HTMLTextAreaElement>(null);
  const sessionEndedRef = useRef(false);

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { navigate('/login'); return; }
    api.get('/auth/profile')
      .then(() => setAuthReady(true))
      .catch(() => navigate('/login'));
  }, [navigate]);

  // Camera
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(s => setCameraStream(s))
      .catch(() => {});
    return () => { cameraStream?.getTracks().forEach(t => t.stop()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attachCamera = useCallback((video: HTMLVideoElement | null) => {
    cameraRef.current = video;
    if (video && cameraStream) {
      video.srcObject = cameraStream;
      video.play().catch(() => {});
    }
  }, [cameraStream]);

  useEffect(() => {
    const video = cameraRef.current;
    if (video && cameraStream) {
      video.srcObject = cameraStream;
      video.play().catch(() => {});
    }
  }, [cameraStream]);

  // Create session
  useEffect(() => {
    if (!authReady || !archetypeConfirmed) return;
    api.post('/api/sessions', { jobRole: role, mode: 'general', duration })
      .then(res => {
        setSessionId(res.data.data?.sessionId || res.data.data?._id || 'company-' + Date.now());
        setSessionStarted(true);
        setTimerActive(true);
      })
      .catch(() => {
        setSessionId('company-' + Date.now());
        setSessionStarted(true);
        setTimerActive(true);
      });
  }, [authReady, archetypeConfirmed, role, duration]);

  // Welcome + first question
  useEffect(() => {
    if (!sessionStarted) return;
    const archetype = COMPANY_ARCHETYPES.find(a => a.id === selectedArchetype);
    const welcome = `Welcome to your ${archetype?.label || 'Company'} interview for the ${role} role. I'm ${INTERVIEWER_PERSONAS.tech.name}, your Technical Lead. Let's begin.`;
    setMessages([{ from: 'system', text: welcome, timestamp: Date.now() }]);
    setTimeout(() => askQuestion('tech'), 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStarted]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Timer
  const handleEnd = useCallback(() => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    setSessionEnded(true);
    setTimerActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    cameraStream?.getTracks().forEach(t => t.stop());
    setTimeout(() => navigate('/dashboard'), 2000);
  }, [cameraStream, navigate]);

  const handleEndRef = useRef(handleEnd);
  useEffect(() => { handleEndRef.current = handleEnd; }, [handleEnd]);

  useEffect(() => {
    if (!timerActive) return;
    timerRef.current = window.setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); handleEndRef.current(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive]);

  const askQuestion = useCallback(async (interviewerType: InterviewerType) => {
    setIsThinking(true);
    try {
      const res = await api.post('/api/gemini/company-questions', {
        company: selectedArchetype,
        role,
        interviewerType,
        count: 1,
      });
      const questions: string[] = res.data?.data?.questions || [];
      const questionText = questions[0] || `Tell me about your experience with ${role}.`;
      setTimeout(() => {
        setIsThinking(false);
        setMessages(m => [...m, { from: interviewerType, text: questionText, timestamp: Date.now() }]);
        setTimeout(() => answerRef.current?.focus(), 200);
      }, 800);
    } catch {
      setTimeout(() => {
        setIsThinking(false);
        const fallback = `Can you walk me through a challenging project you worked on as a ${role}?`;
        setMessages(m => [...m, { from: interviewerType, text: fallback, timestamp: Date.now() }]);
        setTimeout(() => answerRef.current?.focus(), 200);
      }, 800);
    }
  }, [selectedArchetype, role]);

  const handleSubmitAnswer = useCallback(() => {
    const text = answer.trim();
    if (!text || sessionEnded) return;
    setMessages(prev => [...prev, { from: 'candidate', text, timestamp: Date.now() }]);
    setAnswer('');
    const nextPhase = currentPhase + 1;
    setCurrentPhase(nextPhase);
    if (nextPhase >= SEQUENCE.length * 2) {
      setTimeout(handleEnd, 1000);
    } else {
      const nextInterviewer = SEQUENCE[nextPhase % SEQUENCE.length];
      setTimeout(() => askQuestion(nextInterviewer), 800);
    }
  }, [answer, currentPhase, sessionEnded, askQuestion, handleEnd]);

  const formatTime = (s: number) =>
    String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

  const timerPct   = Math.round((timeRemaining / (duration * 60)) * 100);
  const timerColor = timeRemaining > 120 ? '#3b82f6' : timeRemaining > 60 ? '#f59e0b' : '#ef4444';

  // Archetype selection screen
  if (!archetypeConfirmed) {
    return (
      <div className="company-interview-container">
        <div className="company-setup-card">
          <h1 className="company-setup-title">Company-Specific Interview</h1>
          <p className="company-setup-subtitle">Select the company archetype to tailor your interview experience</p>
          <div className="company-archetype-grid">
            {COMPANY_ARCHETYPES.map(a => (
              <div
                key={a.id}
                className={'company-archetype-card' + (selectedArchetype === a.id ? ' selected' : '')}
                style={{ borderColor: selectedArchetype === a.id ? a.color : 'transparent' }}
                onClick={() => setSelectedArchetype(a.id)}
              >
                <div className="company-archetype-label" style={{ color: a.color }}>{a.label}</div>
                <div className="company-archetype-desc">{a.description}</div>
              </div>
            ))}
          </div>
          <div className="company-setup-meta">
            <span>Role: <strong>{role}</strong></span>
            <span>Duration: <strong>{duration} min</strong></span>
          </div>
          <button
            className="company-start-btn"
            onClick={() => setArchetypeConfirmed(true)}
          >
            Start Interview
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="company-interview-container">
      <header className="company-topbar">
        <div className="company-topbar-left">
          <span className="company-mode-badge">Company Interview</span>
          <span className="company-role-chip">{role}</span>
          <span className="company-archetype-chip">
            {COMPANY_ARCHETYPES.find(a => a.id === selectedArchetype)?.label}
          </span>
        </div>
        <div className="company-topbar-center">
          <div className="company-timer" style={{ color: timerColor }}>
            <svg viewBox="0 0 44 44" width="44" height="44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="#1e293b" strokeWidth="4" />
              <circle cx="22" cy="22" r="18" fill="none" stroke={timerColor} strokeWidth="4"
                strokeDasharray={String((timerPct / 100) * 113) + ' 113'} strokeLinecap="round"
                transform="rotate(-90 22 22)" style={{ transition: 'stroke-dasharray 1s linear' }} />
            </svg>
            <span>{formatTime(timeRemaining)}</span>
          </div>
        </div>
        <div className="company-topbar-right">
          <button className="company-end-btn" onClick={handleEnd}>End Interview</button>
        </div>
      </header>

      <div className="company-body">
        <aside className="company-sidebar">
          <div className="company-sidebar-section">
            <div className="company-sidebar-label">Interviewers</div>
            {SEQUENCE.map(type => {
              const p = INTERVIEWER_PERSONAS[type];
              const isActive = SEQUENCE[currentPhase % SEQUENCE.length] === type && sessionStarted && !sessionEnded;
              return (
                <div key={type} className={'company-interviewer-card' + (isActive ? ' active' : '')}>
                  <div className="company-interviewer-avatar">{p.avatar}</div>
                  <div>
                    <div className="company-interviewer-name">{p.name}</div>
                    <div className="company-interviewer-title">{p.title}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="company-sidebar-section">
            <div className="company-sidebar-label">You</div>
            <div className="company-camera-wrap">
              <video
                ref={attachCamera}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', borderRadius: '8px', background: '#0f172a' }}
              />
            </div>
          </div>
        </aside>

        <main className="company-main">
          <div className="company-chat-area">
            {messages.map((m, i) => {
              const persona = m.from in INTERVIEWER_PERSONAS
                ? INTERVIEWER_PERSONAS[m.from as InterviewerType]
                : null;
              return (
                <div key={i} className={'company-msg company-msg--' + (m.from === 'candidate' ? 'candidate' : m.from === 'system' ? 'system' : 'interviewer')}>
                  {persona && (
                    <div className="company-msg-avatar">{persona.avatar}</div>
                  )}
                  <div className="company-msg-content">
                    {persona && (
                      <div className="company-msg-meta">
                        <span className="company-msg-name">{persona.name}</span>
                        <span className="company-msg-title">{persona.title}</span>
                      </div>
                    )}
                    <div className="company-msg-bubble">{m.text}</div>
                  </div>
                </div>
              );
            })}
            {isThinking && (
              <div className="company-msg company-msg--interviewer">
                <div className="company-msg-avatar">
                  {INTERVIEWER_PERSONAS[SEQUENCE[currentPhase % SEQUENCE.length]].avatar}
                </div>
                <div className="company-msg-content">
                  <div className="company-typing-indicator"><span /><span /><span /></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {!sessionEnded && (
            <div className="company-answer-area">
              <textarea
                ref={answerRef}
                className="company-answer-input"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSubmitAnswer(); }}
                placeholder="Type your answer here... (Ctrl+Enter to submit)"
                rows={4}
              />
              <div className="company-answer-footer">
                <span className="company-answer-hint">Ctrl+Enter to submit</span>
                <button
                  className="company-submit-btn"
                  onClick={handleSubmitAnswer}
                  disabled={!answer.trim()}
                >
                  Submit Answer
                </button>
              </div>
            </div>
          )}

          {sessionEnded && (
            <div className="company-ended-msg">
              <p>Interview complete. Returning to dashboard...</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
