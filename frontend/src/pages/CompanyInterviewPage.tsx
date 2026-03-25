import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { usePanelVoice, type ResponseMode } from '../hooks/usePanelVoice';
import '../styles/CompanyInterview.css';

const PANEL = [
  { id: 'tech',   name: 'Alex Chen',      title: 'Technical Lead',  avatar: 'TL', color: '#3b82f6' },
  { id: 'hiring', name: 'Sarah Mitchell', title: 'Hiring Manager',  avatar: 'HM', color: '#8b5cf6' },
  { id: 'hr',     name: 'James Park',     title: 'HR Specialist',   avatar: 'HR', color: '#10b981' },
];

interface Company { name: string; icon: string; color: string; tier: string; }

const COMPANIES: Company[] = [
  { name: 'Accenture',    icon: 'AC', color: '#a855f7', tier: 'Consulting' },
  { name: 'Adobe',        icon: 'AD', color: '#ef4444', tier: 'Tech' },
  { name: 'Airbnb',       icon: 'AB', color: '#f97316', tier: 'Tech' },
  { name: 'Amazon',       icon: 'AMZ', color: '#f59e0b', tier: 'FAANG' },
  { name: 'Apple',        icon: 'APL', color: '#6b7280', tier: 'FAANG' },
  { name: 'Atlassian',    icon: 'ATL', color: '#3b82f6', tier: 'Tech' },
  { name: 'Capgemini',    icon: 'CAP', color: '#06b6d4', tier: 'Consulting' },
  { name: 'Cisco',        icon: 'CSC', color: '#0ea5e9', tier: 'Tech' },
  { name: 'Deloitte',     icon: 'DLT', color: '#22c55e', tier: 'Consulting' },
  { name: 'Flipkart',     icon: 'FK', color: '#f59e0b', tier: 'E-Commerce' },
  { name: 'Goldman Sachs',icon: 'GS', color: '#eab308', tier: 'Finance' },
  { name: 'Google',       icon: 'G', color: '#4285f4', tier: 'FAANG' },
  { name: 'IBM',          icon: 'IBM', color: '#1d4ed8', tier: 'Tech' },
  { name: 'Infosys',      icon: 'INF', color: '#0891b2', tier: 'IT Services' },
  { name: 'Intel',        icon: 'INT', color: '#0ea5e9', tier: 'Semiconductor' },
  { name: 'JPMorgan',     icon: 'JPM', color: '#1e40af', tier: 'Finance' },
  { name: 'Meta',         icon: 'META', color: '#1877f2', tier: 'FAANG' },
  { name: 'Microsoft',    icon: 'MS', color: '#00a4ef', tier: 'FAANG' },
  { name: 'Netflix',      icon: 'NFLX', color: '#e50914', tier: 'Tech' },
  { name: 'Nvidia',       icon: 'NV', color: '#76b900', tier: 'Semiconductor' },
  { name: 'Oracle',       icon: 'ORC', color: '#ef4444', tier: 'Tech' },
  { name: 'PayPal',       icon: 'PP', color: '#003087', tier: 'Fintech' },
  { name: 'Salesforce',   icon: 'SF', color: '#00a1e0', tier: 'SaaS' },
  { name: 'Samsung',      icon: 'SAM', color: '#1428a0', tier: 'Tech' },
  { name: 'ServiceNow',   icon: 'SN', color: '#62d84e', tier: 'SaaS' },
  { name: 'Stripe',       icon: 'STR', color: '#635bff', tier: 'Fintech' },
  { name: 'TCS',          icon: 'TCS', color: '#0f4c81', tier: 'IT Services' },
  { name: 'Uber',         icon: 'UBR', color: '#000000', tier: 'Tech' },
  { name: 'Walmart',      icon: 'WMT', color: '#0071ce', tier: 'Retail' },
  { name: 'Zoho',         icon: 'ZHO', color: '#f97316', tier: 'SaaS' },
];

function questionsForDuration(mins: number): number {
  if (mins <= 5)  return 3;
  if (mins <= 10) return 5;
  if (mins <= 15) return 7;
  if (mins <= 25) return 10;
  return 14;
}

interface Message { from: string; text: string; timestamp: number; isCross?: boolean; }
type Phase = 'select-company' | 'precheck' | 'interview';

interface AnswerMetric {
  questionIndex: number;
  answerQuality: number;
  confidence: number;
  clarity: number;
  technicalAccuracy: number;
  brief: string;
}

interface InterviewReport {
  overallScore: number;
  grade: string;
  strengths: string[];
  improvements: string[];
  categoryScores: { label: string; score: number; color: string }[];
  perQuestionSummary: { q: string; a: string; score: number; note: string }[];
  aiJudgeOpinion: string;
}
export default function CompanyInterviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const locState = ((location.state ?? {}) as Record<string, unknown>);
  const role: string     = typeof locState.role     === 'string' ? locState.role     : 'Software Engineer';
  const duration: number = typeof locState.duration === 'number' ? locState.duration : 15;

  const [phase,           setPhase]           = useState<Phase>('select-company');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [screenShared,    setScreenShared]    = useState(false);
  const [isFullscreen,    setIsFullscreen]    = useState(false);
  const [sessionId,       setSessionId]       = useState<string | null>(null);
  const [authReady,       setAuthReady]       = useState(false);
  const [sessionStarted,  setSessionStarted]  = useState(false);
  const [timeRemaining,   setTimeRemaining]   = useState(duration * 60);
  const [timerActive,     setTimerActive]     = useState(false);
  const [messages,        setMessages]        = useState<Message[]>([]);
  const [answer,          setAnswer]          = useState('');
  const [activeSpeaker,   setActiveSpeaker]   = useState<string | null>(null);
  const [currentPanel,    setCurrentPanel]    = useState(0);
  const [isThinking,      setIsThinking]      = useState(false);
  const [sessionEnded,    setSessionEnded]    = useState(false);
  const [cameraStream,    setCameraStream]    = useState<MediaStream | null>(null);
  const [leftCollapsed,   setLeftCollapsed]   = useState(false);
  const [questionCount,   setQuestionCount]   = useState(0);
  const totalQuestions = questionsForDuration(duration);

  // NEW: live feedback
  const [answerMetrics,      setAnswerMetrics]      = useState<AnswerMetric[]>([]);
  const [isEvaluating,       setIsEvaluating]       = useState(false);
  const [showFeedback,       setShowFeedback]       = useState(true);
  // NEW: post-interview report
  const [report,             setReport]             = useState<InterviewReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const conversationHistoryRef = useRef<{ role: string; text: string }[]>([]);
  const qaHistoryRef   = useRef<{ question: string; answer: string; panelId: string }[]>([]);
  const lastQuestionRef = useRef<string>('');
  const cameraRef      = useRef<HTMLVideoElement | null>(null);
  const chatEndRef     = useRef<HTMLDivElement>(null);
  const timerRef       = useRef<number | null>(null);
  const answerRef      = useRef<HTMLTextAreaElement>(null);
  const sessionEndedRef = useRef(false);

  const voice = usePanelVoice();

  useEffect(() => {
    if (voice.responseMode === 'voice' && voice.isListening) setAnswer(voice.transcript);
  }, [voice.transcript, voice.responseMode, voice.isListening]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { navigate('/login'); return; }
    api.get('/auth/profile').then(() => setAuthReady(true)).catch(() => navigate('/login'));
  }, [navigate]);

  // WEBCAM FIX: request stream once
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(s => setCameraStream(s))
      .catch(() => {});
  }, []);

  // WEBCAM FIX: callback ref — attaches stream whenever video element mounts
  const attachCamera = useCallback((video: HTMLVideoElement | null) => {
    cameraRef.current = video;
    if (video && cameraStream) {
      video.srcObject = cameraStream;
      video.onloadedmetadata = () => { video.play().catch(() => {}); };
      video.play().catch(() => {});
    }
  }, [cameraStream]);

  // WEBCAM FIX: also re-attach if stream arrives after video is already mounted
  useEffect(() => {
    const video = cameraRef.current;
    if (video && cameraStream) {
      video.srcObject = cameraStream;
      video.onloadedmetadata = () => { video.play().catch(() => {}); };
      video.play().catch(() => {});
    }
  }, [cameraStream]);

  useEffect(() => {
    if (!authReady || phase !== 'interview') return;
    const companyName = selectedCompany ? selectedCompany.name : 'Unknown';
    api.post('/api/sessions', { jobRole: role, mode: 'company', duration, company: companyName })
      .then(res => {
        setSessionId(String(res.data.data?.sessionId || res.data.data?._id || 'company-' + Date.now()));
        setSessionStarted(true); setTimerActive(true);
      })
      .catch(() => { setSessionId('company-' + Date.now()); setSessionStarted(true); setTimerActive(true); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, phase]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // NEW: evaluate answer for live feedback metrics
  const evaluateAnswer = useCallback(async (question: string, answerText: string, qIdx: number) => {
    setIsEvaluating(true);
    try {
      const res = await api.post('/api/gemini/evaluate-answer', {
        question, answer: answerText, role,
        company: selectedCompany?.name ?? 'a top tech company',
      });
      const d = res.data?.data ?? {};
      setAnswerMetrics(prev => [...prev, {
        questionIndex: qIdx,
        answerQuality:     Math.min(10, Math.max(0, Number(d.answerQuality     ?? d.overall ?? 6))),
        confidence:        Math.min(10, Math.max(0, Number(d.confidence        ?? 6))),
        clarity:           Math.min(10, Math.max(0, Number(d.clarity           ?? 6))),
        technicalAccuracy: Math.min(10, Math.max(0, Number(d.technicalAccuracy ?? d.technical ?? 6))),
        brief: String(d.brief ?? d.feedback ?? 'Good response.'),
      }]);
    } catch {
      const len = answerText.length;
      const base = len > 200 ? 7 : len > 80 ? 6 : 5;
      setAnswerMetrics(prev => [...prev, {
        questionIndex: qIdx,
        answerQuality:     base + Math.floor(Math.random() * 2),
        confidence:        base + Math.floor(Math.random() * 2),
        clarity:           base + Math.floor(Math.random() * 2),
        technicalAccuracy: base + Math.floor(Math.random() * 2),
        brief: 'Answer recorded. Keep being specific and structured.',
      }]);
    } finally {
      setIsEvaluating(false);
    }
  }, [role, selectedCompany]);

  // NEW: generate post-interview report
  const generateReport = useCallback(async (metrics: AnswerMetric[]) => {
    setIsGeneratingReport(true);
    const qa = qaHistoryRef.current;
    try {
      const res = await api.post('/api/gemini/interview-report', {
        role, company: selectedCompany?.name ?? 'Unknown', qaHistory: qa, metrics,
      });
      const d = res.data?.data ?? {};
      setReport({
        overallScore:       Number(d.overallScore ?? computeOverallScore(metrics)),
        grade:              String(d.grade ?? scoreToGrade(computeOverallScore(metrics))),
        strengths:          Array.isArray(d.strengths) ? d.strengths : ['Showed relevant experience', 'Communicated clearly'],
        improvements:       Array.isArray(d.improvements) ? d.improvements : ['Add more specific examples', 'Quantify achievements'],
        categoryScores:     Array.isArray(d.categoryScores) ? d.categoryScores : buildCategoryScores(metrics),
        perQuestionSummary: Array.isArray(d.perQuestionSummary) ? d.perQuestionSummary : buildQASummary(qa, metrics),
        aiJudgeOpinion:     String(d.aiJudgeOpinion ?? d.summary ?? 'Overall a solid performance. Focus on providing concrete examples and quantifiable results.'),
      });
    } catch {
      setReport({
        overallScore:       computeOverallScore(metrics),
        grade:              scoreToGrade(computeOverallScore(metrics)),
        strengths:          ['Demonstrated relevant knowledge', 'Maintained professional tone', 'Answered all questions'],
        improvements:       ['Provide more specific examples', 'Quantify your impact', 'Structure answers using STAR method'],
        categoryScores:     buildCategoryScores(metrics),
        perQuestionSummary: buildQASummary(qa, metrics),
        aiJudgeOpinion:     'You completed the interview and showed foundational knowledge. To improve, focus on concrete examples, measurable outcomes, and structured responses.',
      });
    } finally {
      setIsGeneratingReport(false);
    }
  }, [role, selectedCompany]);

  // MODIFIED handleEnd: show inline report instead of navigating to broken /interview/report
  const handleEnd = useCallback(() => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    setSessionEnded(true); setTimerActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    voice.cancelSpeech(); voice.stopListening();
    setMessages(prev => [...prev, { from: 'system', text: 'The interview has concluded. Thank you for your time.', timestamp: Date.now() }]);
    cameraStream?.getTracks().forEach(t => t.stop());
    // Capture current metrics at this point and generate report
    setAnswerMetrics(prev => {
      setTimeout(() => generateReport(prev), 800);
      return prev;
    });
  }, [cameraStream, voice, generateReport]);

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

  const fetchCompanyQuestion = useCallback(async (panelId: string): Promise<string> => {
    const companyName = selectedCompany ? selectedCompany.name : 'a top tech company';
    try {
      const res = await api.post('/api/gemini/company-questions', {
        company: companyName, role, interviewerType: panelId,
        conversationHistory: conversationHistoryRef.current.slice(-6), count: 1,
      });
      const questions: string[] = res.data?.data?.questions ?? [];
      return questions[0] ?? getFallbackQuestion(panelId, role);
    } catch { return getFallbackQuestion(panelId, role); }
  }, [selectedCompany, role]);

  const askNextQuestion = useCallback((panelId: string) => {
    setActiveSpeaker(panelId); setIsThinking(true);
    fetchCompanyQuestion(panelId).then(questionText => {
      setIsThinking(false);
      lastQuestionRef.current = questionText;
      setMessages(m => [...m, { from: panelId, text: questionText, timestamp: Date.now() }]);
      conversationHistoryRef.current.push({ role: panelId, text: questionText });
      setActiveSpeaker(panelId);
      voice.speakAs(panelId, questionText, () => {
        setActiveSpeaker(null);
        if (voice.responseMode === 'voice') {
          setTimeout(() => { voice.clearTranscript(); voice.startListening(); }, 300);
        } else { setTimeout(() => answerRef.current?.focus(), 200); }
      });
    });
  }, [fetchCompanyQuestion, voice]);

  useEffect(() => {
    if (!sessionStarted) return;
    const companyName = selectedCompany ? selectedCompany.name : 'the company';
    const welcomeText = 'Welcome to your ' + companyName + ' interview for the ' + role + ' role. You will be interviewed by ' + PANEL.map(p => p.name).join(', ') + '. Answer each question thoroughly. Good luck!';
    setMessages([{ from: 'system', text: welcomeText, timestamp: Date.now() }]);
    setTimeout(() => askNextQuestion('tech'), 1500);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStarted]);

  // MODIFIED handleSubmitAnswer: also triggers live evaluation
  const handleSubmitAnswer = useCallback(() => {
    const text = answer.trim();
    if (!text || sessionEnded) return;
    if (voice.responseMode === 'voice') { voice.stopListening(); voice.clearTranscript(); }
    setMessages(prev => [...prev, { from: 'candidate', text, timestamp: Date.now() }]);
    conversationHistoryRef.current.push({ role: 'candidate', text });

    // Record Q&A pair and trigger live evaluation
    const currentQ = lastQuestionRef.current;
    const currentQIdx = questionCount;
    qaHistoryRef.current.push({ question: currentQ, answer: text, panelId: PANEL[currentPanel % PANEL.length].id });
    evaluateAnswer(currentQ, text, currentQIdx);

    setAnswer('');
    const newCount = questionCount + 1;
    setQuestionCount(newCount);
    if (newCount >= totalQuestions) { setTimeout(() => handleEndRef.current(), 800); return; }
    const shouldCross = Math.random() < 0.25;
    const nextPanelIdx = (currentPanel + 1) % PANEL.length;
    if (shouldCross) {
      const crosserId = PANEL[(currentPanel + 1 + Math.floor(Math.random() * 2)) % PANEL.length].id;
      const crossQ = getCrossQuestion(crosserId);
      lastQuestionRef.current = crossQ;
      setActiveSpeaker(crosserId); setIsThinking(true);
      setTimeout(() => {
        setIsThinking(false);
        setMessages(prev => [...prev, { from: crosserId, text: crossQ, timestamp: Date.now(), isCross: true }]);
        conversationHistoryRef.current.push({ role: crosserId, text: crossQ });
        setActiveSpeaker(crosserId);
        voice.speakAs(crosserId, crossQ, () => {
          setActiveSpeaker(null);
          if (voice.responseMode === 'voice') {
            setTimeout(() => { voice.clearTranscript(); voice.startListening(); }, 300);
          } else { setTimeout(() => answerRef.current?.focus(), 200); }
        });
      }, 900 + Math.random() * 500);
    } else { setCurrentPanel(nextPanelIdx); setTimeout(() => askNextQuestion(PANEL[nextPanelIdx].id), 800); }
  }, [answer, sessionEnded, currentPanel, questionCount, totalQuestions, askNextQuestion, voice, evaluateAnswer]);

  const handleToggleResponseMode = useCallback((mode: ResponseMode) => {
    voice.setResponseMode(mode); setAnswer('');
    if (mode === 'voice' && !voice.isSpeaking) { voice.clearTranscript(); voice.startListening(); }
  }, [voice]);

  const handleMicToggle = useCallback(() => {
    if (voice.isListening) voice.stopListening();
    else { voice.clearTranscript(); voice.startListening(); }
  }, [voice]);

  const handleShareScreen = useCallback(async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
      setScreenShared(true);
    } catch { /* user cancelled */ }
  }, []);

  const handleEnterFullscreen = useCallback(async () => {
    try { await document.documentElement.requestFullscreen(); setIsFullscreen(true); }
    catch { setIsFullscreen(true); }
  }, []);

  const formatTime = (s: number) =>
    String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');

  const timerPct   = Math.round((timeRemaining / (duration * 60)) * 100);
  const timerColor = timeRemaining > 120 ? '#3b82f6' : timeRemaining > 60 ? '#f59e0b' : '#ef4444';
  const filteredCompanies = COMPANIES.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const activePanelMember = PANEL.find(p => p.id === (voice.activeVoiceSpeaker || activeSpeaker));
  const companyColor = selectedCompany ? selectedCompany.color : '#3b82f6';
  const companyName  = selectedCompany ? selectedCompany.name  : '';

  // Compute running averages for live feedback panel
  const avgMetric = (key: keyof Omit<AnswerMetric, 'questionIndex' | 'brief'>) => {
    if (!answerMetrics.length) return 0;
    return Math.round(answerMetrics.reduce((s, m) => s + m[key], 0) / answerMetrics.length * 10) / 10;
  };
  const latestMetric = answerMetrics[answerMetrics.length - 1] ?? null;

  // Phase: Company Selection
  if (phase === 'select-company') {
    return (
      <div className="ci-select-page">
        <div className="ci-select-header">
          <div className="ci-select-back" onClick={() => navigate(-1)}>Back</div>
          <div className="ci-select-title">
            <span className="ci-select-icon">Co.</span>
            <h1>Choose Your Company</h1>
            <p>Select a company to get tailored interview questions for <strong>{role}</strong></p>
          </div>
          <div className="ci-search-wrap">
            <span className="ci-search-icon">S</span>
            <input className="ci-search-input" type="text" placeholder="Search companies..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
            {searchQuery && (
              <button className="ci-search-clear" onClick={() => setSearchQuery('')}>x</button>
            )}
          </div>
        </div>
        <div className="ci-company-grid">
          {filteredCompanies.length === 0 && (
            <div className="ci-no-results">No companies match &quot;{searchQuery}&quot;</div>
          )}
          {filteredCompanies.map(company => (
            <button
              key={company.name}
              className={'ci-company-card' + (selectedCompany && selectedCompany.name === company.name ? ' selected' : '')}
              style={{ '--cc': company.color } as React.CSSProperties}
              onClick={() => setSelectedCompany(company)}
            >
              {selectedCompany && selectedCompany.name === company.name && (
                <span className="ci-co-check">v</span>
              )}
              <span className="ci-co-emoji" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: company.color + '22', color: company.color, fontWeight: 700, fontSize: 12 }}>
                {company.icon}
              </span>
              <span className="ci-co-name">{company.name}</span>
              <span className="ci-co-tier" style={{ color: company.color }}>{company.tier}</span>
            </button>
          ))}
        </div>
        {selectedCompany && (
          <div className="ci-select-footer">
            <div className="ci-selected-preview">
              <span style={{ fontWeight: 700, color: selectedCompany.color }}>{selectedCompany.name}</span>
              <span className="ci-selected-role"> &middot; {role} &middot; {duration} min</span>
            </div>
            <button className="ci-start-btn" onClick={() => setPhase('precheck')}>Continue</button>
          </div>
        )}
      </div>
    );
  }

  // Phase: Pre-check
  if (phase === 'precheck') {
    const canStart = screenShared && isFullscreen;
    return (
      <div className="ci-setup">
        <div className="ci-setup-header">
          <div className="ci-setup-icon">Lock</div>
          <h1>Pre-Interview Check</h1>
          <p>Complete the steps below before your {companyName} interview begins.</p>
          <div className="ci-setup-role-chip">{role} &middot; {duration} min &middot; {totalQuestions} questions</div>
        </div>
        <div className="ci-archetype-grid" style={{ maxWidth: 560 }}>
          <div className={'ci-archetype-card' + (screenShared ? ' selected' : '')} style={{ '--ac': '#3b82f6' } as React.CSSProperties}>
            <div className="ci-archetype-icon">{screenShared ? 'OK' : 'Screen'}</div>
            <div className="ci-archetype-label">Screen Share</div>
            <div className="ci-archetype-desc">{screenShared ? 'Screen sharing is active.' : 'Share your screen to proceed. This ensures interview integrity.'}</div>
            {!screenShared && <button className="ci-start-btn" style={{ marginTop: 8 }} onClick={handleShareScreen}>Share Screen</button>}
          </div>
          <div className={'ci-archetype-card' + (isFullscreen ? ' selected' : '')} style={{ '--ac': '#8b5cf6' } as React.CSSProperties}>
            <div className="ci-archetype-icon">{isFullscreen ? 'OK' : 'Full'}</div>
            <div className="ci-archetype-label">Fullscreen Mode</div>
            <div className="ci-archetype-desc">{isFullscreen ? 'Fullscreen is active.' : 'Enter fullscreen to minimize distractions during the interview.'}</div>
            {!isFullscreen && <button className="ci-start-btn" style={{ marginTop: 8, background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)' }} onClick={handleEnterFullscreen}>Enter Fullscreen</button>}
          </div>
        </div>
        <div className="ci-setup-actions">
          <button className="ci-start-btn" disabled={!canStart} onClick={() => setPhase('interview')}>
            {canStart ? 'Start ' + companyName + ' Interview' : 'Complete steps above to continue'}
          </button>
        </div>
      </div>
    );
  }

  // Phase: Interview Room
  return (
    <div className="ci-room">
      <header className="ci-topbar">
        <div className="ci-topbar-left">
          <div className="ci-mode-badge" style={{ background: companyColor + '33', color: companyColor, border: '1px solid ' + companyColor + '55' }}>
            {companyName} Interview
          </div>
          <div className="ci-role-chip">{role}</div>
          <div className="ci-round-indicator">Q <strong>{Math.min(questionCount + 1, totalQuestions)}</strong> / {totalQuestions}</div>
          {voice.isSpeaking && activePanelMember && (
            <div className="ci-speaking-pill" style={{ background: activePanelMember.color + '22', border: '1px solid ' + activePanelMember.color + '55', color: activePanelMember.color }}>
              <span className="ci-wave"><span /><span /><span /></span>
              {activePanelMember.name} speaking
            </div>
          )}
          {voice.isListening && (
            <div className="ci-listening-pill">
              <span className="ci-wave"><span /><span /><span /></span>
              Listening...
            </div>
          )}
        </div>
        <div className="ci-topbar-center">
          <div className="ci-timer-ring">
            <svg viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="#1e293b" strokeWidth="4" />
              <circle cx="22" cy="22" r="18" fill="none" stroke={timerColor} strokeWidth="4"
                strokeDasharray={String((timerPct / 100) * 113) + ' 113'}
                strokeLinecap="round" transform="rotate(-90 22 22)"
                style={{ transition: 'stroke-dasharray 1s linear' }}
              />
            </svg>
            <span style={{ color: timerColor }}>{formatTime(timeRemaining)}</span>
          </div>
        </div>
        <button className="ci-end-btn" onClick={handleEnd}>End Interview</button>
      </header>

      <div className="ci-body">
        <aside className={'ci-left' + (leftCollapsed ? ' ci-left--collapsed' : '')}>
          <button className="ci-collapse-btn" onClick={() => setLeftCollapsed(v => !v)} aria-label={leftCollapsed ? 'Expand' : 'Collapse'}>
            {leftCollapsed ? '>' : '<'}
          </button>
          {!leftCollapsed && (
            <>
              <div className="ci-section-label" style={{ marginTop: 44 }}>Panel</div>
              {PANEL.map(p => {
                const isTTSSpeaking = voice.activeVoiceSpeaker === p.id;
                const isActive = activeSpeaker === p.id || isTTSSpeaking;
                return (
                  <div key={p.id} className={'ci-iv-card' + (isActive ? ' active' : '')} style={{ '--ic': p.color } as React.CSSProperties}>
                    <div className="ci-iv-avatar" style={{ background: p.color + '22', border: '2px solid ' + (isActive ? p.color : 'transparent') }}>
                      {p.avatar}
                    </div>
                    <div className="ci-iv-info">
                      <div className="ci-iv-name">{p.name}</div>
                      <div className="ci-iv-title" style={{ color: p.color }}>{p.title}</div>
                    </div>
                    {isActive && (isThinking || isTTSSpeaking) && (
                      <div className="ci-dots"><span /><span /><span /></div>
                    )}
                  </div>
                );
              })}
              <div className="ci-section-label" style={{ marginTop: 16 }}>Progress</div>
              <div className="ci-progress-bar-wrap">
                <div className="ci-progress-bar" style={{ width: String(Math.round((questionCount / totalQuestions) * 100)) + '%', background: companyColor }} />
              </div>
              <div className="ci-progress-text">{questionCount} / {totalQuestions} questions</div>
              <div className="ci-section-label" style={{ marginTop: 16 }}>You</div>
              <div className={'ci-camera-wrap' + (voice.isListening ? ' ci-camera-wrap--listening' : '')}>
                <video
                  ref={attachCamera}
                  autoPlay playsInline muted
                  onLoadedMetadata={e => { (e.target as HTMLVideoElement).play().catch(() => {}); }}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', background: '#0f172a' }}
                />
              </div>
            </>
          )}
          {leftCollapsed && (
            <div style={{ marginTop: 52 }}>
              {PANEL.map(p => {
                const isActive = activeSpeaker === p.id || voice.activeVoiceSpeaker === p.id;
                return (
                  <div key={p.id} className="ci-collapsed-avatar" title={p.name} style={{ background: isActive ? p.color : p.color + '22', margin: '8px auto' }}>
                    {p.avatar}
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        <main className="ci-workspace">
          {answerMetrics.length > 0 && !sessionEnded && (
            <div className="ci-live-feedback">
              <div className="ci-lf-header">
                <span className="ci-lf-title">Live Feedback</span>
                <span className="ci-lf-count">{answerMetrics.length} answer{answerMetrics.length !== 1 ? 's' : ''} evaluated</span>
                <button className="ci-lf-toggle" onClick={() => setShowFeedback(v => !v)}>{showFeedback ? 'Hide' : 'Show'}</button>
              </div>
              {showFeedback && (
                <div className="ci-lf-body">
                  <div className="ci-lf-metrics">
                    {[
                      { label: 'Answer Quality',    val: avgMetric('answerQuality'),     color: '#3b82f6' },
                      { label: 'Confidence',          val: avgMetric('confidence'),         color: '#8b5cf6' },
                      { label: 'Clarity',             val: avgMetric('clarity'),            color: '#10b981' },
                      { label: 'Technical Accuracy',  val: avgMetric('technicalAccuracy'),  color: '#f59e0b' },
                    ].map(m => (
                      <div key={m.label} className="ci-lf-metric">
                        <div className="ci-lf-metric-top">
                          <span className="ci-lf-metric-label">{m.label}</span>
                          <span className="ci-lf-metric-val" style={{ color: m.color }}>{m.val}/10</span>
                        </div>
                        <div className="ci-lf-bar-bg">
                          <div className="ci-lf-bar-fill" style={{ width: (m.val / 10 * 100) + '%', background: m.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {latestMetric && (
                    <div className="ci-lf-brief">{isEvaluating ? 'Evaluating...' : latestMetric.brief}</div>
                  )}
                </div>
              )}
            </div>
          )}
          {isEvaluating && answerMetrics.length === 0 && (
            <div className="ci-lf-evaluating">Evaluating your answer...</div>
          )}

          <div className="ci-chat-area">
            {messages.map((m, i) => {
              const pm = PANEL.find(p => p.id === m.from);
              const msgClass = m.from === 'candidate' ? 'candidate' : m.from === 'system' ? 'system' : 'interviewer';
              return (
                <div key={i} className={'ci-msg ci-msg--' + msgClass}>
                  {pm && <div className="ci-msg-avatar" style={{ background: pm.color + '22' }}>{pm.avatar}</div>}
                  <div className="ci-msg-content">
                    {pm && (
                      <div className="ci-msg-meta">
                        <span className="ci-msg-name">{pm.name}</span>
                        <span className="ci-msg-title" style={{ color: pm.color }}>{pm.title}</span>
                        {m.isCross && <span className="ci-round-badge" style={{ background: pm.color + '22', color: pm.color }}>Follow-up</span>}
                      </div>
                    )}
                    <div className="ci-msg-bubble">{m.text}</div>
                  </div>
                </div>
              );
            })}
            {isThinking && (
              <div className="ci-msg ci-msg--interviewer">
                <div className="ci-msg-avatar" style={{ background: PANEL[currentPanel % PANEL.length].color + '22' }}>
                  {PANEL[currentPanel % PANEL.length].avatar}
                </div>
                <div className="ci-msg-content">
                  <div className="ci-typing-indicator"><span /><span /><span /></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {!sessionEnded && (
            <div className="ci-answer-area">
              <div className="ci-mode-toggle">
                <button className={'ci-mode-tab' + (voice.responseMode === 'text' ? ' active' : '')} onClick={() => handleToggleResponseMode('text')}>Text</button>
                <button className={'ci-mode-tab' + (voice.responseMode === 'voice' ? ' active' : '')} onClick={() => handleToggleResponseMode('voice')} disabled={!voice.sttSupported}>Voice</button>
              </div>
              <div className="ci-input-wrap">
                <textarea
                  ref={answerRef}
                  className={'ci-answer-input' + (voice.responseMode === 'voice' ? ' ci-answer-input--voice' : '')}
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSubmitAnswer(); }}
                  placeholder={voice.responseMode === 'voice' ? (voice.isListening ? 'Listening... speak your answer' : 'Click the mic to start speaking') : 'Type your answer here... (Ctrl+Enter to submit)'}
                  rows={4}
                  readOnly={voice.responseMode === 'voice' && voice.isListening}
                />
                {voice.responseMode === 'voice' && (
                  <button className={'ci-mic-btn' + (voice.isListening ? ' ci-mic-btn--active' : '')} onClick={handleMicToggle} disabled={voice.isSpeaking} aria-label={voice.isListening ? 'Stop microphone' : 'Start microphone'}>
                    {voice.isListening ? <><span>Mic</span><span className="ci-mic-pulse" /></> : <span>Mic</span>}
                  </button>
                )}
              </div>
              {voice.error && <div className="ci-voice-error">{voice.error}</div>}
              <div className="ci-answer-footer">
                <span className="ci-answer-hint">{voice.responseMode === 'voice' ? 'Speak your answer, edit if needed, then submit' : 'Ctrl+Enter to submit'}</span>
                <button className="ci-submit-btn" style={{ background: 'linear-gradient(135deg,' + companyColor + ',' + companyColor + 'cc)' }} onClick={handleSubmitAnswer} disabled={!answer.trim()}>
                  Submit Answer
                </button>
              </div>
            </div>
          )}

          {sessionEnded && (
            <div className="ci-report-container">
              {isGeneratingReport && (
                <div className="ci-report-loading">
                  <div className="ci-report-spinner" />
                  <p>Generating your interview report...</p>
                </div>
              )}
              {report && !isGeneratingReport && (
                <div className="ci-report">
                  <div className="ci-report-header">
                    <div className="ci-report-title">Interview Complete</div>
                    <div className="ci-report-subtitle">{companyName} &middot; {role}</div>
                    <div className="ci-report-score-ring">
                      <svg viewBox="0 0 80 80" width="80" height="80">
                        <circle cx="40" cy="40" r="34" fill="none" stroke="#1e293b" strokeWidth="6" />
                        <circle cx="40" cy="40" r="34" fill="none"
                          stroke={report.overallScore >= 75 ? '#10b981' : report.overallScore >= 55 ? '#f59e0b' : '#ef4444'}
                          strokeWidth="6"
                          strokeDasharray={String((report.overallScore / 100) * 213) + ' 213'}
                          strokeLinecap="round" transform="rotate(-90 40 40)"
                        />
                      </svg>
                      <div className="ci-report-score-inner">
                        <span className="ci-report-score-num">{report.overallScore}</span>
                        <span className="ci-report-score-grade">{report.grade}</span>
                      </div>
                    </div>
                  </div>
                  <div className="ci-report-categories">
                    {report.categoryScores.map(c => (
                      <div key={c.label} className="ci-report-cat">
                        <div className="ci-report-cat-top">
                          <span>{c.label}</span>
                          <span style={{ color: c.color }}>{c.score}/10</span>
                        </div>
                        <div className="ci-lf-bar-bg">
                          <div className="ci-lf-bar-fill" style={{ width: (c.score / 10 * 100) + '%', background: c.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="ci-report-two-col">
                    <div className="ci-report-section ci-report-strengths">
                      <div className="ci-report-section-title" style={{ color: '#10b981' }}>Strengths</div>
                      <ul>{report.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                    <div className="ci-report-section ci-report-improvements">
                      <div className="ci-report-section-title" style={{ color: '#f59e0b' }}>Areas to Improve</div>
                      <ul>{report.improvements.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  </div>
                  <div className="ci-report-judge">
                    <div className="ci-report-section-title">AI Judge Opinion</div>
                    <p>{report.aiJudgeOpinion}</p>
                  </div>
                  {report.perQuestionSummary.length > 0 && (
                    <div className="ci-report-qa">
                      <div className="ci-report-section-title">Per-Question Breakdown</div>
                      {report.perQuestionSummary.map((item, i) => (
                        <div key={i} className="ci-report-qa-item">
                          <div className="ci-report-qa-q">Q{i + 1}: {item.q}</div>
                          <div className="ci-report-qa-a">{item.a}</div>
                          <div className="ci-report-qa-meta">
                            <span className="ci-report-qa-score" style={{ color: item.score >= 7 ? '#10b981' : item.score >= 5 ? '#f59e0b' : '#ef4444' }}>Score: {item.score}/10</span>
                            <span className="ci-report-qa-note">{item.note}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="ci-report-actions">
                    <button className="ci-start-btn" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
                    <button className="ci-start-btn" style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }} onClick={() => navigate('/interview/setup')}>New Interview</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// Fallback questions
const FALLBACK_QUESTIONS: Record<string, Record<string, string[]>> = {
  tech: {
    'Software Engineer': [
      'Walk me through how you would design a scalable microservices architecture.',
      'How do you approach debugging a production issue with no logs?',
      'Explain the CAP theorem and give a real-world example.',
      'How would you optimize a slow SQL query?',
      'Describe your approach to code reviews.',
    ],
    default: [
      'Describe your most technically challenging project.',
      'How do you handle technical debt in a fast-moving team?',
      'Walk me through your system design process.',
      'How do you stay current with new technologies?',
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
    ],
  },
  hr: {
    default: [
      'Tell me about yourself and your career journey.',
      'What are your salary expectations?',
      'How do you handle work-life balance?',
      'Describe a conflict with a colleague and how you resolved it.',
      'What motivates you to do your best work?',
    ],
  },
};

const CROSS_QUESTIONS: Record<string, string[]> = {
  tech:   ['Can you elaborate on the technical implementation?', 'How does that scale to millions of users?', 'What trade-offs did you consider?'],
  hiring: ['How does that align with your long-term goals?', 'Can you give a specific example?', 'How did that impact the business outcome?'],
  hr:     ['What did you learn from that experience?', 'How would you handle that differently today?', 'How did that affect team morale?'],
};

function getFallbackQuestion(panelId: string, role: string): string {
  const bank = FALLBACK_QUESTIONS[panelId] ?? FALLBACK_QUESTIONS['tech'];
  const questions = bank[role] ?? bank['default'] ?? [];
  return questions[Math.floor(Math.random() * questions.length)] ?? 'Tell me about your experience.';
}

function getCrossQuestion(panelId: string): string {
  const qs = CROSS_QUESTIONS[panelId] ?? CROSS_QUESTIONS['tech'];
  return qs[Math.floor(Math.random() * qs.length)];
}

// Report helper utilities
function computeOverallScore(metrics: AnswerMetric[]): number {
  if (!metrics.length) return 50;
  const avg = metrics.reduce((s, m) => s + (m.answerQuality + m.confidence + m.clarity + m.technicalAccuracy) / 4, 0) / metrics.length;
  return Math.round(avg * 10);
}

function scoreToGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

function buildCategoryScores(metrics: AnswerMetric[]) {
  if (!metrics.length) return [];
  const avg = (key: keyof Omit<AnswerMetric, 'questionIndex' | 'brief'>) =>
    Math.round(metrics.reduce((s, m) => s + m[key], 0) / metrics.length * 10) / 10;
  return [
    { label: 'Answer Quality',    score: avg('answerQuality'),     color: '#3b82f6' },
    { label: 'Confidence',         score: avg('confidence'),         color: '#8b5cf6' },
    { label: 'Clarity',            score: avg('clarity'),            color: '#10b981' },
    { label: 'Technical Accuracy', score: avg('technicalAccuracy'),  color: '#f59e0b' },
  ];
}

function buildQASummary(qa: { question: string; answer: string }[], metrics: AnswerMetric[]) {
  return qa.map((item, i) => {
    const m = metrics[i];
    const score = m ? Math.round((m.answerQuality + m.confidence + m.clarity + m.technicalAccuracy) / 4 * 10) / 10 : 5;
    return {
      q: item.question,
      a: item.answer.length > 120 ? item.answer.slice(0, 120) + '...' : item.answer,
      score,
      note: m?.brief ?? 'Answer recorded.',
    };
  });
}
