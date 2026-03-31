import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { usePanelVoice } from '../hooks/usePanelVoice';
import '../styles/CompanyInterview.css';

// ─── Types ────────────────────────────────────────────────────────────────────
type InterviewerKey = 'tech' | 'hiring' | 'hr';

interface Message {
  from: string;
  text: string;
  timestamp: number;
}

interface Company {
  id: string;
  name: string;
  emoji: string;
  tier: string;
  tierColor: string;
  color: string;
  focus: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const COMPANIES: Company[] = [
  { id: 'google',     name: 'Google',         emoji: '🔵', tier: 'FAANG',    tierColor: '#3b82f6', color: '#4285F4', focus: 'System Design, Algorithms, Googliness' },
  { id: 'amazon',     name: 'Amazon',         emoji: '🟠', tier: 'FAANG',    tierColor: '#3b82f6', color: '#FF9900', focus: 'Leadership Principles, DSA, Scalability' },
  { id: 'meta',       name: 'Meta',           emoji: '🔷', tier: 'FAANG',    tierColor: '#3b82f6', color: '#0866FF', focus: 'System Design, Coding, Product Sense' },
  { id: 'apple',      name: 'Apple',          emoji: '🍎', tier: 'FAANG',    tierColor: '#3b82f6', color: '#555555', focus: 'Design, Quality, Innovation' },
  { id: 'netflix',    name: 'Netflix',        emoji: '🔴', tier: 'FAANG',    tierColor: '#3b82f6', color: '#E50914', focus: 'Culture Fit, Ownership, Distributed Systems' },
  { id: 'microsoft',  name: 'Microsoft',      emoji: '🪟', tier: 'Tier-1',   tierColor: '#8b5cf6', color: '#00A4EF', focus: 'Coding, System Design, Growth Mindset' },
  { id: 'tesla',      name: 'Tesla',          emoji: '⚡', tier: 'Tier-1',   tierColor: '#8b5cf6', color: '#CC0000', focus: 'First Principles, Engineering, Speed' },
  { id: 'uber',       name: 'Uber',           emoji: '🚗', tier: 'Tier-1',   tierColor: '#8b5cf6', color: '#000000', focus: 'Reliability, Scale, Real-time Systems' },
  { id: 'airbnb',     name: 'Airbnb',         emoji: '🏠', tier: 'Tier-1',   tierColor: '#8b5cf6', color: '#FF5A5F', focus: 'Product, Culture, Full-stack' },
  { id: 'stripe',     name: 'Stripe',         emoji: '💳', tier: 'Tier-1',   tierColor: '#8b5cf6', color: '#635BFF', focus: 'API Design, Payments, Reliability' },
  { id: 'adobe',      name: 'Adobe',          emoji: '🎨', tier: 'Tier-1',   tierColor: '#8b5cf6', color: '#FF0000', focus: 'Creativity, Cloud, Product' },
  { id: 'salesforce', name: 'Salesforce',     emoji: '☁️', tier: 'Tier-1',   tierColor: '#8b5cf6', color: '#00A1E0', focus: 'CRM, Cloud, Enterprise' },
  { id: 'linkedin',   name: 'LinkedIn',       emoji: '💼', tier: 'Tier-1',   tierColor: '#8b5cf6', color: '#0A66C2', focus: 'Social Graph, Scale, Data' },
  { id: 'twitter',    name: 'X (Twitter)',    emoji: '🐦', tier: 'Tier-1',   tierColor: '#8b5cf6', color: '#1DA1F2', focus: 'Real-time, Scale, Distributed' },
  { id: 'snapchat',   name: 'Snap',           emoji: '👻', tier: 'Tier-1',   tierColor: '#8b5cf6', color: '#FFFC00', focus: 'Mobile, AR, Media' },
  { id: 'spotify',    name: 'Spotify',        emoji: '🎵', tier: 'Tier-2',   tierColor: '#10b981', color: '#1DB954', focus: 'Streaming, Recommendations, Scale' },
  { id: 'shopify',    name: 'Shopify',        emoji: '🛍️', tier: 'Tier-2',   tierColor: '#10b981', color: '#96BF48', focus: 'E-commerce, Merchant Tools, APIs' },
  { id: 'twilio',     name: 'Twilio',         emoji: '📞', tier: 'Tier-2',   tierColor: '#10b981', color: '#F22F46', focus: 'Communications, APIs, Cloud' },
  { id: 'databricks', name: 'Databricks',     emoji: '🧱', tier: 'Tier-2',   tierColor: '#10b981', color: '#FF3621', focus: 'Data Engineering, ML, Spark' },
  { id: 'palantir',   name: 'Palantir',       emoji: '🔮', tier: 'Tier-2',   tierColor: '#10b981', color: '#1A1A1A', focus: 'Data Analysis, Ontology, Defense' },
  { id: 'coinbase',   name: 'Coinbase',       emoji: '🪙', tier: 'Tier-2',   tierColor: '#10b981', color: '#0052FF', focus: 'Blockchain, Crypto, Security' },
  { id: 'openai',     name: 'OpenAI',         emoji: '🤖', tier: 'Tier-2',   tierColor: '#10b981', color: '#412991', focus: 'AI/ML, Research, Safety' },
  { id: 'flipkart',   name: 'Flipkart',       emoji: '🛒', tier: 'India',    tierColor: '#f59e0b', color: '#F74F00', focus: 'E-commerce, Scale, Logistics' },
  { id: 'infosys',    name: 'Infosys',        emoji: '🏢', tier: 'India',    tierColor: '#f59e0b', color: '#007CC3', focus: 'Enterprise, Consulting, Delivery' },
  { id: 'wipro',      name: 'Wipro',          emoji: '🌐', tier: 'India',    tierColor: '#f59e0b', color: '#341C6E', focus: 'IT Services, Cloud, Digital' },
  { id: 'tcs',        name: 'TCS',            emoji: '🔷', tier: 'India',    tierColor: '#f59e0b', color: '#0033A0', focus: 'IT Services, Process, Scale' },
  { id: 'swiggy',     name: 'Swiggy',         emoji: '🍔', tier: 'India',    tierColor: '#f59e0b', color: '#FC8019', focus: 'Hyperlocal, Logistics, Real-time' },
  { id: 'zomato',     name: 'Zomato',         emoji: '🍕', tier: 'India',    tierColor: '#f59e0b', color: '#E23744', focus: 'Food Tech, Delivery, Scale' },
  { id: 'goldman',    name: 'Goldman Sachs',  emoji: '🏦', tier: 'Finance',  tierColor: '#64748b', color: '#6699FF', focus: 'Quantitative, Risk, Trading Systems' },
  { id: 'jpmorgan',   name: 'JPMorgan',       emoji: '💰', tier: 'Finance',  tierColor: '#64748b', color: '#003087', focus: 'FinTech, Risk, Compliance' },
  { id: 'deloitte',   name: 'Deloitte',       emoji: '📊', tier: 'Consult',  tierColor: '#94a3b8', color: '#86BC25', focus: 'Consulting, Strategy, Analytics' },
  { id: 'oracle',     name: 'Oracle',         emoji: '🔴', tier: 'Tier-1',   tierColor: '#8b5cf6', color: '#F80000', focus: 'Database, Cloud, Enterprise' },
];

const INTERVIEWERS: Record<InterviewerKey, { name: string; title: string; abbr: string; color: string; bg: string; focus: string }> = {
  tech:   { name: 'Alex Chen',      title: 'Technical Lead',  abbr: 'TL', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  focus: 'Coding, System Design, Problem Solving' },
  hiring: { name: 'Sarah Mitchell', title: 'Hiring Manager',  abbr: 'HM', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', focus: 'Projects, Decisions, Leadership' },
  hr:     { name: 'James Park',     title: 'HR Specialist',   abbr: 'HR', color: '#10b981', bg: 'rgba(16,185,129,0.15)', focus: 'Culture Fit, Communication, Goals' },
};

const SEQUENCE: InterviewerKey[] = ['tech', 'hiring', 'hr'];

// ─── Component ────────────────────────────────────────────────────────────────
export default function CompanyInterviewPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const role: string     = (location.state as any)?.role     || 'Software Engineer';
  const duration: number = (location.state as any)?.duration || 15;

  // ── Screens: 'select' | 'room' ──────────────────────────────────────────
  const [screen,          setScreen]          = useState<'select' | 'room'>('select');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [search,          setSearch]          = useState('');

  // ── Room state ───────────────────────────────────────────────────────────
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [answer,         setAnswer]         = useState('');
  const [isThinking,     setIsThinking]     = useState(false);
  const [sessionEnded,   setSessionEnded]   = useState(false);
  const [timeRemaining,  setTimeRemaining]  = useState(duration * 60);
  const [timerActive,    setTimerActive]    = useState(false);
  const [currentPhase,   setCurrentPhase]   = useState(0);
  const [cameraStream,   setCameraStream]   = useState<MediaStream | null>(null);
  const [cameraError,    setCameraError]    = useState(false);
  const [sidebarOpen,    setSidebarOpen]    = useState(true);

  const cameraRef       = useRef<HTMLVideoElement | null>(null);
  const chatEndRef      = useRef<HTMLDivElement>(null);
  const timerRef        = useRef<number | null>(null);
  const answerRef       = useRef<HTMLTextAreaElement>(null);
  const sessionEndedRef = useRef(false);

  // ── Panel voice system (distinct voice per interviewer + STT) ────────────
  const {
    isSpeaking,
    activeVoiceSpeaker,
    isListening,
    transcript,
    responseMode,
    voiceSupported,
    sttSupported,
    error: voiceError,
    speakAs,
    cancelSpeech,
    startListening,
    stopListening,
    clearTranscript,
    setResponseMode,
    cleanup: cleanupVoice,
  } = usePanelVoice();

  // Sync STT transcript → answer textarea
  useEffect(() => {
    if (responseMode === 'voice' && transcript) setAnswer(transcript);
  }, [transcript, responseMode]);

  // ── Camera ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'room') return;
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(s => { setCameraStream(s); setCameraError(false); })
      .catch(() => setCameraError(true));
    return () => { cameraStream?.getTracks().forEach(t => t.stop()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const attachCamera = useCallback((video: HTMLVideoElement | null) => {
    cameraRef.current = video;
    if (video && cameraStream) { video.srcObject = cameraStream; video.play().catch(() => {}); }
  }, [cameraStream]);

  useEffect(() => {
    const v = cameraRef.current;
    if (v && cameraStream) { v.srcObject = cameraStream; v.play().catch(() => {}); }
  }, [cameraStream]);

  // ── Timer ────────────────────────────────────────────────────────────────
  const handleEnd = useCallback(() => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    setSessionEnded(true);
    setTimerActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    cameraStream?.getTracks().forEach(t => t.stop());
    cancelSpeech();
    cleanupVoice();
    setTimeout(() => navigate('/dashboard'), 3000);
  }, [cameraStream, navigate, cancelSpeech, cleanupVoice]);

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

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // ── Start room ───────────────────────────────────────────────────────────
  const startRoom = useCallback(() => {
    if (!selectedCompany) return;
    setScreen('room');
    setTimerActive(true);
    const welcome = `Welcome to your ${selectedCompany.name} interview for the ${role} role. You'll be interviewed by ${INTERVIEWERS.tech.name} (Technical Lead), ${INTERVIEWERS.hiring.name} (Hiring Manager), and ${INTERVIEWERS.hr.name} (HR Specialist). Answer each question thoroughly — the panel may cross-question you. Good luck!`;
    setMessages([{ from: 'system', text: welcome, timestamp: Date.now() }]);
    setTimeout(() => askQuestion('tech'), 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany, role]);

  // ── Ask question ─────────────────────────────────────────────────────────
  const askQuestion = useCallback(async (key: InterviewerKey) => {
    setIsThinking(true);
    try {
      const res = await api.post('/api/gemini/company-questions', {
        company: selectedCompany?.id || 'google',
        companyName: selectedCompany?.name || 'Google',
        role,
        interviewerType: key,
        count: 1,
      });
      const q: string = res.data?.data?.questions?.[0] || fallbackQuestion(key, role);
      setTimeout(() => {
        setIsThinking(false);
        setMessages(m => [...m, { from: key, text: q, timestamp: Date.now() }]);
        // Speak the question in the interviewer's distinct voice
        speakAs(key, q, () => setTimeout(() => answerRef.current?.focus(), 150));
      }, 600);
    } catch {
      const q = fallbackQuestion(key, role);
      setTimeout(() => {
        setIsThinking(false);
        setMessages(m => [...m, { from: key, text: q, timestamp: Date.now() }]);
        speakAs(key, q, () => setTimeout(() => answerRef.current?.focus(), 150));
      }, 600);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany, role, speakAs]);

  // ── Submit answer ────────────────────────────────────────────────────────
  const handleSubmit = useCallback(() => {
    const text = answer.trim();
    if (!text || sessionEnded) return;
    cancelSpeech();                    // interrupt interviewer if still speaking
    if (responseMode === 'voice') { stopListening(); clearTranscript(); }
    setMessages(prev => [...prev, { from: 'candidate', text, timestamp: Date.now() }]);
    setAnswer('');
    const next = currentPhase + 1;
    setCurrentPhase(next);
    if (next >= SEQUENCE.length * 2) {
      setTimeout(handleEnd, 1000);
    } else {
      setTimeout(() => askQuestion(SEQUENCE[next % SEQUENCE.length]), 800);
    }
  }, [answer, currentPhase, sessionEnded, askQuestion, handleEnd, cancelSpeech, stopListening, clearTranscript, responseMode]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const pct = Math.round((timeRemaining / (duration * 60)) * 100);
  const timerColor = timeRemaining > 120 ? '#3b82f6' : timeRemaining > 60 ? '#f59e0b' : '#ef4444';
  const activeKey  = SEQUENCE[currentPhase % SEQUENCE.length];
  const filtered   = COMPANIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.tier.toLowerCase().includes(search.toLowerCase())
  );

  // ════════════════════════════════════════════════════════════════════════
  // SCREEN 1 — Company Selection
  // ════════════════════════════════════════════════════════════════════════
  if (screen === 'select') {
    return (
      <div className="ci-select-page">
        <div className="ci-select-header">
          <div className="ci-select-back" onClick={() => navigate(-1)}>← Back</div>
          <div className="ci-select-title">
            <span className="ci-select-icon">🏢</span>
            <h1>Company-Specific Interview</h1>
            <p>Choose a company to simulate their real interview style for <strong>{role}</strong></p>
          </div>
        </div>

        <div className="ci-search-wrap">
          <span className="ci-search-icon">🔍</span>
          <input
            className="ci-search-input"
            placeholder="Search companies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="ci-search-clear" onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        <div className="ci-company-grid">
          {filtered.length === 0 && <div className="ci-no-results">No companies found for "{search}"</div>}
          {filtered.map(c => (
            <button
              key={c.id}
              className={'ci-company-card' + (selectedCompany?.id === c.id ? ' selected' : '')}
              style={{ '--cc': c.color } as React.CSSProperties}
              onClick={() => setSelectedCompany(c)}
            >
              {selectedCompany?.id === c.id && <span className="ci-co-check">✓</span>}
              <span className="ci-co-emoji">{c.emoji}</span>
              <span className="ci-co-name">{c.name}</span>
              <span className="ci-co-tier" style={{ color: c.tierColor }}>{c.tier}</span>
            </button>
          ))}
        </div>

        <div className="ci-select-footer">
          {selectedCompany ? (
            <>
              <div className="ci-selected-preview">
                <span>{selectedCompany.emoji}</span>
                <span>{selectedCompany.name}</span>
                <span className="ci-selected-role">· {role} · {duration} min</span>
              </div>
              <button className="ci-start-btn" onClick={startRoom}>
                Start Interview →
              </button>
            </>
          ) : (
            <span style={{ color: '#475569', fontSize: 14 }}>Select a company to begin</span>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // SCREEN 2 — Interview Room
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="ci-room">
      {/* ── Top Bar ── */}
      <header className="ci-topbar">
        <div className="ci-topbar-left">
          <span className="ci-mode-badge" style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}>
            {selectedCompany?.emoji} {selectedCompany?.name}
          </span>
          <span className="ci-role-chip">{role}</span>
          <span className="ci-round-indicator">
            Round <strong>{Math.min(currentPhase + 1, SEQUENCE.length * 2)}</strong> / {SEQUENCE.length * 2}
          </span>
        </div>

        <div className="ci-topbar-center">
          <div className="ci-timer-ring">
            <svg viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="#1e293b" strokeWidth="4" />
              <circle cx="24" cy="24" r="20" fill="none" stroke={timerColor} strokeWidth="4"
                strokeDasharray={`${(pct / 100) * 125.6} 125.6`} strokeLinecap="round"
                transform="rotate(-90 24 24)" style={{ transition: 'stroke-dasharray 1s linear' }} />
            </svg>
            <span style={{ color: timerColor }}>{fmt(timeRemaining)}</span>
          </div>
        </div>

        <div>
          <button className="ci-end-btn" onClick={handleEnd}>End Interview</button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="ci-body">
        {/* ── Left Sidebar ── */}
        <aside className={`ci-left${sidebarOpen ? '' : ' ci-left--collapsed'}`}>
          <button className="ci-collapse-btn" onClick={() => setSidebarOpen(o => !o)}>
            {sidebarOpen ? '‹' : '›'}
          </button>

          {sidebarOpen && (
            <>
              <div style={{ padding: '44px 0 8px' }}>
                <div className="ci-section-label">Panel Members</div>
              </div>

              {SEQUENCE.map(key => {
                const iv = INTERVIEWERS[key];
                const isActive = activeKey === key && !sessionEnded;
                const isSpeakingNow = activeVoiceSpeaker === key && isSpeaking;
                return (
                  <div key={key} className={`ci-iv-card${isActive ? ' active' : ''}`}
                    style={{ '--ic': iv.color } as React.CSSProperties}>
                    <div className="ci-iv-avatar" style={{ background: iv.bg, color: iv.color }}>
                      {iv.abbr}
                    </div>
                    <div className="ci-iv-info">
                      <div className="ci-iv-name">{iv.name}</div>
                      <div className="ci-iv-title" style={{ color: iv.color }}>{iv.title}</div>
                    </div>
                    {isSpeakingNow && (
                      <span className="ci-speaking-pill" style={{ background: `${iv.color}22`, border: `1px solid ${iv.color}55`, color: iv.color }}>
                        <span className="ci-wave"><span /><span /><span /></span>
                      </span>
                    )}
                    {isActive && isThinking && !isSpeakingNow && (
                      <div className="ci-dots"><span /><span /><span /></div>
                    )}
                  </div>
                );
              })}

              <div style={{ marginTop: 'auto', padding: '16px 0 0' }}>
                <div className="ci-section-label">You</div>
                <div className={`ci-camera-wrap${isListening ? ' ci-camera-wrap--listening' : ''}`}>
                  {cameraError ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 12, flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 24 }}>📷</span>
                      <span>Camera off</span>
                    </div>
                  ) : (
                    <video ref={attachCamera} autoPlay playsInline muted
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                  )}
                </div>
              </div>
            </>
          )}

          {!sidebarOpen && (
            <div style={{ paddingTop: 52 }}>
              {SEQUENCE.map(key => {
                const iv = INTERVIEWERS[key];
                const isActive = activeKey === key && !sessionEnded;
                return (
                  <div key={key} className="ci-collapsed-avatar"
                    style={{ background: isActive ? iv.bg : '#1e293b', color: isActive ? iv.color : '#475569', marginBottom: 8 }}>
                    {iv.abbr}
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        {/* ── Main Workspace ── */}
        <main className="ci-workspace">
          <div className="ci-chat-area">
            {messages.map((m, i) => {
              const iv = m.from in INTERVIEWERS ? INTERVIEWERS[m.from as InterviewerKey] : null;
              if (m.from === 'system') {
                return (
                  <div key={i} className="ci-msg ci-msg--system">
                    <div className="ci-msg-bubble">{m.text}</div>
                  </div>
                );
              }
              if (m.from === 'candidate') {
                return (
                  <div key={i} className="ci-msg ci-msg--candidate">
                    <div className="ci-msg-content">
                      <div className="ci-msg-bubble">{m.text}</div>
                    </div>
                  </div>
                );
              }
              return (
                <div key={i} className="ci-msg ci-msg--interviewer">
                  <div className="ci-msg-avatar" style={{ background: iv?.bg, color: iv?.color }}>
                    {iv?.abbr}
                  </div>
                  <div className="ci-msg-content">
                    <div className="ci-msg-meta">
                      <span className="ci-msg-name">{iv?.name}</span>
                      <span className="ci-msg-title" style={{ color: iv?.color }}>{iv?.title}</span>
                    </div>
                    <div className="ci-msg-bubble">{m.text}</div>
                  </div>
                </div>
              );
            })}

            {isThinking && (
              <div className="ci-msg ci-msg--interviewer">
                <div className="ci-msg-avatar"
                  style={{ background: INTERVIEWERS[activeKey].bg, color: INTERVIEWERS[activeKey].color }}>
                  {INTERVIEWERS[activeKey].abbr}
                </div>
                <div className="ci-msg-content">
                  <div className="ci-typing-indicator"><span /><span /><span /></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* ── Answer Area ── */}
          {!sessionEnded && (
            <div className="ci-answer-area">
              <div className="ci-mode-toggle">
                <button className={`ci-mode-tab${responseMode === 'text' ? ' active' : ''}`}
                  onClick={() => { setResponseMode('text'); }}>
                  Text
                </button>
                <button
                  className={`ci-mode-tab${responseMode === 'voice' ? ' active' : ''}`}
                  disabled={!sttSupported}
                  title={!sttSupported ? 'Speech recognition not supported in this browser' : undefined}
                  onClick={() => setResponseMode('voice')}>
                  Voice {!sttSupported && '(unavailable)'}
                </button>
              </div>

              <div className="ci-input-wrap">
                <textarea
                  ref={answerRef}
                  className={`ci-answer-input${responseMode === 'voice' ? ' ci-answer-input--voice' : ''}`}
                  value={answer}
                  onChange={e => { if (responseMode === 'text') setAnswer(e.target.value); }}
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSubmit(); }}
                  placeholder={responseMode === 'voice' ? 'Click the mic to speak your answer...' : 'Type your answer here... (Ctrl+Enter to submit)'}
                  rows={4}
                  readOnly={responseMode === 'voice' && isListening}
                />
                {responseMode === 'voice' && (
                  <button
                    className={`ci-mic-btn${isListening ? ' ci-mic-btn--active' : ''}`}
                    onClick={() => isListening ? stopListening() : startListening()}
                    disabled={isSpeaking}
                    title={isSpeaking ? 'Wait for interviewer to finish speaking' : isListening ? 'Stop recording' : 'Start recording'}
                  >
                    {isListening && <span className="ci-mic-pulse" />}
                    {isListening ? '🔴' : '🎤'}
                  </button>
                )}
              </div>

              {voiceError && <div className="ci-voice-error">{voiceError}</div>}

              <div className="ci-answer-footer">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="ci-answer-hint">
                    {responseMode === 'voice' ? 'Speak clearly · Ctrl+Enter to submit' : 'Ctrl+Enter to submit · Be specific and structured'}
                  </span>
                  {isListening && (
                    <span className="ci-listening-pill">
                      <span className="ci-wave"><span /><span /><span /></span>
                      Listening...
                    </span>
                  )}
                  {isSpeaking && (
                    <span className="ci-speaking-pill" style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.35)', color: '#3b82f6' }}>
                      <span className="ci-wave"><span /><span /><span /></span>
                      {INTERVIEWERS[activeVoiceSpeaker as InterviewerKey]?.name ?? 'Interviewer'} speaking...
                    </span>
                  )}
                </div>
                <button className="ci-submit-btn"
                  style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}
                  onClick={handleSubmit}
                  disabled={!answer.trim() || isSpeaking}>
                  Submit Answer
                </button>
              </div>
            </div>
          )}

          {sessionEnded && (
            <div className="ci-ended-banner">
              ✅ Interview complete — great effort! Returning to dashboard...
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Fallback questions ───────────────────────────────────────────────────────
function fallbackQuestion(key: InterviewerKey, role: string): string {
  const q: Record<InterviewerKey, string[]> = {
    tech: [
      `Walk me through how you would design a scalable system for a ${role} position.`,
      `What's the time complexity of your approach to solving a two-sum problem?`,
      `Explain the difference between horizontal and vertical scaling.`,
    ],
    hiring: [
      `Tell me about a challenging project you led as a ${role}.`,
      `Describe a time you had to make a difficult technical decision under pressure.`,
      `How do you prioritize tasks when everything seems urgent?`,
    ],
    hr: [
      `Why are you interested in this company specifically?`,
      `Where do you see yourself in 5 years as a ${role}?`,
      `How do you handle disagreements with teammates?`,
    ],
  };
  const arr = q[key];
  return arr[Math.floor(Math.random() * arr.length)];
}
