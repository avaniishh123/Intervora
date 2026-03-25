/**
 * JoinSessionPage — public page for participants to join a Human Interview session.
 * No authentication required. Participant enters their name, joins the room,
 * then polls until the host starts — at which point they are redirected to the
 * interview page as a candidate.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import '../styles/HybridWaitingRoom.css';

interface Room {
  sessionId: string;
  jobRole: string;
  hostName: string;
  status: 'waiting' | 'started' | 'ended';
  participants: { id: string; name: string }[];
  startedAt?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function fetchJson(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? 'Request failed');
  return json;
}

export default function JoinSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState<'enter-name' | 'waiting'>('enter-name');
  const [name, setName] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [participantId, setParticipantId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep refs so pollRoom closure always has latest values
  const participantIdRef = useRef('');
  const nameRef = useRef('');

  useEffect(() => { participantIdRef.current = participantId; }, [participantId]);
  useEffect(() => { nameRef.current = name; }, [name]);

  // Fetch room info on mount to validate the session exists
  useEffect(() => {
    if (!sessionId) return;
    fetchJson(`/api/hybrid/rooms/${sessionId}`)
      .then(data => setRoom(data.data.room))
      .catch(() => setError('Session not found or has expired.'));
  }, [sessionId]);

  const pollRoom = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await fetchJson(`/api/hybrid/rooms/${sessionId}`);
      const r: Room = data.data.room;
      setRoom(r);
      if (r.status === 'started') {
        if (pollRef.current) clearInterval(pollRef.current);
        navigate(`/hybrid/interview/${sessionId}`, {
          state: {
            mode: 'human',
            jobRole: r.jobRole,
            participantName: nameRef.current,
            participantId: participantIdRef.current,
            isHost: false,
            isGuest: true,
            startedAt: r.startedAt,
          },
        });
      }
    } catch {
      // ignore transient errors
    }
  }, [sessionId, navigate]);

  const handleJoin = async () => {
    if (!name.trim() || !sessionId) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchJson(`/api/hybrid/rooms/${sessionId}/join`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      });
      const pid = data.data.participant.id;
      setParticipantId(pid);
      participantIdRef.current = pid;
      setRoom(data.data.room);
      setStep('waiting');
      pollRef.current = setInterval(pollRoom, 3000);
    } catch (err: any) {
      setError(err.message ?? 'Failed to join session.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  if (error && step === 'enter-name') {
    return (
      <div className="hwr-page">
        <div className="hwr-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
          <h2 style={{ color: '#fff', marginBottom: '0.5rem' }}>Session Unavailable</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>{error}</p>
        </div>
      </div>
    );
  }

  if (step === 'enter-name') {
    return (
      <div className="hwr-page">
        <div className="hwr-card">
          <div className="hwr-header">
            <div className="hwr-badge">👤 Human Interview</div>
            <h1 className="hwr-title">Join Session</h1>
            {room && (
              <p className="hwr-subtitle">
                You're joining a <strong>{room.jobRole}</strong> interview hosted by{' '}
                <strong>{room.hostName}</strong>.
              </p>
            )}
          </div>

          <div className="hwr-join-form">
            <label className="hwr-join-label">Your Name</label>
            <input
              className="hwr-join-input"
              placeholder="Enter your full name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              autoFocus
            />
            {error && <div className="hwr-error">{error}</div>}
            <button
              className="hwr-start-btn"
              onClick={handleJoin}
              disabled={loading || !name.trim()}
            >
              {loading ? 'Joining…' : 'Join Waiting Room →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // step === 'waiting'
  return (
    <div className="hwr-page">
      <div className="hwr-card">
        <div className="hwr-header">
          <div className="hwr-badge">⏳ Waiting Room</div>
          <h1 className="hwr-title">You're in!</h1>
          <p className="hwr-subtitle">
            Hi <strong>{name}</strong> — the host will start the interview shortly.
          </p>
        </div>

        <div className="hwr-waiting-indicator">
          <div className="hwr-pulse" />
          <span>Waiting for host to start…</span>
        </div>

        {room && (
          <div className="hwr-meta" style={{ marginTop: '1.5rem' }}>
            <span className="hwr-meta-item">🎯 Role: <strong>{room.jobRole}</strong></span>
            <span className="hwr-meta-item">
              👥 {room.participants.length} participant{room.participants.length !== 1 ? 's' : ''} joined
            </span>
          </div>
        )}

        <p className="hwr-start-hint" style={{ marginTop: '2rem' }}>
          Keep this tab open. You'll be redirected automatically when the interview starts.
        </p>
      </div>
    </div>
  );
}
