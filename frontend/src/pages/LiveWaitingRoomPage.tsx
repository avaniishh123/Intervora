/**
 * LiveWaitingRoomPage — Interviewer waits for candidate to join.
 * Shows shareable link, participant list, and Start button.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import '../styles/LiveInterview.css';

interface Participant {
  id: string;
  name: string;
  role: 'interviewer' | 'candidate';
  joinedAt: string;
}

interface Session {
  sessionId: string;
  jobRole: string;
  durationMinutes: number;
  hostName: string;
  status: 'waiting' | 'active' | 'ended' | 'reported';
  participants: Participant[];
  startedAt?: string;
}

export default function LiveWaitingRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const joinUrl = `${window.location.origin}/live/join/${sessionId}`;

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await api.get(`/api/live/sessions/${sessionId}`);
      const s: Session = res.data.data.session;
      setSession(s);
      if (s.status === 'active') {
        navigate(`/live/interview/${sessionId}`, {
          state: { role: 'interviewer', jobRole: s.jobRole, durationMinutes: s.durationMinutes },
        });
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to load session.');
    }
  }, [sessionId, navigate]);

  useEffect(() => {
    fetchSession();
    pollRef.current = setInterval(fetchSession, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchSession]);

  const handleCopy = () => {
    navigator.clipboard.writeText(joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleStart = async () => {
    if (!sessionId) return;
    setStarting(true);
    setError('');
    try {
      await api.post(`/api/live/sessions/${sessionId}/start`);
      navigate(`/live/interview/${sessionId}`, {
        state: {
          role: 'interviewer',
          jobRole: session?.jobRole,
          durationMinutes: session?.durationMinutes,
        },
      });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to start session.');
      setStarting(false);
    }
  };

  const activeParticipants = session?.participants.filter(p => !('leftAt' in p && p.leftAt)) ?? [];
  const candidate = activeParticipants.find(p => p.role === 'candidate');

  return (
    <div className="li-page">
      <button className="li-back-btn" onClick={() => navigate('/dashboard')}>← Back</button>
      <div className="li-card">
        <div className="li-header">
          <div className="li-badge">👤 Human Interview</div>
          <h1 className="li-title">Waiting Room</h1>
          <p className="li-subtitle">Share the link below so participants can join before you start.</p>
        </div>

        <div className="li-link-box">
          <div className="li-link-label">Join Link</div>
          <div className="li-link-row">
            <input className="li-link-input" readOnly value={joinUrl} onFocus={e => e.target.select()} />
            <button className="li-copy-btn" onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p className="li-link-hint">
            Works with ngrok — the link uses your current base URL automatically.
          </p>
        </div>

        <div className="li-meta">
          <span className="li-meta-item">🎯 Role: <strong>{session?.jobRole ?? '...'}</strong></span>
          <span className="li-meta-item">🆔 Session: <code>{sessionId?.slice(0, 8)}…</code></span>
        </div>

        <div className="li-participants">
          <div className="li-participants-header">
            Participants
            <span className="li-participants-count">{activeParticipants.length} / 2</span>
          </div>
          {activeParticipants.length === 0 ? (
            <div className="li-empty">
              <div className="li-empty-icon">⏳</div>
              <div>Waiting for candidate to join…</div>
            </div>
          ) : (
            <ul className="li-participant-list">
              {activeParticipants.map(p => (
                <li key={p.id} className="li-participant-item">
                  <span className="li-participant-avatar">{p.name.charAt(0).toUpperCase()}</span>
                  <span className="li-participant-name">{p.name}</span>
                  <span className={`li-participant-role li-participant-role--${p.role}`}>{p.role}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <div className="li-error">{error}</div>}

        <button
          className="li-start-btn"
          onClick={handleStart}
          disabled={starting}
          title="Start the interview"
        >
          {starting ? 'Starting…' : 'Start Interview →'}
        </button>
        <p className="li-start-hint">
          You can start even with no participants — they can still join via the link.
        </p>
      </div>
    </div>
  );
}
