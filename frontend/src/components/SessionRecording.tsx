import { useState, useRef } from 'react';
import api from '../services/api';
import '../styles/SessionRecording.css';

interface SessionRecordingProps {
  sessionId: string;
  recordingUrl: string;
  localBlobUrl?: string | null;
  localBlobExt?: string;
  onRecordingDeleted?: () => void;
}

const SessionRecording = ({
  sessionId,
  recordingUrl,
  localBlobUrl,
  localBlobExt = 'webm',
  onRecordingDeleted,
}: SessionRecordingProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Video event handlers ──────────────────────────────────────────────────

  const handlePlayPause = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) { v.pause(); } else { v.play().catch(console.error); }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setIsLoading(false);
    }
  };

  const handleCanPlay = () => setIsLoading(false);

  const handleVideoError = () => {
    setVideoError('Unable to load the recording. The file may be unavailable or the format is unsupported.');
    setIsLoading(false);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    if (videoRef.current) { videoRef.current.currentTime = t; setCurrentTime(t); }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    setIsMuted(v === 0);
    if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (videoRef.current) {
      videoRef.current.muted = next;
      if (!next && volume === 0) { setVolume(0.5); videoRef.current.volume = 0.5; }
    }
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  const handleFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen();
    else if ((v as any).webkitRequestFullscreen) (v as any).webkitRequestFullscreen();
    else if ((v as any).mozRequestFullScreen) (v as any).mozRequestFullScreen();
  };

  // ── Delete handler ────────────────────────────────────────────────────────

  const handleDeleteRecording = async () => {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/api/sessions/${sessionId}/recording`);
      setShowDeleteDialog(false);
      onRecordingDeleted?.();
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || 'Failed to delete recording. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const fmt = (s: number) => {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const volumeIcon = isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊';

  return (
    <div className="sr-section">
      {/* ── Header ── */}
      <div className="sr-header">
        <div className="sr-title">
          <span className="sr-title-icon">🎬</span>
          <span>Session Recording</span>
        </div>
        <div className="sr-header-actions">
          {(localBlobUrl || recordingUrl) && (
            <a
              href={localBlobUrl || recordingUrl}
              download={`interview-recording.${localBlobExt}`}
              className="sr-download-btn"
              aria-label="Download recording"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download
            </a>
          )}
          <button className="sr-delete-btn" onClick={() => setShowDeleteDialog(true)} aria-label="Delete recording">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            Delete Recording
          </button>
        </div>
      </div>

      {/* ── Delete Dialog ── */}
      {showDeleteDialog && (
        <div className="sr-overlay" role="alertdialog" aria-modal="true" aria-labelledby="sr-del-title">
          <div className="sr-dialog">
            <div className="sr-dialog-icon">🗑️</div>
            <h3 id="sr-del-title" className="sr-dialog-title">Delete Recording?</h3>
            <p className="sr-dialog-msg">Are you sure you want to delete the recording of this session? Please note that once this recording is deleted, it cannot be recovered.</p>
            {deleteError && <p className="sr-dialog-err">{deleteError}</p>}
            <div className="sr-dialog-actions">
              <button className="sr-btn-cancel" onClick={() => { setShowDeleteDialog(false); setDeleteError(null); }} disabled={isDeleting}>Cancel</button>
              <button className="sr-btn-proceed" onClick={handleDeleteRecording} disabled={isDeleting}>{isDeleting ? 'Deleting…' : 'Proceed'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Player ── */}
      <div className="sr-body">
        <div className="sr-video-wrapper">
          {isLoading && !videoError && (
            <div className="sr-video-loading"><div className="sr-spinner"/><span>Loading recording…</span></div>
          )}
          {videoError ? (
            <div className="sr-video-error"><span>⚠️</span><p>{videoError}</p></div>
          ) : (
            <video
              ref={videoRef}
              className="sr-video"
              src={recordingUrl}
              preload="metadata"
              playsInline
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onCanPlay={handleCanPlay}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              onError={handleVideoError}
            />
          )}
        </div>

        {/* Controls */}
        <div className="sr-controls">
          {/* Progress bar */}
          <div className="sr-progress-row">
            <span className="sr-time">{fmt(currentTime)}</span>
            <div className="sr-progress-track">
              <div className="sr-progress-fill" style={{ width: `${progressPct}%` }} />
              <input type="range" className="sr-seek" min={0} max={duration || 0} step={0.1} value={currentTime} onChange={handleSeek} aria-label="Seek" />
            </div>
            <span className="sr-time">{fmt(duration)}</span>
          </div>

          {/* Buttons row */}
          <div className="sr-btn-row">
            <button className="sr-play-btn" onClick={handlePlayPause} aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying
                ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
              }
            </button>

            {/* Volume */}
            <div className="sr-volume-group">
              <button className="sr-icon-btn" onClick={toggleMute} aria-label="Toggle mute">{volumeIcon}</button>
              <input type="range" className="sr-volume" min={0} max={1} step={0.05} value={isMuted ? 0 : volume} onChange={handleVolumeChange} aria-label="Volume" />
            </div>

            {/* Speed */}
            <div className="sr-speed-group">
              <span className="sr-speed-label">Speed</span>
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => (
                <button key={r} className={`sr-speed-btn${playbackRate === r ? ' active' : ''}`} onClick={() => handleRateChange(r)}>{r}x</button>
              ))}
            </div>

            {/* Fullscreen */}
            <button className="sr-icon-btn sr-fullscreen-btn" onClick={handleFullscreen} aria-label="Fullscreen" title="Fullscreen">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionRecording;
