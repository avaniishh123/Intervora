/**
 * HumanInterviewRoomPage — Google Meet-style video interview room.
 * Supports multiple participants via WebRTC mesh, mute/unmute,
 * camera toggle, live chat, and participant management.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import api from '../services/api';
import '../styles/LiveInterview.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RemotePeer {
  participantId: string;
  name: string;
  role: string;
  stream: MediaStream | null;
  muted: boolean;
  videoOff: boolean;
  pc: RTCPeerConnection;
}

interface ChatMsg {
  id: string;
  senderName: string;
  senderRole: string;
  text: string;
  timestamp: string;
  self: boolean;
}

// ── WebRTC helpers ────────────────────────────────────────────────────────────

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

function createPC(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS });
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

// ── Permission Gate ───────────────────────────────────────────────────────────

function PermissionGate({ onGranted }: { onGranted: (stream: MediaStream) => void }) {
  const [requesting, setRequesting] = useState(false);
  const [permError, setPermError] = useState('');

  const requestPermissions = async () => {
    setRequesting(true);
    setPermError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      onGranted(stream);
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Camera and microphone access was denied. Please allow access in your browser settings and try again.'
        : 'Could not access camera/microphone. Please check your device settings.';
      setPermError(msg);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="hir-perm-page">
      <div className="hir-perm-card">
        <div className="hir-perm-icon">🎥</div>
        <h2 className="hir-perm-title">Camera & Microphone Required</h2>
        <p className="hir-perm-desc">
          This interview requires access to your camera and microphone so other participants can see and hear you.
        </p>
        <ul className="hir-perm-list">
          <li>📷 Your camera will be used for video</li>
          <li>🎙️ Your microphone will be used for audio</li>
          <li>🔒 Your stream is peer-to-peer — not recorded by default</li>
          <li>🚫 You can mute or turn off camera at any time</li>
        </ul>
        <button className="hir-perm-btn" onClick={requestPermissions} disabled={requesting}>
          {requesting ? 'Requesting Access…' : 'Allow Camera & Microphone'}
        </button>
        {permError && <div className="hir-perm-error">{permError}</div>}
      </div>
    </div>
  );
}

// ── Main Room Component ───────────────────────────────────────────────────────

export default function HumanInterviewRoomPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as any;

  const role: string = state?.role ?? 'candidate';
  const jobRole: string = state?.jobRole ?? 'Interview';
  const durationMinutes: number = state?.durationMinutes ?? 25;
  const participantId: string = state?.participantId ?? `local-${Date.now()}`;
  const participantName: string = state?.participantName ?? (role === 'interviewer' ? 'Interviewer' : 'Candidate');

  // Media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [permGranted, setPermGranted] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);

  // Peers
  const [peers, setPeers] = useState<Map<string, RemotePeer>>(new Map());
  const peersRef = useRef<Map<string, RemotePeer>>(new Map());

  // Chat
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Timer
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // UI
  const [sideTab, setSideTab] = useState<'participants' | 'chat'>('participants');
  const [sessionEnded, setSessionEnded] = useState(false);
  const [endReason, setEndReason] = useState('');

  // Socket
  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // ── Permission granted → connect ──────────────────────────────────────────

  const handlePermGranted = useCallback((stream: MediaStream) => {
    setLocalStream(stream);
    setPermGranted(true);
  }, []);

  // ── Attach local stream to video element ──────────────────────────────────

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, permGranted]);

  // ── Socket + WebRTC setup ─────────────────────────────────────────────────

  useEffect(() => {
    if (!permGranted || !localStream || !sessionId) return;

    const socket = io(`${API_BASE}/live-interview`, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    // ── Helper: create peer connection for a remote participant ──
    const createPeerConnection = (remoteId: string, remoteName: string, remoteRole: string): RTCPeerConnection => {
      const pc = createPC();

      // Add local tracks
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

      // ICE candidates
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('live:webrtc:ice', { sessionId, to: remoteId, candidate: e.candidate });
        }
      };

      // Remote stream
      pc.ontrack = (e) => {
        const remoteStream = e.streams[0];
        setPeers(prev => {
          const next = new Map(prev);
          const peer = next.get(remoteId);
          if (peer) next.set(remoteId, { ...peer, stream: remoteStream });
          return next;
        });
        peersRef.current.get(remoteId) && (peersRef.current.get(remoteId)!.stream = remoteStream);
      };

      const peer: RemotePeer = { participantId: remoteId, name: remoteName, role: remoteRole, stream: null, muted: false, videoOff: false, pc };
      peersRef.current.set(remoteId, peer);
      setPeers(new Map(peersRef.current));
      return pc;
    };

    // ── Socket events ──

    socket.on('connect', () => {
      socket.emit('live:join', { sessionId, role, name: participantName, participantId });
    });

    // Another participant joined — we initiate offer
    socket.on('live:participant:joined', async ({ participantId: remoteId, name: remoteName, role: remoteRole }: any) => {
      if (remoteId === participantId) return;
      const pc = createPeerConnection(remoteId, remoteName, remoteRole);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('live:webrtc:offer', { sessionId, to: remoteId, offer, from: participantId, fromName: participantName, fromRole: role });
    });

    // Received offer — create answer
    socket.on('live:webrtc:offer', async ({ from, fromName, fromRole, offer }: any) => {
      let pc = peersRef.current.get(from)?.pc;
      if (!pc) {
        pc = createPeerConnection(from, fromName, fromRole);
      }
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('live:webrtc:answer', { sessionId, to: from, answer, from: participantId });
    });

    // Received answer
    socket.on('live:webrtc:answer', async ({ from, answer }: any) => {
      const pc = peersRef.current.get(from)?.pc;
      if (pc && pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    // ICE candidate
    socket.on('live:webrtc:ice', async ({ from, candidate }: any) => {
      const pc = peersRef.current.get(from)?.pc;
      if (pc) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* ignore */ }
      }
    });

    // Participant left
    socket.on('live:participant:left', ({ participantId: remoteId }: any) => {
      const peer = peersRef.current.get(remoteId);
      if (peer) {
        peer.pc.close();
        peersRef.current.delete(remoteId);
        setPeers(new Map(peersRef.current));
      }
    });

    // Chat message
    socket.on('live:message', (msg: any) => {
      setChatMsgs(prev => [...prev, { ...msg, self: msg.senderName === participantName }]);
    });

    // Timer tick
    socket.on('live:timer:tick', ({ secondsLeft: s }: any) => setSecondsLeft(s));

    // Session ended
    socket.on('live:session:end', ({ reason }: any) => {
      setSessionEnded(true);
      setEndReason(reason === 'time_expired' ? 'Time is up' : 'The interviewer has ended the session');
      if (timerRef.current) clearInterval(timerRef.current);
    });

    // Mute state update
    socket.on('live:media:update', ({ participantId: remoteId, muted, videoOff }: any) => {
      setPeers(prev => {
        const next = new Map(prev);
        const peer = next.get(remoteId);
        if (peer) next.set(remoteId, { ...peer, muted, videoOff });
        return next;
      });
    });

    return () => {
      socket.disconnect();
      peersRef.current.forEach(p => p.pc.close());
      peersRef.current.clear();
      setPeers(new Map());
    };
  }, [permGranted, localStream, sessionId, participantId, participantName, role]);

  // ── Scroll chat to bottom ─────────────────────────────────────────────────

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMsgs]);

  // ── Cleanup local stream on unmount ──────────────────────────────────────

  useEffect(() => {
    return () => {
      localStream?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [localStream]);

  // ── Controls ──────────────────────────────────────────────────────────────

  const toggleMic = () => {
    if (!localStream) return;
    const newMuted = !micMuted;
    localStream.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
    setMicMuted(newMuted);
    socketRef.current?.emit('live:media:update', { sessionId, participantId, muted: newMuted, videoOff: camOff });
  };

  const toggleCam = () => {
    if (!localStream) return;
    const newOff = !camOff;
    localStream.getVideoTracks().forEach(t => { t.enabled = !newOff; });
    setCamOff(newOff);
    socketRef.current?.emit('live:media:update', { sessionId, participantId, muted: micMuted, videoOff: newOff });
  };

  const sendChat = () => {
    if (!chatInput.trim() || !socketRef.current) return;
    socketRef.current.emit('live:message', {
      sessionId,
      text: chatInput.trim(),
      senderRole: role,
      senderName: participantName,
    });
    setChatInput('');
  };

  const handleEndSession = async () => {
    if (role !== 'interviewer' || !sessionId) return;
    try {
      await api.post(`/api/live/sessions/${sessionId}/end`);
      socketRef.current?.emit('live:session:end', { sessionId });
    } catch { /* best-effort */ }
    navigate(`/live/report/${sessionId}`);
  };

  const handleLeave = async () => {
    if (!sessionId) return;
    try {
      await api.post(`/api/live/sessions/${sessionId}/leave`, { participantId });
    } catch { /* best-effort */ }
    localStream?.getTracks().forEach(t => t.stop());
    navigate('/dashboard');
  };

  // ── Render: permission gate ───────────────────────────────────────────────

  if (!permGranted) {
    return <PermissionGate onGranted={handlePermGranted} />;
  }

  // ── Render: video grid ────────────────────────────────────────────────────

  const allParticipants = [
    { participantId, name: participantName, role, stream: localStream, muted: micMuted, videoOff: camOff, isSelf: true },
    ...Array.from(peers.values()).map(p => ({ ...p, isSelf: false })),
  ];

  const gridClass = `hir-video-grid hir-video-grid--${Math.min(allParticipants.length, 6)}`;

  return (
    <div className="hir-page">
      {/* Top bar */}
      <div className="hir-topbar">
        <div className="hir-topbar-left">
          <span className="hir-logo">🎯 Intervora</span>
          <span className="hir-session-info">{jobRole} · {role}</span>
        </div>
        <div className="hir-topbar-center">
          <div className={`hir-timer${secondsLeft <= 60 ? ' hir-timer--warning' : ''}`}>
            ⏱ {formatTime(secondsLeft)}
          </div>
        </div>
        <div className="hir-topbar-right">
          {role === 'interviewer' ? (
            <button className="hir-ctrl-btn hir-ctrl-btn--danger" onClick={handleEndSession}>
              <span className="hir-ctrl-icon">⏹</span>
              End
            </button>
          ) : (
            <button className="hir-ctrl-btn" onClick={handleLeave}>
              <span className="hir-ctrl-icon">🚪</span>
              Leave
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="hir-body">
        {/* Video area */}
        <div className="hir-video-area">
          <div className={gridClass}>
            {allParticipants.map(p => (
              <VideoTile
                key={p.participantId}
                name={p.name}
                role={p.role}
                stream={p.stream}
                muted={p.muted}
                videoOff={p.videoOff}
                isSelf={p.isSelf}
              />
            ))}
          </div>

          {/* Controls */}
          <div className="hir-controls">
            <button
              className={`hir-ctrl-btn${micMuted ? ' hir-ctrl-btn--active' : ''}`}
              onClick={toggleMic}
            >
              <span className="hir-ctrl-icon">{micMuted ? '🔇' : '🎙️'}</span>
              {micMuted ? 'Unmute' : 'Mute'}
            </button>
            <button
              className={`hir-ctrl-btn${camOff ? ' hir-ctrl-btn--active' : ''}`}
              onClick={toggleCam}
            >
              <span className="hir-ctrl-icon">{camOff ? '📷' : '📹'}</span>
              {camOff ? 'Start Video' : 'Stop Video'}
            </button>
            <button className="hir-ctrl-btn" onClick={() => setSideTab('participants')}>
              <span className="hir-ctrl-icon">👥</span>
              People ({allParticipants.length})
            </button>
            <button className="hir-ctrl-btn" onClick={() => setSideTab('chat')}>
              <span className="hir-ctrl-icon">💬</span>
              Chat
            </button>
          </div>
        </div>

        {/* Side panel */}
        <div className="hir-side-panel">
          <div className="hir-side-tabs">
            <button
              className={`hir-side-tab${sideTab === 'participants' ? ' hir-side-tab--active' : ''}`}
              onClick={() => setSideTab('participants')}
            >
              People ({allParticipants.length})
            </button>
            <button
              className={`hir-side-tab${sideTab === 'chat' ? ' hir-side-tab--active' : ''}`}
              onClick={() => setSideTab('chat')}
            >
              Chat {chatMsgs.length > 0 && `(${chatMsgs.length})`}
            </button>
          </div>

          {sideTab === 'participants' ? (
            <div className="hir-side-content">
              {allParticipants.map(p => (
                <div key={p.participantId} className="hir-participant-item">
                  <div className="hir-participant-avatar">{p.name.charAt(0).toUpperCase()}</div>
                  <div className="hir-participant-info">
                    <div className="hir-participant-name">{p.name}{p.isSelf ? ' (You)' : ''}</div>
                    <div className="hir-participant-role">{p.role}</div>
                  </div>
                  {p.muted && <span className="hir-participant-muted">🔇</span>}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="hir-side-content">
                <div className="hir-chat-messages">
                  {chatMsgs.length === 0 && (
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                      No messages yet
                    </div>
                  )}
                  {chatMsgs.map(m => (
                    <div key={m.id} className={`hir-chat-msg${m.self ? ' hir-chat-msg--self' : ''}`}>
                      <div className="hir-chat-msg-meta">{m.senderName} · {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <div className="hir-chat-msg-text">{m.text}</div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </div>
              <div className="hir-chat-input-area">
                <textarea
                  className="hir-chat-input"
                  rows={2}
                  placeholder="Type a message…"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                />
                <button className="hir-chat-send" onClick={sendChat} disabled={!chatInput.trim()}>Send</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Session ended overlay */}
      {sessionEnded && (
        <div className="hir-ended-overlay">
          <div className="hir-ended-card">
            <div className="hir-ended-icon">🏁</div>
            <h2 className="hir-ended-title">Session Ended</h2>
            <p className="hir-ended-sub">{endReason}</p>
            <button
              className="hir-ended-btn"
              onClick={() => role === 'interviewer'
                ? navigate(`/live/report/${sessionId}`)
                : navigate('/dashboard')
              }
            >
              {role === 'interviewer' ? 'Submit Report →' : 'Back to Dashboard'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── VideoTile sub-component ───────────────────────────────────────────────────

interface VideoTileProps {
  name: string;
  role: string;
  stream: MediaStream | null;
  muted: boolean;
  videoOff: boolean;
  isSelf: boolean;
}

function VideoTile({ name, stream, muted, videoOff, isSelf }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`hir-video-tile${isSelf ? ' hir-video-tile--self' : ''}`}>
      {stream && !videoOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf} // always mute self to avoid echo
        />
      ) : (
        <div className="hir-video-avatar">
          <div className="hir-video-avatar-letter">{name.charAt(0).toUpperCase()}</div>
        </div>
      )}
      <div className="hir-video-tile-overlay">
        <span className="hir-tile-name">{name}{isSelf ? ' (You)' : ''}</span>
        {muted && <span className="hir-tile-muted">🔇</span>}
      </div>
    </div>
  );
}
