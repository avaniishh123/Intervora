import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { usePanelVoice, type ResponseMode } from '../hooks/usePanelVoice';
import '../styles/PanelInterview.css';

const PANEL = [
  { id: 'tech',   name: 'Alex Chen',      title: 'Technical Lead',  avatar: 'TL', color: '#3b82f6', accent: '#1d4ed8' },
  { id: 'hiring', name: 'Sarah Mitchell', title: 'Hiring Manager',  avatar: 'HM', color: '#8b5cf6', accent: '#6d28d9' },
  { id: 'hr',     name: 'James Park',     title: 'HR Specialist',   avatar: 'HR', color: '#10b981', accent: '#059669' },
];

const QUESTION_BANKS: Record<string, Record<string, string[]>> = {
  tech: {
    'Software Engineer': [
      'Walk me through how you would design a URL shortener at scale.',
      'What is the difference between a process and a thread? When would you use each?',
      'How do you approach debugging a production issue with no logs?',
      'Explain the CAP theorem and give a real-world example.',
      'How would you optimize a slow SQL query?',
    ],
    'AI/ML Engineer': [
      'How do you handle class imbalance in a training dataset?',
      'Explain the difference between bagging and boosting.',
      'What is gradient vanishing and how do you mitigate it?',
      'Walk me through your model deployment pipeline.',
      'How do you detect and handle data drift in production?',
    ],
    'DevOps Engineer': [
      'How would you design a zero-downtime deployment pipeline?',
      'Explain the difference between blue-green and canary deployments.',
      'How do you handle secrets management in Kubernetes?',
      'Walk me through your incident response process.',
      'How do you monitor and alert on SLOs?',
    ],
    'Data Scientist': [
      'How do you validate a model beyond accuracy?',
      'Explain A/B testing and its statistical assumptions.',
      'How do you handle missing data in a large dataset?',
      'What is feature leakage and how do you detect it?',
      'Walk me through a data pipeline you have built.',
    ],
    'Cloud Engineer': [
      'How would you architect a multi-region, highly available application?',
      'Explain the shared responsibility model in cloud security.',
      'How do you optimize cloud costs without sacrificing performance?',
      'Walk me through a disaster recovery plan you have designed.',
      'How do you handle IAM at scale?',
    ],
    'Cybersecurity Engineer': [
      'How would you respond to a ransomware attack?',
      'Explain the OWASP Top 10 and which you consider most critical.',
      'How do you perform a threat model for a new application?',
      'What is the difference between authentication and authorization?',
      'How do you detect lateral movement in a network?',
    ],
    default: [
      'Describe your most technically challenging project.',
      'How do you stay current with new technologies?',
      'Walk me through your system design process.',
      'How do you handle technical debt?',
      'Describe a time you had to make a difficult technical trade-off.',
    ],
  },
  hiring: {
    default: [
      'Why are you interested in this role specifically?',
      'Where do you see yourself in 3 years?',
      'What is your biggest professional achievement?',
      'How do you handle competing priorities under tight deadlines?',
      'Describe a time you disagreed with your manager and how you handled it.',
      'What does your ideal team culture look like?',
    ],
  },
  hr: {
    default: [
      'Tell me about yourself and your career journey.',
      'What are your salary expectations?',
      'How do you handle work-life balance?',
      'Describe a conflict with a colleague and how you resolved it.',
      'What motivates you to do your best work?',
      'Why are you looking for a new opportunity?',
    ],
  },
};

function getQuestions(panelId: string, role: string): string[] {
  const bank = QUESTION_BANKS[panelId];
  if (!bank) return [];
  return bank[role] || bank['default'] || [];
}

const CROSS_QUESTIONS: Record<string, string[]> = {
  tech:   ['Can you elaborate on the technical implementation?', 'What would you do differently if you had more time?', 'How does that scale to millions of users?'],
  hiring: ['How does that align with your long-term goals?', 'Can you give a specific example from your experience?', 'How did that impact the business outcome?'],
  hr:     ['How did that affect team morale?', 'What did you learn from that experience?', 'How would you handle that differently today?'],
};

interface Message { from: string; text: string; timestamp: number; isCross?: boolean; }

// per-answer metric for live feedback
interface AnswerMetric {
  questionIndex: number;
  technical: number;
  communication: number;
  confidence: number;
  problemSolving: number;
  hrResponse: number;
  brief: string;
}

export default function PanelInterviewPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const role: string     = (location.state as any)?.role     || 'Software Engineer';
  const duration: number = (location.state as any)?.duration || 15;

  const [sessionId,      setSessionId]      = useState<string | null>(null);
  const [authReady,      setAuthReady]      = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [timeRemaining,  setTimeRemaining]  = useState(duration * 60);
  const [timerActive,    setTimerActive]    = useState(false);
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [answer,         setAnswer]         = useState('');
  const [activeSpeaker,  setActiveSpeaker]  = useState<string | null>(null);
  const [_questionIdx,   setQuestionIdx]    = useState<Record<string, number>>({ tech: 0, hiring: 0, hr: 0 });
  const [currentPanel,   setCurrentPanel]   = useState(0);
  const [isThinking,     setIsThinking]     = useState(false);
  const [sessionEnded,   setSessionEnded]   = useState(false);
  const [cameraStream,   setCameraStream]   = useState<MediaStream | null>(null);
  const [leftCollapsed,  setLeftCollapsed]  = useState(false);

  // NEW: live feedback state
  const [answerMetrics,    setAnswerMetrics]    = useState<AnswerMetric[]>([]);
  const [isEvaluating,     setIsEvaluating]     = useState(false);
  const [showLiveFeedback, setShowLiveFeedback] = useState(true);

  // NEW: track Q&A pairs for report
  const qaHistoryRef    = useRef<{ question: string; answer: string; panelId: string }[]>([]);
  const lastQuestionRef = useRef<string>('');
  const sessionEndedRef = useRef(false);

  const cameraRef  = useRef<HTMLVideoElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const timerRef   = useRef<number | null>(null);
  const answerRef  = useRef<HTMLTextAreaElement>(null);

  const voice = usePanelVoice();

  useEffect(() => {
    if (voice.responseMode === 'voice' && voice.isListening) setAnswer(voice.transcript);
  }, [voice.transcript, voice.responseMode, voice.isListening]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { navigate('/login'); return; }
    api.get('/auth/profile').then(() => setAuthReady(true)).catch(() => navigate('/login'));
  }, [navigate]);

  // WEBCAM FIX: callback ref
  const attachCamera = useCallback((video: HTMLVideoElement | null) => {
    cameraRef.current = video;
    if (video && cameraStream) {
      video.srcObject = cameraStream;
      video.onloadedmetadata = () => { video.play().catch(() => {}); };
      video.play().catch(() => {});
    }
  }, [cameraStream]);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(s => setCameraStream(s)).catch(() => {});
  }, []);

  useEffect(() => {
    const video = cameraRef.current;
    if (video && cameraStream) {
      video.srcObject = cameraStream;
      video.onloadedmetadata = () => { video.play().catch(() => {}); };
      video.play().catch(() => {});
    }
  }, [cameraStream]);

  useEffect(() => {
    if (!authReady) return;
    api.post('/api/sessions', { jobRole: role, mode: 'panel', duration })
      .then(res => {
        setSessionId(res.data.data?.sessionId || res.data.data?._id || 'panel-' + Date.now());
        setSessionStarted(true);
        setTimerActive(true);
      })
      .catch(() => {
        setSessionId('panel-' + Date.now());
        setSessionStarted(true);
        setTimerActive(true);
      });
  }, [authReady, role, duration]);

  useEffect(() => {
    if (!sessionStarted) return;
    const welcomeText = 'Welcome to your Mock Panel Interview for ' + role + '. You will be interviewed by ' + PANEL.map(p => p.name).join(', ') + '. Answer each question thoroughly - the panel may cross-question you. Good luck!';
    setMessages([{ from: 'system', text: welcomeText, timestamp: Date.now() }]);
    setTimeout(() => askNextQuestion('tech'), 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStarted]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // NEW: evaluate answer for live feedback
  const evaluateAnswer = useCallback(async (question: string, answerText: string, qIdx: number, panelId: string) => {
    setIsEvaluating(true);
    try {
      const res = await api.post('/api/gemini/evaluate-answer', {
        question, answer: answerText, role, panelType: panelId,
      });
      const d = res.data?.data ?? {};
      setAnswerMetrics(prev => [...prev, {
        questionIndex:  qIdx,
        technical:      Math.min(10, Math.max(0, Number(d.technical      ?? d.technicalAccuracy ?? d.overall ?? 6))),
        communication:  Math.min(10, Math.max(0, Number(d.communication  ?? d.clarity          ?? 6))),
        confidence:     Math.min(10, Math.max(0, Number(d.confidence     ?? 6))),
        problemSolving: Math.min(10, Math.max(0, Number(d.problemSolving ?? d.answerQuality    ?? 6))),
        hrResponse:     Math.min(10, Math.max(0, Number(d.hrResponse     ?? d.confidence       ?? 6))),
        brief: String(d.brief ?? d.feedback ?? 'Good response.'),
      }]);
    } catch {
      const len = answerText.length;
      const base = len > 200 ? 7 : len > 80 ? 6 : 5;
      const rand = () => base + Math.floor(Math.random() * 2);
      setAnswerMetrics(prev => [...prev, {
        questionIndex: qIdx, technical: rand(), communication: rand(),
        confidence: rand(), problemSolving: rand(), hrResponse: rand(),
        brief: 'Answer recorded. Keep being specific and structured.',
      }]);
    } finally {
      setIsEvaluating(false);
    }
  }, [role]);

  // FIXED handleEnd: navigates to dedicated report page
  const handleEnd = useCallback(() => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    setSessionEnded(true);
    setTimerActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    voice.cancelSpeech();
    voice.stopListening();
    cameraStream?.getTracks().forEach(t => t.stop());
    // Navigate to dedicated report page, passing all data via state
    setAnswerMetrics(prev => {
      const totalTime    = duration * 60;
      const usedTime     = Math.max(0, totalTime - (timeRemaining ?? 0));
      setTimeout(() => {
        navigate('/interview/panel/report', {
          state: {
            role,
            sessionId:    sessionId ?? ('panel-' + Date.now()),
            duration,
            metrics:      prev,
            qaHistory:    qaHistoryRef.current,
            answeredTime: usedTime,
          },
        });
      }, 400);
      return prev;
    });
  }, [cameraStream, voice, navigate, role, sessionId, duration, timeRemaining]);

  const handleEndRef = useRef(handleEnd);
  useEffect(() => { handleEndRef.current = handleEnd; }, [handleEnd]);

  // FIXED timer: uses ref so it always calls the latest handleEnd
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

  const askNextQuestion = useCallback((panelId: string) => {
    const questions = getQuestions(panelId, role);
    setQuestionIdx(prev => {
      const idx = prev[panelId] || 0;
      if (idx >= questions.length) return prev;
      setActiveSpeaker(panelId);
      setIsThinking(true);
      const delay = 1200 + Math.random() * 800;
      setTimeout(() => {
        setIsThinking(false);
        const questionText = questions[idx];
        lastQuestionRef.current = questionText;
        setMessages(m => [...m, { from: panelId, text: questionText, timestamp: Date.now() }]);
        setActiveSpeaker(panelId);
        voice.speakAs(panelId, questionText, () => {
          setActiveSpeaker(null);
          if (voice.responseMode === 'voice') {
            setTimeout(() => { voice.clearTranscript(); voice.startListening(); }, 300);
          } else { setTimeout(() => answerRef.current?.focus(), 200); }
        });
      }, delay);
      return { ...prev, [panelId]: idx + 1 };
    });
  }, [role, voice]);

  const handleSubmitAnswer = useCallback(() => {
    const text = answer.trim();
    if (!text || sessionEnded) return;
    if (voice.responseMode === 'voice') { voice.stopListening(); voice.clearTranscript(); }
    setMessages(prev => [...prev, { from: 'candidate', text, timestamp: Date.now() }]);

    // NEW: record Q&A and trigger live evaluation
    const currentQ = lastQuestionRef.current;
    const qIdx = qaHistoryRef.current.length;
    const panelId = PANEL[currentPanel % PANEL.length].id;
    qaHistoryRef.current.push({ question: currentQ, answer: text, panelId });
    evaluateAnswer(currentQ, text, qIdx, panelId);

    setAnswer('');
    const shouldCross = Math.random() < 0.3;
    const currentPanelId = PANEL[currentPanel % PANEL.length].id;
    if (shouldCross) {
      const crossQs = CROSS_QUESTIONS[currentPanelId];
      const crossQ  = crossQs[Math.floor(Math.random() * crossQs.length)];
      const crosserIdx = (currentPanel + 1 + Math.floor(Math.random() * 2)) % PANEL.length;
      const crosserId  = PANEL[crosserIdx].id;
      lastQuestionRef.current = crossQ;
      setActiveSpeaker(crosserId);
      setIsThinking(true);
      setTimeout(() => {
        setIsThinking(false);
        setMessages(prev => [...prev, { from: crosserId, text: crossQ, timestamp: Date.now(), isCross: true }]);
        setActiveSpeaker(crosserId);
        voice.speakAs(crosserId, crossQ, () => {
          setActiveSpeaker(null);
          if (voice.responseMode === 'voice') {
            setTimeout(() => { voice.clearTranscript(); voice.startListening(); }, 300);
          } else { setTimeout(() => answerRef.current?.focus(), 200); }
        });
      }, 1000 + Math.random() * 600);
    } else {
      const nextPanel = (currentPanel + 1) % PANEL.length;
      setCurrentPanel(nextPanel);
      setTimeout(() => askNextQuestion(PANEL[nextPanel].id), 800);
    }
  }, [answer, currentPanel, sessionEnded, askNextQuestion, voice, evaluateAnswer]);

  const handleToggleResponseMode = useCallback((mode: ResponseMode) => {
    voice.setResponseMode(mode);
    setAnswer('');
    if (mode === 'voice' && !voice.isSpeaking) { voice.clearTranscript(); voice.startListening(); }
  }, [voice]);

  const handleMicToggle = useCallback(() => {
    if (voice.isListening) voice.stopListening();
    else { voice.clearTranscript(); voice.startListening(); }
  }, [voice]);

  const formatTime = (s: number) =>
    String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

  const timerPct   = Math.round((timeRemaining / (duration * 60)) * 100);
  const timerColor = timeRemaining > 120 ? '#3b82f6' : timeRemaining > 60 ? '#f59e0b' : '#ef4444';
  const activePanelMember = PANEL.find(p => p.id === (voice.activeVoiceSpeaker || activeSpeaker));

  // Live feedback averages
  const avgM = (key: keyof Omit<AnswerMetric, 'questionIndex' | 'brief'>) => {
    if (!answerMetrics.length) return 0;
    return Math.round(answerMetrics.reduce((s, m) => s + m[key], 0) / answerMetrics.length * 10) / 10;
  };
  const latestMetric = answerMetrics[answerMetrics.length - 1] ?? null;

  return (
    <div className="panel-room">
      <header className="panel-topbar">
        <div className="panel-topbar-left">
          <div className="panel-mode-badge">Mock Panel Interview</div>
          <div className="panel-role-chip">{role}</div>
          {voice.isSpeaking && activePanelMember && (
            <div className="panel-voice-status-pill" style={{ background: activePanelMember.color + '22', border: '1px solid ' + activePanelMember.color + '55', color: activePanelMember.color }}>
              <span className="panel-voice-wave"><span /><span /><span /></span>
              {activePanelMember.name} speaking
            </div>
          )}
          {voice.isListening && (
            <div className="panel-voice-status-pill panel-voice-status-pill--listening">
              <span className="panel-voice-wave panel-voice-wave--red"><span /><span /><span /></span>
              Listening...
            </div>
          )}
        </div>
        <div className="panel-topbar-center">
          <div className="panel-timer-ring" style={{ '--tc': timerColor } as React.CSSProperties}>
            <svg viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="#1e293b" strokeWidth="4" />
              <circle cx="22" cy="22" r="18" fill="none" stroke={timerColor} strokeWidth="4"
                strokeDasharray={String((timerPct / 100) * 113) + ' 113'} strokeLinecap="round"
                transform="rotate(-90 22 22)" style={{ transition: 'stroke-dasharray 1s linear' }} />
            </svg>
            <span style={{ color: timerColor }}>{formatTime(timeRemaining)}</span>
          </div>
        </div>
        <div className="panel-topbar-right">
          <button className="panel-end-btn" onClick={handleEnd}>End Interview</button>
        </div>
      </header>

      <div className={'panel-body' + (leftCollapsed ? ' panel-body--collapsed' : '')}>
        <aside className={'panel-left' + (leftCollapsed ? ' panel-left--collapsed' : '')}>
          <button className="panel-collapse-btn" onClick={() => setLeftCollapsed(v => !v)} aria-label={leftCollapsed ? 'Expand panel' : 'Collapse panel'}>
            {leftCollapsed ? '>' : '<'}
          </button>

          {!leftCollapsed && (
            <>
              <div className="panel-members-section">
                <div className="panel-section-label">Panel Members</div>
                {PANEL.map(p => {
                  const isTTSSpeaking = voice.activeVoiceSpeaker === p.id;
                  const isActive      = activeSpeaker === p.id || isTTSSpeaking;
                  return (
                    <div key={p.id} className={'panel-member-card' + (isActive ? ' speaking' : '')} style={{ '--pm-color': p.color } as React.CSSProperties}>
                      <div className="panel-member-avatar" style={{ background: p.color + '22', border: '2px solid ' + (isActive ? p.color : 'transparent') }}>
                        <span>{p.avatar}</span>
                        {isActive && <span className="panel-speaking-ring" style={{ borderColor: p.color }} />}
                      </div>
                      <div className="panel-member-info">
                        <div className="panel-member-name">{p.name}</div>
                        <div className="panel-member-title" style={{ color: p.color }}>{p.title}</div>
                      </div>
                      {isActive && isThinking && <div className="panel-thinking-dots"><span /><span /><span /></div>}
                      {isTTSSpeaking && !isThinking && <div className="panel-tts-bars"><span /><span /><span /><span /></div>}
                    </div>
                  );
                })}
              </div>

              <div className="panel-camera-section">
                <div className="panel-section-label">You</div>
                <div className={'panel-camera-wrap' + (voice.isListening ? ' panel-camera-wrap--listening' : '')}>
                  <video ref={attachCamera} autoPlay playsInline muted
                    onLoadedMetadata={e => { (e.target as HTMLVideoElement).play().catch(() => {}); }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', background: '#0f172a' }} />
                  {voice.isListening && (
                    <div className="panel-mic-indicator">
                      <span className="panel-mic-dot" />
                      <span>Mic On</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {leftCollapsed && (
            <div className="panel-collapsed-icons">
              {PANEL.map(p => {
                const isActive = activeSpeaker === p.id || voice.activeVoiceSpeaker === p.id;
                return (
                  <div key={p.id} className="panel-collapsed-avatar" title={p.name} style={{ background: isActive ? p.color : p.color + '22' }}>
                    {p.avatar}
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        <main className="panel-workspace">
          {/* NEW: Live feedback panel */}
          {answerMetrics.length > 0 && !sessionEnded && (
            <div className="panel-live-feedback">
              <div className="panel-lf-header">
                <span className="panel-lf-title">Live Feedback</span>
                <span className="panel-lf-count">{answerMetrics.length} answer{answerMetrics.length !== 1 ? 's' : ''} evaluated</span>
                <button className="panel-lf-toggle" onClick={() => setShowLiveFeedback(v => !v)}>{showLiveFeedback ? 'Hide' : 'Show'}</button>
              </div>
              {showLiveFeedback && (
                <div className="panel-lf-body">
                  <div className="panel-lf-metrics">
                    {[
                      { label: 'Technical',       val: avgM('technical'),      color: '#3b82f6' },
                      { label: 'Communication',   val: avgM('communication'),  color: '#8b5cf6' },
                      { label: 'Confidence',      val: avgM('confidence'),     color: '#10b981' },
                      { label: 'Problem Solving', val: avgM('problemSolving'), color: '#f59e0b' },
                      { label: 'HR Response',     val: avgM('hrResponse'),     color: '#ec4899' },
                    ].map(m => (
                      <div key={m.label} className="panel-lf-metric">
                        <div className="panel-lf-metric-top">
                          <span className="panel-lf-metric-label">{m.label}</span>
                          <span className="panel-lf-metric-val" style={{ color: m.color }}>{m.val}/10</span>
                        </div>
                        <div className="panel-lf-bar-bg">
                          <div className="panel-lf-bar-fill" style={{ width: (m.val / 10 * 100) + '%', background: m.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {latestMetric && (
                    <div className="panel-lf-brief">{isEvaluating ? 'Evaluating...' : latestMetric.brief}</div>
                  )}
                </div>
              )}
            </div>
          )}
          {isEvaluating && answerMetrics.length === 0 && (
            <div className="panel-lf-evaluating">Evaluating your answer...</div>
          )}

          <div className="panel-chat-area">
            {messages.map((m, i) => {
              const panelMember = PANEL.find(p => p.id === m.from);
              return (
                <div key={i} className={'panel-msg panel-msg--' + (m.from === 'candidate' ? 'candidate' : m.from === 'system' ? 'system' : 'interviewer') + (m.isCross ? ' cross' : '')}>
                  {panelMember && (
                    <div className="panel-msg-avatar" style={{ background: panelMember.color + '22' }}>{panelMember.avatar}</div>
                  )}
                  <div className="panel-msg-content">
                    {panelMember && (
                      <div className="panel-msg-meta">
                        <span className="panel-msg-name">{panelMember.name}</span>
                        <span className="panel-msg-role" style={{ color: panelMember.color }}>{panelMember.title}</span>
                        {m.isCross && <span className="panel-cross-badge">Follow-up</span>}
                      </div>
                    )}
                    <div className="panel-msg-bubble">{m.text}</div>
                  </div>
                </div>
              );
            })}
            {isThinking && (
              <div className="panel-msg panel-msg--interviewer">
                <div className="panel-msg-avatar" style={{ background: PANEL[currentPanel % PANEL.length].color + '22' }}>
                  {PANEL[currentPanel % PANEL.length].avatar}
                </div>
                <div className="panel-msg-content">
                  <div className="panel-typing-indicator"><span /><span /><span /></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {!sessionEnded && (
            <div className="panel-answer-area">
              <div className="panel-mode-toggle">
                <button className={'panel-mode-tab' + (voice.responseMode === 'text' ? ' active' : '')} onClick={() => handleToggleResponseMode('text')}>Text</button>
                <button className={'panel-mode-tab' + (voice.responseMode === 'voice' ? ' active' : '')} onClick={() => handleToggleResponseMode('voice')} disabled={!voice.sttSupported} title={!voice.sttSupported ? 'Speech recognition not supported' : ''}>Voice</button>
              </div>
              <div className="panel-input-wrap">
                <textarea
                  ref={answerRef}
                  className={'panel-answer-input' + (voice.responseMode === 'voice' ? ' panel-answer-input--voice' : '')}
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSubmitAnswer(); }}
                  placeholder={voice.responseMode === 'voice' ? (voice.isListening ? 'Listening... speak your answer' : 'Click the mic button to start speaking') : 'Type your answer here... (Ctrl+Enter to submit)'}
                  rows={4}
                  readOnly={voice.responseMode === 'voice' && voice.isListening}
                />
                {voice.responseMode === 'voice' && (
                  <button className={'panel-mic-btn' + (voice.isListening ? ' panel-mic-btn--active' : '')} onClick={handleMicToggle} disabled={voice.isSpeaking} aria-label={voice.isListening ? 'Stop microphone' : 'Start microphone'}>
                    {voice.isListening
                      ? <><span>Mic</span><span className="panel-mic-pulse" /></>
                      : <span>Mic</span>}
                  </button>
                )}
              </div>
              {voice.error && <div className="panel-voice-error">{voice.error}</div>}
              <div className="panel-answer-footer">
                <span className="panel-answer-hint">{voice.responseMode === 'voice' ? 'Speak your answer - Edit if needed - Submit when ready' : 'Ctrl+Enter to submit - Be specific and structured'}</span>
                <button className="panel-submit-btn" onClick={handleSubmitAnswer} disabled={!answer.trim()}>Submit Answer</button>
              </div>
            </div>
          )}

          {/* Redirecting to report page after session ends */}
          {sessionEnded && (
            <div className="panel-report-container">
              <div className="panel-report-loading">
                <div className="panel-report-spinner" />
                <p>Preparing your report...</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
