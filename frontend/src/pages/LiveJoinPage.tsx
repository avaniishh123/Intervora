/**
 * LiveJoinPage — Public page for candidates to join a Human Interview session.
 * No authentication required. Candidate enters name, selects role (candidate),
 * then waits for interviewer to start.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/LiveInterview.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? 'Request failed');
  return json;
}

interface Session {
  sessionId: string;
  jobRole: string;
  durationMinutes: number;
  hostName: string;
  status: 'waiting' | 'active' | 'ended' | 'reported';
  participants: { id: string; name: string; role: string }[];
}

export default function LiveJoinPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [step, setStep] = useState<'loading' | 'enter-name' | 'waiting' | 'error'>('loading');
  const [name, setName] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [loadError, setLoadError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pidRef = useRef('');
  const nameRef = useRef('');

  useEffect(() => { pidRef.current = participantId; }, [participantId]);
  useEffect(() => { nameRef.current = name; }, [name]);

  // Initial session validation
  useEffect(() => {
    if (!sessionId) return;
    apiFetch(`/api/live/sessions/${sessionId}`)
      .then(data => {
        const s: Session = data.data.session;
        if (s.status === 'ended' || s.status === 'reported') {
          setLoadError('This session has already ended.');
          setStep('error');
          return;
        }
        setSession(s);
        setStep('enter-name');
      })
      .catch(() => {
        setLoadError('Session not found or has expired.');
        setStep('error');
      });
  }, [sessionId]);

  const pollSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await apiFetch(`/api/live/sessions/${sessionId}`);
      const s: Session = data.data.session;
      setSession(s);
      if (s.status === 'active') {
        if (pollRef.current) clearInterval(pollRef.current);
        navigate(`/live/interview/${sessionId}`, {
          state: {
            role: 'candidate',
            participantId: pidRef.current,
            participantName: nameRef.current,
            jobRole: s.jobRole,
            durationMinutes: s.durationMinutes,
          },
        });
      }
      if (s.status === 'ended' || s.status === 'reported') {
        if (pollRef.current) clearInterval(pollRef.current);
        setLoadError('The session has ended.');
        setStep('error');
      }
    } catch { /* ignore transient */ }
  }, [sessionId, navigate]);

  const handleJoin = async () => {
    if (!name.trim() || !sessionId) return;
    setJoining(true);
    setJoinError('');
    try {
      const data = await apiFetch(`/api/live/sessions/${sessionId}/join`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), role: 'candidate' }),
      });
      const pid = data.data.participant.id;
      setParticipantId(pid);
      pidRef.current = pid;
      setSession(data.data.session);
      setStep('waiting');
      pollRef.current = setInterval(pollSession, 3000);
    } catch (err: any) {
      setJoinError(err.message ?? 'Failed to join session.');
    } finally {
      setJoining(false);
    }
  };

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  if (step === 'loading') {
    return (
      <div className="li-page">
        <div className="li-card li-card--center">
          <div className="li-spinner-lg" />
          <p className="li-subtitle">Loading session…</p>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="li-page">
        <div className="li-card li-card--center">
          <div className="li-error-icon">❌</div>
          <h2 className="li-title">Session Unavailable</h2>
          <p className="li-subtitle">{loadError}</p>
        </div>
      </div>
    );
  }

  if (step === 'waiting') {
    return (
      <div className="li-page">
        <div className="li-card">
          <div className="li-header">
            <div className="li-badge">⏳ Waiting Room</div>
            <h1 className="li-title">You're in!</h1>
            <p className="li-subtitle">
              Hi <strong>{name}</strong> — the interviewer will start the session shortly.
            </p>
          </div>
          <div className="li-waiting-pulse">
            <div className="li-pulse" />
            <span>Waiting for interviewer to start…</span>
          </div>
          <div className="li-meta" style={{ marginTop: '1.5rem' }}>
            <span className="li-meta-item">🎯 Role: <strong>{session?.jobRole}</strong></span>
            <span className="li-meta-item">⏱ Duration: <strong>{session?.durationMinutes} min</strong></span>
            <span className="li-meta-item">🎙 Interviewer: <strong>{session?.hostName}</strong></span>
          </div>
          <p className="li-start-hint" style={{ marginTop: '2rem' }}>
            Keep this tab open. You'll be redirected automatically when the interview starts.
          </p>
        </div>
      </div>
    );
  }

  // step === 'enter-name'
  return (
    <div className="li-page">
      <div className="li-card">
        <div className="li-header">
          <div className="li-badge">👤 Human Interview</div>
          <h1 className="li-title">Join Interview</h1>
          {session && (
            <p className="li-subtitle">
              You're joining a <strong>{session.jobRole}</strong> interview
              {session.hostName ? ` with ${session.hostName}` : ''}.
              Duration: <strong>{session.durationMinutes} min</strong>.
            </p>
          )}
        </div>

        <div className="li-join-form">
          <label className="li-setup-label">Your Full Name</label>
          <input
            className="li-setup-input"
            placeholder="Enter your full name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            autoFocus
          />
          {joinError && <div className="li-error">{joinError}</div>}
          <button
            className="li-start-btn"
            onClick={handleJoin}
            disabled={joining || !name.trim()}
          >
            {joining ? 'Joining…' : 'Join as Candidate →'}
          </button>
        </div>
      </div>
    </div>
  );
}
