/**
 * useCompositeRecorder
 *
 * Records the full interview session by:
 *  1. Capturing the screen/tab via getDisplayMedia (primary source)
 *  2. Overlaying the webcam as a PiP in the bottom-right corner on a canvas
 *  3. Mixing microphone audio via Web Audio API
 *  4. Feeding the composed canvas stream + audio into a single MediaRecorder
 *
 * Key reliability fix: uses setInterval instead of requestAnimationFrame so
 * the draw loop keeps running even when the tab loses focus during the
 * screen-share picker interaction.
 */

import { useRef, useCallback } from 'react';
import { RecordingResult } from '../services/webrtcRecorder';

// ── Constants ─────────────────────────────────────────────────────────────────
const CANVAS_W = 1280;
const CANVAS_H = 720;
const PIP_W = 240;
const PIP_H = 135;
const PIP_MARGIN = 16;
const FPS = 30;
const FRAME_INTERVAL_MS = Math.round(1000 / FPS);

// ── MIME type selection ───────────────────────────────────────────────────────
function getSupportedMimeType(): string {
  const candidates = [
    'video/mp4;codecs=h264,aac',
    'video/mp4;codecs=avc1,mp4a',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return 'video/webm';
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface CompositeRecorderReturn {
  startCompositeRecording: (webcamStream: MediaStream, preObtainedScreenStream?: MediaStream) => Promise<void>;
  stopCompositeRecording: () => Promise<RecordingResult | null>;
  cancelCompositeRecording: () => void;
  isCompositeSupported: () => boolean;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useCompositeRecorder(): CompositeRecorderReturn {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Use setInterval instead of rAF so drawing continues when tab is backgrounded
  const drawIntervalRef = useRef<number | null>(null);

  const screenVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);

  const screenTracksRef = useRef<MediaStreamTrack[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  // ── Feature detection ─────────────────────────────────────────────────────
  const isCompositeSupported = useCallback((): boolean => {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof (navigator.mediaDevices as any).getDisplayMedia === 'function' &&
      typeof MediaRecorder !== 'undefined' &&
      typeof HTMLCanvasElement !== 'undefined' &&
      typeof (HTMLCanvasElement.prototype as any).captureStream === 'function'
    );
  }, []);

  // ── Create a hidden off-screen video element that auto-plays ──────────────
  const makeVideoEl = (srcStream: MediaStream, muted: boolean): HTMLVideoElement => {
    const v = document.createElement('video');
    v.srcObject = srcStream;
    v.muted = muted;
    v.autoplay = true;
    v.playsInline = true;
    // Must be in the DOM and have non-zero dimensions for some browsers to decode
    v.style.cssText =
      'position:fixed;top:-9999px;left:-9999px;width:1280px;height:720px;opacity:0;pointer-events:none;';
    document.body.appendChild(v);
    return v;
  };

  // ── Wait for a video element to have enough data ──────────────────────────
  const waitForVideo = (v: HTMLVideoElement, maxMs = 3000): Promise<void> =>
    new Promise(resolve => {
      if (v.readyState >= 2) { resolve(); return; }
      const onReady = () => { v.removeEventListener('loadeddata', onReady); resolve(); };
      v.addEventListener('loadeddata', onReady);
      setTimeout(resolve, maxMs);
    });

  // ── Canvas draw loop (setInterval — survives tab backgrounding) ───────────
  const startDrawLoop = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawIntervalRef.current = window.setInterval(() => {
      // ── Primary: full-canvas screen capture ──
      const sv = screenVideoRef.current;
      if (sv && sv.readyState >= 2 && !sv.paused) {
        ctx.drawImage(sv, 0, 0, CANVAS_W, CANVAS_H);
      } else {
        // Dark placeholder while screen stream loads
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        // Label so it's obvious in the recording
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Loading screen capture…', CANVAS_W / 2, CANVAS_H / 2);
      }

      // ── PiP: webcam overlay — bottom-right corner ──
      const wv = webcamVideoRef.current;
      if (wv && wv.readyState >= 2) {
        const x = CANVAS_W - PIP_W - PIP_MARGIN;
        const y = CANVAS_H - PIP_H - PIP_MARGIN;
        const r = 10;

        // Rounded clip
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + PIP_W - r, y);
        ctx.quadraticCurveTo(x + PIP_W, y, x + PIP_W, y + r);
        ctx.lineTo(x + PIP_W, y + PIP_H - r);
        ctx.quadraticCurveTo(x + PIP_W, y + PIP_H, x + PIP_W - r, y + PIP_H);
        ctx.lineTo(x + r, y + PIP_H);
        ctx.quadraticCurveTo(x, y + PIP_H, x, y + PIP_H - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(wv, x, y, PIP_W, PIP_H);
        ctx.restore();

        // White border
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + PIP_W - r, y);
        ctx.quadraticCurveTo(x + PIP_W, y, x + PIP_W, y + r);
        ctx.lineTo(x + PIP_W, y + PIP_H - r);
        ctx.quadraticCurveTo(x + PIP_W, y + PIP_H, x + PIP_W - r, y + PIP_H);
        ctx.lineTo(x + r, y + PIP_H);
        ctx.quadraticCurveTo(x, y + PIP_H, x, y + PIP_H - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      }
    }, FRAME_INTERVAL_MS);
  }, []);

  // ── Mix audio via Web Audio API ───────────────────────────────────────────
  const buildAudioDestination = useCallback(
    (screenStream: MediaStream, webcamStream: MediaStream): MediaStreamAudioDestinationNode | null => {
      try {
        const actx = new AudioContext();
        audioContextRef.current = actx;
        const dest = actx.createMediaStreamDestination();

        const addAudio = (s: MediaStream) => {
          const tracks = s.getAudioTracks();
          if (tracks.length === 0) return;
          const src = actx.createMediaStreamSource(new MediaStream(tracks));
          src.connect(dest);
        };

        addAudio(webcamStream); // microphone (primary)
        addAudio(screenStream); // system audio if user shared it

        return dest;
      } catch (e) {
        console.warn('⚠️ AudioContext mixing failed, using webcam audio only:', e);
        return null;
      }
    },
    []
  );

  // ── Start composite recording ─────────────────────────────────────────────
  const startCompositeRecording = useCallback(
    async (webcamStream: MediaStream, preObtainedScreenStream?: MediaStream): Promise<void> => {
      console.log('🎬 Starting composite screen+webcam recording...');

      // 1. Use pre-obtained screen stream (from proctoring flow) or request a new one
      let screenStream: MediaStream;
      if (preObtainedScreenStream) {
        screenStream = preObtainedScreenStream;
        console.log('✅ Using pre-obtained screen stream from proctoring flow');
      } else {
        try {
          screenStream = await (navigator.mediaDevices as any).getDisplayMedia({
            video: {
              width: { ideal: CANVAS_W },
              height: { ideal: CANVAS_H },
              frameRate: { ideal: FPS },
              cursor: 'always',
            },
            audio: false,
          } as any);
        } catch (err) {
          throw new Error(
            'Screen capture permission denied. Please allow screen sharing to record the full session.'
          );
        }
      }

      screenTracksRef.current = screenStream.getTracks();

      // Stop recording if the user ends screen share manually
      screenStream.getVideoTracks()[0]?.addEventListener('ended', () => {
        console.warn('⚠️ Screen share ended by user — stopping composite recording');
        stopCompositeRecording();
      });

      // 2. Create hidden canvas
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      canvasRef.current = canvas;

      // 3. Create hidden video elements and start playing
      screenVideoRef.current = makeVideoEl(screenStream, true);
      webcamVideoRef.current = makeVideoEl(webcamStream, true);

      // Explicitly call play() — required in some browsers
      try { await screenVideoRef.current.play(); } catch (_) { /* autoplay may handle it */ }
      try { await webcamVideoRef.current.play(); } catch (_) { /* autoplay may handle it */ }

      // 4. Wait for both to have data
      await Promise.all([
        waitForVideo(screenVideoRef.current),
        waitForVideo(webcamVideoRef.current),
      ]);

      console.log(
        `📹 Screen video ready: ${screenVideoRef.current.videoWidth}×${screenVideoRef.current.videoHeight}`,
        `| Webcam ready: ${webcamVideoRef.current.videoWidth}×${webcamVideoRef.current.videoHeight}`
      );

      // 5. Start canvas draw loop (setInterval — survives tab backgrounding)
      startDrawLoop(canvas);

      // 6. Build composite MediaStream (canvas video + mixed audio)
      const canvasStream: MediaStream = (canvas as any).captureStream(FPS);
      const audioDest = buildAudioDestination(screenStream, webcamStream);

      const compositeStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...(audioDest
          ? audioDest.stream.getAudioTracks()
          : webcamStream.getAudioTracks()),
      ]);

      // 7. Start MediaRecorder on the composite stream
      const mimeType = getSupportedMimeType();
      console.log(`📹 Composite MIME type: ${mimeType}`);

      chunksRef.current = [];
      startTimeRef.current = Date.now();

      const recorder = new MediaRecorder(compositeStream, {
        mimeType,
        videoBitsPerSecond: 3_000_000,
        audioBitsPerSecond: 128_000,
      });

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
          console.log(`📦 Composite chunk: ${(e.data.size / 1024).toFixed(1)} KB`);
        }
      };

      recorder.onerror = (e: Event) => {
        console.error('❌ Composite MediaRecorder error:', e);
      };

      recorder.start(1000); // 1-second timeslices
      recorderRef.current = recorder;
      console.log('✅ Composite recording started — screen is primary source');
    },
    [startDrawLoop, buildAudioDestination]
  );

  // ── Stop composite recording ──────────────────────────────────────────────
  const stopCompositeRecording = useCallback((): Promise<RecordingResult | null> => {
    return new Promise(resolve => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        cleanup();
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const duration = Date.now() - startTimeRef.current;
        const mimeType = recorder.mimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        console.log(
          `✅ Composite recording stopped — ${(blob.size / 1024 / 1024).toFixed(2)} MB, ${Math.round(duration / 1000)}s, ${chunksRef.current.length} chunks`
        );
        cleanup();
        resolve({ blob, url, duration, size: blob.size });
      };

      recorder.stop();
    });
  }, []);

  // ── Cancel (discard) ──────────────────────────────────────────────────────
  const cancelCompositeRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
    chunksRef.current = [];
    cleanup();
  }, []);

  // ── Internal cleanup ──────────────────────────────────────────────────────
  function cleanup() {
    // Stop draw loop
    if (drawIntervalRef.current !== null) {
      clearInterval(drawIntervalRef.current);
      drawIntervalRef.current = null;
    }

    // Stop screen capture tracks
    screenTracksRef.current.forEach((t: MediaStreamTrack) => t.stop());
    screenTracksRef.current = [];

    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    // Remove hidden video elements
    [screenVideoRef, webcamVideoRef].forEach(ref => {
      if (ref.current) {
        ref.current.pause();
        ref.current.srcObject = null;
        ref.current.remove();
        ref.current = null;
      }
    });

    canvasRef.current = null;
    recorderRef.current = null;
  }

  return {
    startCompositeRecording,
    stopCompositeRecording,
    cancelCompositeRecording,
    isCompositeSupported,
  };
}
