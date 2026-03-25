import { useState, useEffect, useRef, useCallback } from 'react';

export type ProctoringPhase =
  | 'requesting-screen-share' // Step 1: ask user to share their screen/tab
  | 'requesting-fullscreen'   // Step 2: ask user to enter fullscreen
  | 'active'                  // Interview running, monitoring
  | 'warning'                 // Violation detected, showing warning
  | 'terminated';             // Max violations exceeded → session ended

export interface ProctoringState {
  phase: ProctoringPhase;
  warningCount: number;
  isFullscreen: boolean;
  violationReason: string | null;
}

interface UseInterviewProctoringOptions {
  /** Called when screen share is granted — host should start composite recording */
  onScreenShareGranted?: (screenStream: MediaStream) => void;
  /** Called when the candidate successfully enters fullscreen for the first time */
  onFullscreenGranted?: () => void;
  /** Called when max violations are exceeded — host should end the session */
  onTerminate?: () => void;
  /** Max warnings before auto-termination (default: 3) */
  maxWarnings?: number;
  /** Whether proctoring is active (set false to disable entirely) */
  enabled?: boolean;
}

const MAX_WARNINGS_DEFAULT = 3;

export function useInterviewProctor({
  onScreenShareGranted,
  onFullscreenGranted,
  onTerminate,
  maxWarnings = MAX_WARNINGS_DEFAULT,
  enabled = true,
}: UseInterviewProctoringOptions = {}) {
  // Start at screen-share step so it happens before fullscreen
  const [phase, setPhase] = useState<ProctoringPhase>('requesting-screen-share');
  const [warningCount, setWarningCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [violationReason, setViolationReason] = useState<string | null>(null);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);

  const hasGrantedOnce = useRef(false);
  const terminatedRef = useRef(false);
  const warningCountRef = useRef(0);

  // ── Step 1: Request screen share (entire screen only) ──────────────────────

  const requestScreenShare = useCallback(async () => {
    setScreenShareError(null);

    const attemptCapture = async (): Promise<void> => {
      let screenStream: MediaStream;
      try {
        screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
          video: {
            // No width/height constraints — let the OS report native resolution
            frameRate: { ideal: 30 },
            cursor: 'always',
          },
          audio: false,
        } as any);
      } catch (err: any) {
        const msg =
          err?.name === 'NotAllowedError'
            ? 'Screen sharing was denied. Please allow screen sharing to continue.'
            : 'Screen sharing failed. Please try again.';
        setScreenShareError(msg);
        console.error('❌ Screen share request failed:', err);
        return;
      }

      // ── Validate: must be "monitor" (entire screen), not "browser" or "window" ──
      const track = screenStream.getVideoTracks()[0];
      const settings = track?.getSettings() as any;
      const surface: string = settings?.displaySurface ?? '';

      console.log(`🖥️ Selected display surface: "${surface || 'unknown'}"`, settings);

      // Accept only 'monitor' (entire screen). Reject 'browser' (tab) and 'window'.
      if (surface && surface !== 'monitor') {
        // Stop the rejected stream immediately
        screenStream.getTracks().forEach(t => t.stop());

        const surfaceLabel = surface === 'browser' ? 'a browser tab' : 'a window';
        setScreenShareError(
          `You selected ${surfaceLabel}. Please select "Entire Screen" to continue. Click "Share Screen" again and choose the "Entire screen" tab in the picker.`
        );
        console.warn(`⚠️ Rejected display surface "${surface}" — only "monitor" (entire screen) is allowed`);
        return;
      }

      // If surface is empty (Firefox / older browsers don't expose it), fall back to
      // dimension check: entire screen should match or exceed the window dimensions.
      if (!surface) {
        const trackW = settings?.width ?? 0;
        const trackH = settings?.height ?? 0;
        const screenW = window.screen.width;
        const screenH = window.screen.height;

        // Allow ±10% tolerance for HiDPI / scaled displays
        const widthOk = trackW === 0 || trackW >= screenW * 0.9;
        const heightOk = trackH === 0 || trackH >= screenH * 0.9;

        if (!widthOk || !heightOk) {
          screenStream.getTracks().forEach(t => t.stop());
          setScreenShareError(
            `The selected source appears to be a tab or window (${trackW}×${trackH}), not the entire screen (${screenW}×${screenH}). Please select "Entire Screen" and try again.`
          );
          console.warn(`⚠️ Dimension check failed: stream ${trackW}×${trackH} vs screen ${screenW}×${screenH}`);
          return;
        }
      }

      // ── Valid entire-screen stream — proceed ──
      console.log('✅ Entire screen capture confirmed');
      onScreenShareGranted?.(screenStream);
      setPhase('requesting-fullscreen');
    };

    await attemptCapture();
  }, [onScreenShareGranted]);

  // ── Step 2: Enter fullscreen ─────────────────────────────────────────────────

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
  }, []);

  const isCurrentlyFullscreen = () =>
    !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );

  // ── Violation handler ───────────────────────────────────────────────────────

  const handleViolation = useCallback(
    (reason: string) => {
      if (!enabled || terminatedRef.current) return;

      const newCount = warningCountRef.current + 1;
      warningCountRef.current = newCount;
      setWarningCount(newCount);
      setViolationReason(reason);

      if (newCount >= maxWarnings) {
        terminatedRef.current = true;
        setPhase('terminated');
        onTerminate?.();
      } else {
        setPhase('warning');
      }
    },
    [enabled, maxWarnings, onTerminate]
  );

  // ── Fullscreen change listener ──────────────────────────────────────────────

  useEffect(() => {
    if (!enabled) return;

    const onFsChange = () => {
      const fs = isCurrentlyFullscreen();
      setIsFullscreen(fs);

      if (fs) {
        if (!hasGrantedOnce.current) {
          hasGrantedOnce.current = true;
          setPhase('active');
          onFullscreenGranted?.();
        } else if (phase === 'warning' || phase === 'requesting-fullscreen') {
          setPhase('active');
          setViolationReason(null);
        }
      } else {
        if (hasGrantedOnce.current && !terminatedRef.current) {
          handleViolation('You exited full-screen mode.');
        }
      }
    };

    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    document.addEventListener('mozfullscreenchange', onFsChange);
    document.addEventListener('MSFullscreenChange', onFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
      document.removeEventListener('mozfullscreenchange', onFsChange);
      document.removeEventListener('MSFullscreenChange', onFsChange);
    };
  }, [enabled, phase, handleViolation, onFullscreenGranted]);

  // ── Visibility / tab-switch listener ───────────────────────────────────────

  useEffect(() => {
    if (!enabled) return;

    const onVisibilityChange = () => {
      if (document.hidden && hasGrantedOnce.current && !terminatedRef.current) {
        handleViolation('You switched tabs or minimized the window.');
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [enabled, handleViolation]);

  // ── Keyboard shortcuts that could aid cheating ──────────────────────────────

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!hasGrantedOnce.current || terminatedRef.current) return;

      const blocked =
        (e.altKey && e.key === 'Tab') ||
        (e.ctrlKey && ['w', 'W', 't', 'T', 'n', 'N'].includes(e.key)) ||
        e.key === 'F12' ||
        e.key === 'Meta';

      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [enabled]);

  // ── Context-menu restriction (copy/paste intentionally allowed) ─────────────

  useEffect(() => {
    if (!enabled) return;

    const preventContextMenu = (e: Event) => {
      if (hasGrantedOnce.current && !terminatedRef.current) e.preventDefault();
    };

    document.addEventListener('contextmenu', preventContextMenu);

    return () => {
      document.removeEventListener('contextmenu', preventContextMenu);
    };
  }, [enabled]);

  // ── Dismiss warning (candidate re-enters fullscreen via the overlay button) ─

  const dismissWarning = useCallback(() => {
    if (phase === 'warning') {
      enterFullscreen();
    }
  }, [phase, enterFullscreen]);

  return {
    proctoringState: {
      phase,
      warningCount,
      isFullscreen,
      violationReason,
    } as ProctoringState,
    screenShareError,
    requestScreenShare,
    enterFullscreen,
    dismissWarning,
    maxWarnings,
  };
}
