/**
 * HybridWaitingRoomPage — host waiting room for Human Interview Mode.
 * Shows the shareable join link and lists participants as they join.
 * Host clicks "Start Interview" when ready.
 * Uses polling (no WebSockets) to stay in sync with the backend room state.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { useNavGuard } from '../hooks/useNavGuard';
import { getJoinUrl } from '../utils/joinUrl';
import '../styles/HybridWaitingRoom.css';

interface Participant {
  id: string;
  name: string;
  joinedAt: string;
}

interface Room {
  sessionId: string;
  jobRole: string;
  hostName: string;
  status: 'waiting' | 'started' | 'ended';
  participants: Participant[];
  startedAt?: string;
}

export default function HybridWaitingRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const jobRole = (location.state as any)?.jobRole ?? 'Software Engineer';

  const [room, setRoom] = useState<Room | null>(null);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Prevent accidental back navigation while in waiting room
  const navGuard = useNavGuard(true, 'Are you sure you want to leave the waiting room? The session will be cancelled.');

  const joinUrl = sessionId ? getJoinUrl(sessionId) : '';

  const handleBack = () => {
    navGuard.bypass();
    navigate('/dashboard');
  };

  const fetchRoom = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await api.get(`/api/hybrid/rooms/${sessionId}`);
      const r: Room = res.data.data.room;
      setRoom(r);
      if (r.status === 'started') {
        navigate(`/hybrid/interview/${sessionId}`, {
          state: { mode: 'human', jobRole: r.jobRole, isHost: true, startedAt: r.startedAt },
        });
      }
    } catch {
      // Room may not exist yet on first render — ignore
    }
  }, [sessionId, navigate]);

  useEffect(() => {
    fetchRoom();
    pollRef.current = setInterval(fetchRoom, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchRoom]);

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
      const res = await api.post(`/api/hybrid/rooms/${sessionId}/start`);
      const startedAt = res.data?.data?.room?.startedAt;
      navigate(`/hybrid/interview/${sessionId}`, {
        state: { mode: 'human', jobRole, isHost: true, startedAt },
      });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to start session.');
      setStarting(false);
    }
  };

  return (
    <div className="hwr-page">
      <button className="hwr-back-btn" onClick={handleBack}>← Back</button>
      <div className="hwr-card">
        <div className="hwr-header">
          <div className="hwr-badge">👤 Human Interview</div>
          <h1 className="hwr-title">Waiting Room</h1>
          <p className="hwr-subtitle">
            Share the link below so participants can join before you start.
          </p>
        </div>

        {/* Shareable link */}
        <div className="hwr-link-box">
          <div className="hwr-link-label">Join Link</div>
          <div className="hwr-link-row">
            <input
              className="hwr-link-input"
              readOnly
              value={joinUrl}
              onFocus={e => e.target.select()}
            />
            <button className="hwr-copy-btn" onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
          <p className="hwr-link-hint">
            Works with ngrok — the link uses your current base URL automatically.
          </p>
        </div>

        {/* Session info */}
        <div className="hwr-meta">
          <span className="hwr-meta-item">🎯 Role: <strong>{jobRole}</strong></span>
          <span className="hwr-meta-item">🆔 Session: <code>{sessionId?.slice(0, 8)}…</code></span>
        </div>

        {/* Participants list */}
        <div className="hwr-participants">
          <div className="hwr-participants-header">
            Participants
            <span className="hwr-participants-count">
              {room?.participants.length ?? 0}
            </span>
          </div>

          {!room || room.participants.length === 0 ? (
            <div className="hwr-empty">
              <div className="hwr-empty-icon">⏳</div>
              <div>Waiting for participants to join…</div>
            </div>
          ) : (
            <ul className="hwr-participant-list">
              {room.participants.map(p => (
                <li key={p.id} className="hwr-participant-item">
                  <span className="hwr-participant-avatar">
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="hwr-participant-name">{p.name}</span>
                  <span className="hwr-participant-time">
                    {new Date(p.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <div className="hwr-error">{error}</div>}

        <button
          className="hwr-start-btn"
          onClick={handleStart}
          disabled={starting}
        >
          {starting ? 'Starting…' : 'Start Interview →'}
        </button>

        <p className="hwr-start-hint">
          You can start even with no participants — they can still join via the link.
        </p>
      </div>
    </div>
  );
}
