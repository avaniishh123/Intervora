import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Avatar3D from '../components/Avatar3D';
import InterviewProctoringOverlay from '../components/InterviewProctoringOverlay';
import { useInterviewProctor } from '../hooks/useInterviewProctor';
import { useInterviewMedia } from '../hooks/useInterviewMedia';
import CodeSimulation from '../components/simulation/CodeSimulation';
import AnalysisSimulation from '../components/simulation/AnalysisSimulation';
import api from '../services/api';
import { getFallbackTasks, getTaskType as getFallbackTaskType } from '../data/simulationTaskLibrary';
import '../styles/SimulationInterview.css';

// All roles use the Q&A analysis format — no code editor mode
const CODE_ROLES: string[] = [];

const ROLE_META: Record<string, { icon: string; env: string; color: string }> = {
  'Software Engineer':      { icon: '💻', env: 'Code Lab',          color: '#3b82f6' },
  'Backend Developer':      { icon: '⚙️',  env: 'Code Lab',          color: '#6366f1' },
  'Frontend Developer':     { icon: '🎨', env: 'UI Workspace',      color: '#ec4899' },
  'Full Stack Developer':   { icon: '🔗', env: 'Full-Stack Lab',    color: '#8b5cf6' },
  'AI/ML Engineer':         { icon: '🤖', env: 'ML Studio',         color: '#10b981' },
  'Data Scientist':         { icon: '📊', env: 'Data Lab',          color: '#06b6d4' },
  'Cloud Engineer':         { icon: '☁️',  env: 'Cloud Console',     color: '#0ea5e9' },
  'DevOps Engineer':        { icon: '🚀', env: 'Ops Dashboard',     color: '#f59e0b' },
  'Cybersecurity Engineer': { icon: '🔐', env: 'Security Console',  color: '#ef4444' },
};

interface TaskResult {
  taskId: string;
  score: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
}

export default function SimulationInterviewPage() {
  const navigate   = useNavigate();
  const location   = useLocation();

  const role: string     = (location.state as any)?.role     || 'Software Engineer';
  const duration: number = (location.state as any)?.duration || 15;
  const meta = ROLE_META[role] || { icon: '🧪', env: 'Simulation Lab', color: '#3b82f6' };

  const {
    stream,
    isStreamReady,
    startCompositeWithStream,
    stopRecording,
    avatarState,
    setAvatarState,
  } = useInterviewMedia({ autoStartRecording: false, enableTranscription: false });

  // ── Session state ──────────────────────────────────────────────────────────
  const [simSessionId,      setSimSessionId]      = useState<string | null>(null);
  const [tasks,             setTasks]             = useState<any[]>([]);
  const [taskType,          setTaskType]          = useState<'coding' | 'analysis'>('coding');
  const [currentTaskIdx,    setCurrentTaskIdx]    = useState(0);
  const [taskResults,       setTaskResults]       = useState<TaskResult[]>([]);
  const [sessionStarted,    setSessionStarted]    = useState(false);
  const [isCreating,        setIsCreating]        = useState(false);
  const [authReady,         setAuthReady]         = useState(false);
  const [notification,      setNotification]      = useState<{ type: string; message: string } | null>(null);
  const [closingShown,      setClosingShown]      = useState(false);
  const [leftCollapsed,     setLeftCollapsed]     = useState(false);
  const [activeTab,         setActiveTab]         = useState<'task' | 'ai-chat'>('task');
  const [aiMessages,        setAiMessages]        = useState<{ role: 'ai' | 'user'; text: string }[]>([
    { role: 'ai', text: `Welcome to your ${role} simulation. I'm your AI interviewer. Complete the tasks in the workspace — I'll provide hints and follow-ups as you progress. Good luck! 🚀` },
  ]);
  const [aiInput,           setAiInput]           = useState('');
  const [voiceTranscript,   setVoiceTranscript]   = useState<string>('');
  const [isSpeaking,        setIsSpeaking]        = useState(false);

  // ── Camera ref (direct video element — bypasses CameraPreview srcObject bug) ──
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const localCamStreamRef = useRef<MediaStream | null>(null);

  // ── Start webcam immediately on mount (independent of screen share) ────────
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(camStream => {
        localCamStreamRef.current = camStream;
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = camStream;
        }
      })
      .catch(() => {
        // Camera denied — video element stays blank, no crash
      });
    return () => {
      localCamStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Re-attach stream if the video element re-mounts (e.g. after sidebar toggle)
  const attachCameraRef = useCallback((video: HTMLVideoElement | null) => {
    (cameraVideoRef as any).current = video;
    if (video && localCamStreamRef.current) {
      video.srcObject = localCamStreamRef.current;
      video.play().catch(() => {});
    }
  }, []);

  // ── Timer state ────────────────────────────────────────────────────────────
  const [timeRemaining,     setTimeRemaining]     = useState(duration * 60);
  const [timerActive,       setTimerActive]       = useState(false);
  const timerRef   = useRef<number | null>(null);
  const closingRef = useRef(false);
  const notifTimerRef = useRef<number | null>(null);

  // ── Proctoring ─────────────────────────────────────────────────────────────
  const { proctoringState, screenShareError, requestScreenShare, enterFullscreen, dismissWarning, maxWarnings } =
    useInterviewProctor({
      enabled: true,
      maxWarnings: 3,
      onScreenShareGranted: (s: MediaStream) => startCompositeWithStream(s),
      onFullscreenGranted: () => {},
      onTerminate: () => setTimeout(() => handleAutoEnd(), 3000),
    });

  // ── Auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) { navigate('/login'); return; }
    api.get('/auth/profile').then(() => setAuthReady(true)).catch(() => navigate('/login'));
  }, [navigate]);

  // ── TTS speak helper ───────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    utterance.onstart = () => { setIsSpeaking(true); setVoiceTranscript(text); setAvatarState('speaking'); };
    utterance.onend = () => { setIsSpeaking(false); setVoiceTranscript(''); setAvatarState('listening'); };
    utterance.onerror = () => { setIsSpeaking(false); setVoiceTranscript(''); };
    window.speechSynthesis.speak(utterance);
  }, [setAvatarState]);

  // ── Attach camera stream directly to video element ─────────────────────────
  // Handled by attachCameraRef callback ref — no separate effect needed

  // ── Create session ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authReady) return;
    setIsCreating(true);
    api.post('/api/simulation/start', { jobRole: role, duration })
      .then(res => {
        const d = res.data.data;
        setSimSessionId(d.sessionId);
        // Use fallback tasks if backend returns empty array
        const backendTasks = d.tasks || [];
        const resolvedTasks = backendTasks.length > 0
          ? backendTasks
          // Tag fallback tasks with index-based IDs so backend can resolve them
          : getFallbackTasks(role, duration).map((t, i) => ({ ...t, id: `task-${i}` }));
        setTasks(resolvedTasks);
        setTaskType(d.taskType === 'coding' ? 'coding' : getFallbackTaskType(role));
      })
      .catch(() => {
        // On API failure, use fallback tasks and a local session ID
        const fallback = getFallbackTasks(role, duration).map((t, i) => ({ ...t, id: `task-${i}` }));
        setTasks(fallback);
        setTaskType(getFallbackTaskType(role));
        setSimSessionId('local-' + Date.now());
      })
      .finally(() => setIsCreating(false));
  }, [authReady, role, duration, navigate]);

  // ── Start when ready — start as soon as session + stream are ready ──────────
  useEffect(() => {
    if (simSessionId && isStreamReady && !sessionStarted) {
      // Start regardless of proctoring phase so tasks always appear
      setSessionStarted(true);
      setTimerActive(true);
      setAvatarState('listening');
      const welcome = `Welcome to your ${role} simulation. I'm your AI interviewer. Complete the tasks in the workspace. I'll provide hints and follow-ups as you progress. Good luck!`;
      setTimeout(() => speak(welcome), 800);
    }
  }, [simSessionId, isStreamReady, sessionStarted, setAvatarState, role, speak]);

  // ── Countdown ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerActive || !sessionStarted) return;
    timerRef.current = window.setInterval(() => {
      setTimeRemaining(prev => {
        const next = prev - 1;
        if (next <= 10 && !closingRef.current) {
          closingRef.current = true;
          setClosingShown(true);
          setAvatarState('speaking');
          speak('Thank you for attending the simulation. We have come to the end of the session. Returning you to the dashboard shortly.');
        }
        if (next <= 0) { if (timerRef.current) clearInterval(timerRef.current); return 0; }
        return next;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive, sessionStarted, setAvatarState]);

  useEffect(() => {
    if (timeRemaining === 0 && sessionStarted) handleAutoEnd();
  }, [timeRemaining, sessionStarted]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const showNotif = (type: string, message: string) => {
    setNotification({ type, message });
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    notifTimerRef.current = window.setTimeout(() => setNotification(null), 4000);
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const timerPct = Math.round((timeRemaining / (duration * 60)) * 100);
  const timerColor = timeRemaining > 120 ? meta.color : timeRemaining > 60 ? '#f59e0b' : '#ef4444';

  // ── Auto-end ───────────────────────────────────────────────────────────────
  const handleAutoEnd = useCallback(async () => {
    if (!simSessionId) return;
    setTimerActive(false);
    setAvatarState('celebrating');

    let recordingUrl: string | undefined;
    try {
      const rec = await stopRecording();
      if (rec?.blob && rec.blob.size > 0) {
        const ext = rec.blob.type.includes('mp4') ? 'mp4' : 'webm';
        try {
          sessionStorage.setItem(`sim_recording_blob_${simSessionId}`, URL.createObjectURL(rec.blob));
          sessionStorage.setItem(`sim_recording_ext_${simSessionId}`, ext);
        } catch {}
        const fd = new FormData();
        fd.append('recording', rec.blob, `sim-${simSessionId}.${ext}`);
        const token = localStorage.getItem('accessToken');
        const base  = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        try {
          const r = await fetch(`${base}/api/sessions/${simSessionId}/upload-recording`, {
            method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
          });
          if (r.ok) recordingUrl = (await r.json()).data?.recordingUrl;
        } catch {}
      }
    } catch {}

    try { await api.post(`/api/simulation/${simSessionId}/complete`, { recordingUrl }); } catch {}
    navigate('/dashboard');
  }, [simSessionId, stopRecording, navigate, setAvatarState]);

  // ── Task submit ────────────────────────────────────────────────────────────
  const handleTaskSubmit = useCallback((result: { score: number; feedback: string; strengths: string[]; weaknesses: string[] }) => {
    if (!simSessionId || !tasks[currentTaskIdx]) return;
    const taskId = tasks[currentTaskIdx].id;
    setTaskResults(prev => [...prev, { taskId, ...result }]);
    showNotif('success', 'Task submitted successfully.');
    setAvatarState('celebrating');

    // AI follow-up message + TTS — no score references
    const followUp = currentTaskIdx < tasks.length - 1
      ? `Good effort on that task. Let's keep the momentum going.`
      : `Well done for completing all the tasks. Your session is wrapping up now.`;
    setAiMessages(prev => [...prev, { role: 'ai', text: followUp }]);
    speak(followUp);

    setTimeout(() => {
      setAvatarState('listening');
      if (currentTaskIdx < tasks.length - 1) {
        setCurrentTaskIdx(prev => prev + 1);
        showNotif('info', 'Moving to next task...');
        const nextMsg = `Here comes task ${currentTaskIdx + 2}. Take your time and think through the problem carefully.`;
        setAiMessages(prev => [...prev, { role: 'ai', text: nextMsg }]);
        speak(nextMsg);
      } else {
        showNotif('success', 'All tasks complete! Ending session...');
        const doneMsg = 'You have completed all tasks. Thank you for participating in this simulation session.';
        setAiMessages(prev => [...prev, { role: 'ai', text: doneMsg }]);
        speak(doneMsg);
        setTimeout(() => handleAutoEnd(), 2000);
      }
    }, 2000);
  }, [simSessionId, tasks, currentTaskIdx, setAvatarState, handleAutoEnd, speak]);

  // ── Score update from Gemini (called after async AI evaluation completes) ──
  const handleScoreUpdate = useCallback((taskIdx: number, geminiScore: number) => {
    setTaskResults(prev => prev.map((r, i) =>
      i === taskIdx ? { ...r, score: geminiScore } : r
    ));
  }, []);

  // ── Event tracker — fire-and-forget, never blocks UI ─────────────────────
  const handleEvent = useCallback((type: string, data?: any) => {
    if (!simSessionId || simSessionId.startsWith('local-')) return;
    // Non-blocking: don't await, don't surface errors to user
    api.post(`/api/simulation/${simSessionId}/event`, { type, data }).catch(() => {});
  }, [simSessionId]);

  const isCodeRole = CODE_ROLES.includes(role);

  // ── AI chat ────────────────────────────────────────────────────────────────
  const handleAiSend = useCallback(() => {
    const text = aiInput.trim();
    if (!text) return;
    setAiMessages(prev => [...prev, { role: 'user', text }]);
    setAiInput('');

    // Context-aware response based on current task + role
    setTimeout(() => {
      const task = tasks[currentTaskIdx];
      const taskTitle = task?.title || '';
      const taskDiff  = task?.difficulty || 'medium';
      const q = text.toLowerCase();

      let response = '';

      // Role-specific + task-aware hint logic
      if (isCodeRole) {
        // Coding task hints
        if (q.includes('hint') || q.includes('help') || q.includes('stuck')) {
          const hints: string[] = task?.hints || [];
          response = hints.length > 0
            ? `Here's a direction: ${hints[0]}. Try tracing through a small example by hand first.`
            : `For "${taskTitle}", start by identifying the base case and what invariant must hold at each step.`;
        } else if (q.includes('edge') || q.includes('case')) {
          response = `Good instinct. For "${taskTitle}", consider: empty input, single-element arrays, duplicate values, and integer overflow. Does your solution handle all of these?`;
        } else if (q.includes('time') || q.includes('complex') || q.includes('big o')) {
          response = taskDiff === 'hard'
            ? `For a hard problem like this, aim for O(n log n) or better. If you're at O(n²), think about whether a hash map or sorted structure could reduce lookups.`
            : `What's the dominant loop in your solution? Count iterations relative to input size n — that gives you your time complexity.`;
        } else if (q.includes('loop') || q.includes('infinite') || q.includes('bug')) {
          response = `Check your loop termination condition. In "${taskTitle}", verify that your pointer or index always moves toward the exit condition — it should never stay the same across iterations.`;
        } else if (q.includes('test') || q.includes('fail') || q.includes('wrong')) {
          response = `Run the failing test case manually on paper. Trace each variable step by step. The bug is usually in a boundary condition — off-by-one, wrong comparison operator, or a missed update.`;
        } else if (q.includes('approach') || q.includes('how') || q.includes('start')) {
          response = `For "${taskTitle}": read the constraints carefully, pick a data structure that fits the access pattern, then write the simplest correct version first — optimize only after it passes tests.`;
        } else {
          response = `In "${taskTitle}", focus on correctness before performance. What does your current code do with the first visible test case? Walk through it line by line.`;
        }
      } else {
        // Analysis / scenario task hints
        const roleHints: Record<string, string[]> = {
          'AI/ML Engineer': [
            `Think about data leakage — does any preprocessing step use information from the test set before the split?`,
            `Consider the bias-variance tradeoff. High train accuracy with low val accuracy is a classic overfitting signal.`,
            `For hyperparameter tuning, mention cross-validation. A single val set can be misleading.`,
          ],
          'Data Scientist': [
            `Check whether your feature engineering introduces any target leakage.`,
            `Describe your evaluation metric choice — accuracy alone is misleading for imbalanced classes.`,
            `Mention statistical significance when comparing model performance.`,
          ],
          'DevOps Engineer': [
            `Look at the pipeline config for missing failure conditions — does the deploy job depend on test success?`,
            `Check environment variable injection and secret management in the pipeline steps.`,
            `Consider rollback strategy — what happens if the deployment fails mid-way?`,
          ],
          'Cloud Engineer': [
            `Review IAM roles and least-privilege access. Over-permissioned roles are a common architecture flaw.`,
            `Consider multi-AZ deployment for high availability and what the RTO/RPO requirements are.`,
            `Check cost optimization — are resources right-sized and are there unused reserved instances?`,
          ],
          'Cybersecurity Engineer': [
            `Identify the attack vector first — is it injection, authentication bypass, or privilege escalation?`,
            `Look for hardcoded credentials, unvalidated inputs, and missing rate limiting in the logs.`,
            `Describe your remediation in layers: immediate containment, root cause fix, and long-term hardening.`,
          ],
        };

        const hints = roleHints[role] || [];
        if (q.includes('hint') || q.includes('help') || q.includes('stuck')) {
          response = hints[0] || `Break the problem into parts: identify what's wrong, explain why it's wrong, then propose a fix with reasoning.`;
        } else if (q.includes('approach') || q.includes('how') || q.includes('start')) {
          response = hints[1] || `Start by restating the problem in your own words, then address each evaluation criterion one by one with specific evidence from the scenario.`;
        } else if (q.includes('more') || q.includes('detail') || q.includes('explain')) {
          response = hints[2] || `Add concrete examples or metrics to support your answer. Vague answers score lower — specificity shows depth of understanding.`;
        } else {
          response = `For "${taskTitle}": make sure each answer directly references the scenario data provided. Generic answers won't score well — tie your reasoning to the specific context.`;
        }
      }

      setAiMessages(prev => [...prev, { role: 'ai', text: response }]);
    }, 600);
  }, [aiInput, tasks, currentTaskIdx, isCodeRole, role]);

  const currentTask  = tasks[currentTaskIdx];
  const completedPct = tasks.length > 0 ? Math.round((taskResults.length / tasks.length) * 100) : 0;

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (isCreating || !simSessionId) {
    return (
      <div className="sim-room-loading">
        <div className="sim-loading-inner">
          <div className="sim-loading-icon">{meta.icon}</div>
          <div className="sim-loading-spinner" />
          <h2>Initializing {meta.env}</h2>
          <p>Preparing your {role} simulation environment...</p>
          <div className="sim-loading-dots">
            <span /><span /><span />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sim-room" data-role={role.toLowerCase().replace(/\s+/g, '-')}>
      {/* Proctoring overlay */}
      <InterviewProctoringOverlay
        state={proctoringState}
        screenShareError={screenShareError}
        onRequestScreenShare={requestScreenShare}
        onEnterFullscreen={enterFullscreen}
        onDismissWarning={dismissWarning}
        maxWarnings={maxWarnings}
      />

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <header className="sim-topbar">
        <div className="sim-topbar-left">
          <div className="sim-env-badge" style={{ '--env-color': meta.color } as any}>
            <span className="sim-env-icon">{meta.icon}</span>
            <span className="sim-env-name">{meta.env}</span>
          </div>
          <div className="sim-role-chip">{role}</div>
        </div>

        <div className="sim-topbar-center">
          {/* Session timer ring */}
          <div className="sim-timer-ring" style={{ '--timer-color': timerColor, '--timer-pct': timerPct } as any}>
            <svg viewBox="0 0 44 44" className="sim-timer-svg">
              <circle cx="22" cy="22" r="18" fill="none" stroke="#1e293b" strokeWidth="4" />
              <circle
                cx="22" cy="22" r="18" fill="none"
                stroke={timerColor} strokeWidth="4"
                strokeDasharray={`${(timerPct / 100) * 113} 113`}
                strokeLinecap="round"
                transform="rotate(-90 22 22)"
                style={{ transition: 'stroke-dasharray 1s linear, stroke 0.5s' }}
              />
            </svg>
            <span className="sim-timer-text" style={{ color: timerColor }}>{formatTime(timeRemaining)}</span>
          </div>
        </div>

        <div className="sim-topbar-right">
          {/* Task progress pills */}
          <div className="sim-task-pills">
            {tasks.map((_, i) => (
              <div
                key={i}
                className={`sim-task-pill ${i < taskResults.length ? 'done' : i === currentTaskIdx ? 'active' : 'pending'}`}
                style={{ '--pill-color': meta.color } as any}
                title={`Task ${i + 1}`}
              />
            ))}
          </div>
          <span className="sim-task-label">
            {taskResults.length}/{tasks.length} tasks
          </span>
          <button className="sim-end-btn" onClick={handleAutoEnd}>
            End Session
          </button>
        </div>
      </header>

      {/* ── Notification toast ───────────────────────────────────────────────── */}
      {notification && (
        <div className={`sim-toast sim-toast-${notification.type}`}>
          <span className="sim-toast-icon">
            {notification.type === 'success' ? '✅' : notification.type === 'error' ? '❌' : notification.type === 'warning' ? '⚠️' : 'ℹ️'}
          </span>
          {notification.message}
        </div>
      )}

      {/* ── Main body ────────────────────────────────────────────────────────── */}
      <div className={`sim-body ${leftCollapsed ? 'sim-body--collapsed' : ''}`}>

        {/* ── LEFT PANEL ──────────────────────────────────────────────────────── */}
        <aside className={`sim-left ${leftCollapsed ? 'sim-left--collapsed' : ''}`}>
          {/* Collapse toggle */}
          <button
            className="sim-collapse-btn"
            onClick={() => setLeftCollapsed(v => !v)}
            title={leftCollapsed ? 'Expand panel' : 'Collapse panel'}
            aria-label={leftCollapsed ? 'Expand interaction panel' : 'Collapse interaction panel'}
          >
            {leftCollapsed ? '▶' : '◀'}
          </button>

          {!leftCollapsed && (
            <>
              {/* AI Interviewer */}
              <div className="sim-left-section sim-avatar-section">
                <div className="sim-section-label">
                  <span className="sim-section-dot" style={{ background: meta.color }} />
                  AI Interviewer
                  <span className={`sim-status-chip ${avatarState === 'listening' ? 'listening' : avatarState === 'speaking' ? 'speaking' : 'thinking'}`}>
                    {avatarState === 'listening' ? '● Listening' : avatarState === 'speaking' ? '● Speaking' : '● Thinking'}
                  </span>
                </div>
                <div className="sim-avatar-wrap">
                  <Avatar3D state={avatarState} />
                </div>
                {isSpeaking && voiceTranscript && (
                  <div className="sim-voice-transcript">
                    <span className="sim-voice-icon">🔊</span>
                    <span className="sim-voice-text">{voiceTranscript}</span>
                  </div>
                )}
              </div>

              {/* Candidate camera */}
              <div className="sim-left-section sim-camera-section">
                <div className="sim-section-label">
                  <span className="sim-section-dot" style={{ background: '#10b981' }} />
                  You
                </div>
                <div className="sim-camera-wrap">
                  <video
                    ref={attachCameraRef}
                    autoPlay
                    playsInline
                    muted
                    className="sim-camera-video"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', background: '#0f172a' }}
                  />
                </div>
              </div>

              {/* AI Chat / Task tabs */}
              <div className="sim-left-section sim-chat-section">
                <div className="sim-chat-tabs">
                  <button
                    className={`sim-chat-tab ${activeTab === 'task' ? 'active' : ''}`}
                    onClick={() => setActiveTab('task')}
                  >Progress</button>
                  <button
                    className={`sim-chat-tab ${activeTab === 'ai-chat' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ai-chat')}
                  >AI Chat</button>
                </div>

                {activeTab === 'task' && (
                  <div className="sim-progress-panel">
                    {/* Overall progress bar */}
                    <div className="sim-overall-progress">
                      <div className="sim-progress-header">
                        <span>Session Progress</span>
                        <span style={{ color: meta.color }}>{completedPct}%</span>
                      </div>
                      <div className="sim-progress-track">
                        <div className="sim-progress-fill" style={{ width: `${completedPct}%`, background: meta.color }} />
                      </div>
                    </div>
                    {/* Task list */}
                    {tasks.map((t, i) => {
                      const result = taskResults[i];
                      const isActive = i === currentTaskIdx;
                      const isDone = i < taskResults.length;
                      return (
                        <div key={i} className={`sim-task-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                          <div className="sim-task-item-icon" style={{ background: isDone ? meta.color : isActive ? meta.color + '33' : '#1e293b' }}>
                            {isDone ? '✓' : isActive ? '▶' : String(i + 1)}
                          </div>
                          <div className="sim-task-item-info">
                            <div className="sim-task-item-title">{t.title || `Task ${i + 1}`}</div>
                            {isDone && (
                              <div className="sim-task-item-status" style={{ color: meta.color }}>Submitted ✓</div>
                            )}
                            {isActive && !isDone && (
                              <div className="sim-task-item-status" style={{ color: meta.color }}>In progress</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {activeTab === 'ai-chat' && (
                  <div className="sim-ai-chat">
                    <div className="sim-chat-messages">
                      {aiMessages.map((m, i) => (
                        <div key={i} className={`sim-chat-msg sim-chat-msg--${m.role}`}>
                          {m.role === 'ai' && <span className="sim-chat-avatar">{meta.icon}</span>}
                          <div className="sim-chat-bubble">{m.text}</div>
                        </div>
                      ))}
                    </div>
                    <div className="sim-chat-input-row">
                      <input
                        className="sim-chat-input"
                        value={aiInput}
                        onChange={e => setAiInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAiSend()}
                        placeholder="Ask for a hint..."
                      />
                      <button className="sim-chat-send" onClick={handleAiSend} style={{ background: meta.color }}>↑</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Collapsed state — show icons only */}
          {leftCollapsed && (
            <div className="sim-left-collapsed-icons">
              <div className="sim-collapsed-icon" title="AI Interviewer">{meta.icon}</div>
              <div className="sim-collapsed-icon" title="Camera">📷</div>
              <div className="sim-collapsed-icon" title={`${taskResults.length}/${tasks.length} tasks`}>
                {taskResults.length}/{tasks.length}
              </div>
            </div>
          )}
        </aside>

        {/* ── RIGHT WORKSPACE ─────────────────────────────────────────────────── */}
        <main className="sim-workspace">
          {/* Workspace header bar */}
          <div className="sim-workspace-bar">
            <div className="sim-workspace-title">
              <span className="sim-workspace-icon" style={{ color: meta.color }}>{meta.icon}</span>
              <span>{currentTask?.title || 'Workspace'}</span>
              {currentTask && (
                <span
                  className="sim-workspace-diff"
                  style={{
                    background: currentTask.difficulty === 'easy' ? '#10b98122' : currentTask.difficulty === 'medium' ? '#f59e0b22' : '#ef444422',
                    color: currentTask.difficulty === 'easy' ? '#10b981' : currentTask.difficulty === 'medium' ? '#f59e0b' : '#ef4444',
                  }}
                >
                  {currentTask.difficulty}
                </span>
              )}
            </div>
            <div className="sim-workspace-meta">
              {currentTask?.timeLimit && (
                <span className="sim-workspace-timelimit">⏱ {Math.floor(currentTask.timeLimit / 60)}m task limit</span>
              )}
              <span className="sim-workspace-env" style={{ color: meta.color }}>{meta.env}</span>
            </div>
          </div>

          {/* Workspace content */}
          <div className="sim-workspace-content">
            {closingShown ? (
              <div className="sim-session-end">
                <div className="sim-session-end-icon">🎉</div>
                <h2>Session Complete</h2>
                <p>Thank you for completing the simulation. Returning to dashboard...</p>
              </div>
            ) : currentTask ? (
              isCodeRole && taskType === 'coding' ? (
                <CodeSimulation
                  key={currentTask.id}
                  sessionId={simSessionId!}
                  task={currentTask}
                  onSubmit={handleTaskSubmit}
                  onEvent={handleEvent}
                />
              ) : (
                <AnalysisSimulation
                  key={currentTask.id}
                  sessionId={simSessionId!}
                  task={currentTask}
                  jobRole={role}
                  isSpeaking={isSpeaking}
                  onSubmit={handleTaskSubmit}
                  onScoreUpdate={(score) => handleScoreUpdate(currentTaskIdx, score)}
                  onEvent={handleEvent}
                />
              )
            ) : (
              <div className="sim-no-tasks">
                <span>No tasks available for this role.</span>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
