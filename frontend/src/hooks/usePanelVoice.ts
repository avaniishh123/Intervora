/**
 * usePanelVoice
 * Bidirectional voice system for the Mock Panel Interview.
 *
 * Features:
 * - Distinct TTS voice per panel member (pitch / rate / voice selection)
 * - Real-time STT with interim + final transcript surfaced to the caller
 * - Speak queue so multiple messages never overlap
 * - Mic can be toggled on/off at any time
 * - Exposes isSpeaking, isListening, transcript, activeVoiceSpeaker
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Voice profiles per panel member ──────────────────────────────────────
export interface VoiceProfile {
  panelId: string;
  pitch: number;   // 0.5 – 2.0
  rate: number;    // 0.5 – 2.0
  volume: number;  // 0 – 1
  /** Preferred voice name substrings (checked in order, first match wins) */
  preferredVoices: string[];
}

const VOICE_PROFILES: VoiceProfile[] = [
  {
    panelId: 'tech',
    pitch: 0.95,
    rate: 1.0,
    volume: 0.9,
    preferredVoices: ['Google UK English Male', 'Microsoft David', 'Alex', 'en-GB'],
  },
  {
    panelId: 'hiring',
    pitch: 1.15,
    rate: 0.95,
    volume: 0.9,
    preferredVoices: ['Google UK English Female', 'Microsoft Zira', 'Samantha', 'en-US'],
  },
  {
    panelId: 'hr',
    pitch: 1.05,
    rate: 0.92,
    volume: 0.88,
    preferredVoices: ['Google US English', 'Microsoft Mark', 'Daniel', 'en'],
  },
];

// ── Types ─────────────────────────────────────────────────────────────────
export type ResponseMode = 'text' | 'voice';

interface SpeakJob {
  text: string;
  panelId: string;
  onDone?: () => void;
}

interface PanelVoiceState {
  isSpeaking: boolean;
  activeVoiceSpeaker: string | null; // panelId currently speaking
  isListening: boolean;
  micReady: boolean;
  transcript: string;          // live interim + final
  finalTranscript: string;     // committed final only
  responseMode: ResponseMode;
  voiceSupported: boolean;
  sttSupported: boolean;
  error: string | null;
}

// ── Hook ──────────────────────────────────────────────────────────────────
export function usePanelVoice() {
  const [state, setState] = useState<PanelVoiceState>({
    isSpeaking: false,
    activeVoiceSpeaker: null,
    isListening: false,
    micReady: false,
    transcript: '',
    finalTranscript: '',
    responseMode: 'text',
    voiceSupported: typeof window !== 'undefined' && 'speechSynthesis' in window,
    sttSupported:
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
    error: null,
  });

  const voicesRef       = useRef<SpeechSynthesisVoice[]>([]);
  const speakQueueRef   = useRef<SpeakJob[]>([]);
  const isBusyRef       = useRef(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef  = useRef<any>(null);
  const micStreamRef    = useRef<MediaStream | null>(null);
  const mountedRef      = useRef(true);

  // ── Append-based transcript refs ────────────────────────────────────────
  // committedRef holds all finalized speech segments across restarts/pauses.
  // It is the single source of truth for confirmed text.
  const committedRef    = useRef<string>('');
  // Whether we should auto-restart recognition after it ends (pause resilience)
  const shouldRestartRef = useRef(false);

  // ── Load available voices ───────────────────────────────────────────────
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Voice selection ─────────────────────────────────────────────────────
  const pickVoice = useCallback((profile: VoiceProfile): SpeechSynthesisVoice | null => {
    const voices = voicesRef.current;
    if (!voices.length) return null;
    for (const pref of profile.preferredVoices) {
      const match = voices.find(v =>
        v.name.toLowerCase().includes(pref.toLowerCase()) ||
        v.lang.toLowerCase().includes(pref.toLowerCase())
      );
      if (match) return match;
    }
    // Fallback: any English voice
    return voices.find(v => v.lang.startsWith('en')) || voices[0] || null;
  }, []);

  // ── Internal: process speak queue ───────────────────────────────────────
  const processQueue = useCallback(() => {
    if (isBusyRef.current || speakQueueRef.current.length === 0) return;
    const job = speakQueueRef.current.shift()!;
    isBusyRef.current = true;

    const profile = VOICE_PROFILES.find(p => p.panelId === job.panelId) || VOICE_PROFILES[0];
    const utterance = new SpeechSynthesisUtterance(job.text);
    utterance.pitch  = profile.pitch;
    utterance.rate   = profile.rate;
    utterance.volume = profile.volume;

    const voice = pickVoice(profile);
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      if (!mountedRef.current) return;
      setState(prev => ({ ...prev, isSpeaking: true, activeVoiceSpeaker: job.panelId }));
    };

    const finish = () => {
      isBusyRef.current = false;
      if (!mountedRef.current) return;
      setState(prev => ({
        ...prev,
        isSpeaking: speakQueueRef.current.length > 0,
        activeVoiceSpeaker: speakQueueRef.current.length > 0 ? prev.activeVoiceSpeaker : null,
      }));
      job.onDone?.();
      // Process next in queue
      setTimeout(processQueue, 80);
    };

    utterance.onend   = finish;
    utterance.onerror = finish;

    window.speechSynthesis.speak(utterance);
  }, [pickVoice]);

  // ── Public: enqueue a panel member speaking ─────────────────────────────
  const speakAs = useCallback((panelId: string, text: string, onDone?: () => void) => {
    if (!('speechSynthesis' in window)) { onDone?.(); return; }
    speakQueueRef.current.push({ text, panelId, onDone });
    processQueue();
  }, [processQueue]);

  // ── Public: cancel all speech ───────────────────────────────────────────
  const cancelSpeech = useCallback(() => {
    speakQueueRef.current = [];
    isBusyRef.current = false;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setState(prev => ({ ...prev, isSpeaking: false, activeVoiceSpeaker: null }));
  }, []);

  // ── STT: normalize a raw transcript chunk ──────────────────────────────
  // Lowercases the first character of each STT segment (the browser often
  // capitalizes the first word of every interim/final result), collapses
  // multiple spaces, and trims surrounding whitespace.  Proper nouns and
  // sentence-start capitalisation are intentionally left to the user.
  const normalizeChunk = useCallback((raw: string, isFirstWord: boolean): string => {
    const trimmed = raw.replace(/\s+/g, ' ').trim();
    if (!trimmed) return '';
    // Only lowercase the very first character when it is NOT the start of the
    // whole answer (i.e. there is already committed text before it).
    if (!isFirstWord && /^[A-Z]/.test(trimmed)) {
      return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
    }
    return trimmed;
  }, []);

  // ── STT: build recognition instance ────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildRecognition = useCallback((): any | null => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new SR();
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.lang            = 'en-US';
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      if (!mountedRef.current) return;
      setState(prev => ({ ...prev, isListening: true, error: null }));
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      if (!mountedRef.current) return;

      let newFinal = '';
      let interim  = '';

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) newFinal += t;
        else interim += t;
      }

      // Normalize and append newly finalized text — never overwrite committed
      if (newFinal) {
        const isFirstWord = committedRef.current.length === 0;
        const normalized  = normalizeChunk(newFinal, isFirstWord);
        if (normalized) {
          const sep = isFirstWord ? '' : ' ';
          committedRef.current = (committedRef.current + sep + normalized).trim();
        }
      }

      // Normalize interim preview too so it looks consistent while speaking
      const normalizedInterim = interim
        ? normalizeChunk(interim, committedRef.current.length === 0)
        : '';

      // Display = committed finals + live interim preview (no duplication)
      const display = normalizedInterim
        ? (committedRef.current ? committedRef.current + ' ' + normalizedInterim : normalizedInterim)
        : committedRef.current;

      setState(prev => ({
        ...prev,
        transcript: display,
        finalTranscript: committedRef.current,
      }));
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      if (!mountedRef.current) return;
      // 'no-speech' and 'aborted' are benign — auto-restart handles them
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      setState(prev => ({ ...prev, isListening: false, error: `STT error: ${e.error}` }));
    };

    rec.onend = () => {
      if (!mountedRef.current) return;
      // Auto-restart on natural pause so the session stays alive across silences
      if (shouldRestartRef.current) {
        setTimeout(() => {
          if (mountedRef.current && shouldRestartRef.current) {
            try { rec.start(); } catch (_) {}
          }
        }, 150);
      } else {
        setState(prev => ({ ...prev, isListening: false }));
      }
    };

    return rec;
  }, [normalizeChunk]);

  // ── Public: start mic + STT ─────────────────────────────────────────────
  const startListening = useCallback(async () => {
    // Request mic permission first (for visual indicator)
    if (!micStreamRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        micStreamRef.current = stream;
        setState(prev => ({ ...prev, micReady: true, error: null }));
      } catch {
        setState(prev => ({ ...prev, error: 'Microphone access denied.' }));
        return;
      }
    }

    if (!recognitionRef.current) {
      recognitionRef.current = buildRecognition();
    }
    if (!recognitionRef.current) {
      setState(prev => ({ ...prev, error: 'Speech recognition not supported in this browser.' }));
      return;
    }

    // Enable auto-restart so pauses don't kill the session
    shouldRestartRef.current = true;

    try {
      recognitionRef.current.start();
    } catch {
      // Already started — that's fine, just ensure restart flag is set
    }
  }, [buildRecognition]);

  // ── Public: stop STT ────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    try { recognitionRef.current?.stop(); } catch (_) {}
    setState(prev => ({ ...prev, isListening: false }));
  }, []);

  // ── Public: clear transcript (resets committed buffer too) ───────────────
  const clearTranscript = useCallback(() => {
    committedRef.current = '';
    setState(prev => ({ ...prev, transcript: '', finalTranscript: '' }));
  }, []);

  // ── Public: toggle response mode ────────────────────────────────────────
  const setResponseMode = useCallback((mode: ResponseMode) => {
    setState(prev => ({ ...prev, responseMode: mode }));
    if (mode === 'text') stopListening();
  }, [stopListening]);

  // ── Cleanup ─────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    shouldRestartRef.current = false;
    committedRef.current = '';
    cancelSpeech();
    stopListening();
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
    recognitionRef.current = null;
  }, [cancelSpeech, stopListening]);

  useEffect(() => () => { cleanup(); }, [cleanup]);

  return {
    ...state,
    speakAs,
    cancelSpeech,
    startListening,
    stopListening,
    clearTranscript,
    setResponseMode,
    cleanup,
  };
}
