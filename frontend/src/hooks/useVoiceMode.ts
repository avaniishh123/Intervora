/**
 * useVoiceMode — strict turn-taking speech-to-text for interview voice mode.
 *
 * Turn-taking contract:
 *   1. While the AI is speaking (TTS active) → mic is BLOCKED, recognition
 *      will not start or restart even if `start()` is called.
 *   2. Once `setAiSpeaking(false)` is called (TTS ended) → recognition
 *      activates automatically if `start()` was already requested.
 *   3. No auto-submit: the candidate must press Submit explicitly.
 *      `onSilenceDetected` is intentionally removed.
 *
 * Other behaviours (unchanged from previous version):
 *   - Keeps SpeechRecognition alive continuously (auto-restarts on `onend`)
 *   - Accumulates interim + final results into one coherent running transcript
 *   - Short pauses do NOT split the transcript
 *   - Graceful fallback when API is unsupported
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseVoiceModeOptions {
  /** Called with the latest live text on every recognition event */
  onLiveTranscript?: (text: string) => void;
  language?: string;
}

interface UseVoiceModeReturn {
  isSupported: boolean;
  /** True only when the mic is actively capturing candidate speech */
  isListening: boolean;
  /** True when blocked because AI TTS is playing */
  isAiSpeaking: boolean;
  /** The current accumulated transcript shown in real-time */
  liveText: string;
  error: string | null;
  /**
   * Call this when the user selects voice mode for a question.
   * If AI is still speaking, mic activation is deferred until TTS ends.
   */
  start: () => void;
  /** Stop mic and clear all state */
  stop: () => void;
  /** Stop + wipe transcript (call between questions) */
  reset: () => void;
  /**
   * Notify the hook whether the AI TTS is currently playing.
   * Pass `true` when TTS starts, `false` when it ends.
   * When set to `false` and `start()` was already called, mic activates.
   */
  setAiSpeaking: (speaking: boolean) => void;
}

export function useVoiceMode({
  onLiveTranscript,
  language = 'en-US',
}: UseVoiceModeOptions = {}): UseVoiceModeReturn {
  const [isListening, setIsListening] = useState(false);
  const [isAiSpeaking, setIsAiSpeakingState] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const committedRef = useRef('');     // final segments accumulated
  const activeRef = useRef(false);    // whether the user WANTS mic on
  const aiSpeakingRef = useRef(false);// mirror of isAiSpeaking for callbacks
  const restartingRef = useRef(false);// guard against double-start

  const isSupported =
    typeof window !== 'undefined' &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // ── internal: actually start the recognition engine ───────────────────────

  const _startEngine = useCallback(() => {
    if (!isSupported || !recognitionRef.current) return;
    if (aiSpeakingRef.current) return; // blocked — AI is speaking
    try {
      recognitionRef.current.start();
    } catch {
      restartingRef.current = false;
    }
  }, [isSupported]);

  // ── build recognition instance ────────────────────────────────────────────

  const buildRecognition = useCallback(() => {
    if (!isSupported) return null;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = language;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      restartingRef.current = false;
      setIsListening(true);
      setError(null);
    };

    rec.onresult = (event: any) => {
      // Safety: if AI started speaking mid-capture, discard and stop
      if (aiSpeakingRef.current) {
        try { rec.stop(); } catch { /* ignore */ }
        return;
      }

      let interimText = '';
      let newFinal = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const part = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          newFinal += part;
        } else {
          interimText += part;
        }
      }

      if (newFinal) {
        const sep = committedRef.current.length > 0 ? ' ' : '';
        committedRef.current = (committedRef.current + sep + newFinal.trim()).trim();
      }

      const sep = committedRef.current.length > 0 && interimText ? ' ' : '';
      const display = (committedRef.current + sep + interimText).trim();

      setLiveText(display);
      onLiveTranscript?.(display);
    };

    rec.onerror = (event: any) => {
      const { error: errCode } = event;
      if (errCode === 'no-speech') return; // benign
      if (errCode === 'audio-capture') {
        setError('Microphone not accessible. Please check permissions.');
      } else if (errCode === 'not-allowed') {
        setError('Microphone permission denied.');
        activeRef.current = false;
        setIsListening(false);
      }
      // network / aborted — let onend handle restart
    };

    rec.onend = () => {
      setIsListening(false);
      // Auto-restart only if: user wants mic on AND AI is not speaking
      if (activeRef.current && !aiSpeakingRef.current && !restartingRef.current) {
        restartingRef.current = true;
        setTimeout(() => {
          if (activeRef.current && !aiSpeakingRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch {
              restartingRef.current = false;
            }
          } else {
            restartingRef.current = false;
          }
        }, 150);
      }
    };

    return rec;
  }, [isSupported, language, onLiveTranscript]);

  // ── public API ─────────────────────────────────────────────────────────────

  const start = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    committedRef.current = '';
    setLiveText('');
    setError(null);
    activeRef.current = true;
    restartingRef.current = false;

    // Rebuild instance to get fresh closures
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
    recognitionRef.current = buildRecognition();

    // Only actually start if AI is not speaking right now
    if (!aiSpeakingRef.current) {
      _startEngine();
    }
    // else: will auto-start when setAiSpeaking(false) is called
  }, [isSupported, buildRecognition, _startEngine]);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    activeRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
    }
    recognitionRef.current = null;
    committedRef.current = '';
    restartingRef.current = false;
    setIsListening(false);
    setLiveText('');
    setError(null);
  }, []);

  const setAiSpeaking = useCallback((speaking: boolean) => {
    aiSpeakingRef.current = speaking;
    setIsAiSpeakingState(speaking);

    if (speaking) {
      // AI started speaking — immediately stop mic to prevent cross-capture
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
      setIsListening(false);
    } else {
      // AI finished speaking — if user already requested mic, start it now
      if (activeRef.current && recognitionRef.current && !restartingRef.current) {
        restartingRef.current = true;
        setTimeout(() => {
          if (activeRef.current && !aiSpeakingRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch {
              restartingRef.current = false;
            }
          } else {
            restartingRef.current = false;
          }
        }, 200); // small buffer after TTS ends
      }
    }
  }, []);

  // ── cleanup on unmount ─────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
      }
    };
  }, []);

  return {
    isSupported,
    isListening,
    isAiSpeaking,
    liveText,
    error,
    start,
    stop,
    reset,
    setAiSpeaking,
  };
}
