import { useState, useCallback, useRef, useEffect } from 'react';
import { WebRTCRecorder, TranscriptGenerator, RecordingResult } from '../services/webrtcRecorder';
import { useCompositeRecorder } from './useCompositeRecorder';
import { AvatarState } from '../components/Avatar3D';

interface UseInterviewMediaOptions {
  autoStartRecording?: boolean;
  enableTranscription?: boolean;
}

interface UseInterviewMediaReturn {
  // Camera/Microphone
  stream: MediaStream | null;
  isStreamReady: boolean;
  streamError: Error | null;
  
  // Recording
  isRecording: boolean;
  recordingDuration: number;
  startRecording: () => Promise<void>;
  startCompositeWithStream: (screenStream: MediaStream) => Promise<void>;
  stopRecording: () => Promise<RecordingResult | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  
  // Transcription
  transcript: string;
  isTranscribing: boolean;
  startTranscription: () => void;
  stopTranscription: () => string;
  
  // Avatar
  avatarState: AvatarState;
  setAvatarState: (state: AvatarState) => void;
  audioElement: HTMLAudioElement | null;
  setAudioElement: (element: HTMLAudioElement | null) => void;
}

export function useInterviewMedia(options: UseInterviewMediaOptions = {}): UseInterviewMediaReturn {
  const { enableTranscription = true } = options;

  // Media stream state
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const [streamError, setStreamError] = useState<Error | null>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recorderRef = useRef<WebRTCRecorder | null>(null);
  const durationIntervalRef = useRef<number>();

  // Composite recorder (screen + webcam PiP)
  const {
    startCompositeRecording,
    stopCompositeRecording,
  } = useCompositeRecorder();

  // Track whether we're using composite mode for this recording session
  const usingCompositeRef = useRef(false);

  // Transcription state
  const [transcript, setTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const transcriptGeneratorRef = useRef<TranscriptGenerator | null>(null);

  // Avatar state
  const [avatarState, setAvatarState] = useState<AvatarState>('idle');
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Initialize media stream
  useEffect(() => {
    let mounted = true;
    let currentStream: MediaStream | null = null;

    const initializeMedia = async () => {
      try {
        console.log('🎥 Requesting camera and microphone access...');
        
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          }
        });

        if (!mounted) {
          // Component unmounted, cleanup
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }

        currentStream = mediaStream;
        setStream(mediaStream);
        setIsStreamReady(true);
        setStreamError(null);
        console.log('✅ Media stream initialized successfully');
        console.log('📹 Video tracks:', mediaStream.getVideoTracks().length);
        console.log('🎤 Audio tracks:', mediaStream.getAudioTracks().length);
      } catch (error) {
        console.error('❌ Error accessing media devices:', error);
        
        if (!mounted) return;

        // Create a more user-friendly error message
        let errorMessage = 'Failed to access camera/microphone';
        if (error instanceof Error) {
          if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMessage = 'Camera/microphone access denied. Please allow permissions in your browser.';
          } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMessage = 'No camera or microphone found. Please connect a device.';
          } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMessage = 'Camera/microphone is already in use by another application.';
          } else if (error.name === 'OverconstrainedError') {
            errorMessage = 'Camera/microphone does not meet the required specifications.';
          } else {
            errorMessage = error.message;
          }
        }
        setStreamError(new Error(errorMessage));
        setIsStreamReady(false);
      }
    };

    initializeMedia();

    return () => {
      mounted = false;
      // Cleanup on unmount
      if (currentStream) {
        console.log('🧹 Cleaning up media stream...');
        currentStream.getTracks().forEach(track => {
          track.stop();
          console.log(`Stopped ${track.kind} track`);
        });
      }
    };
  }, []);

  // Initialize recorder and transcript generator
  useEffect(() => {
    recorderRef.current = new WebRTCRecorder();
    
    if (enableTranscription && TranscriptGenerator.isSupported()) {
      transcriptGeneratorRef.current = new TranscriptGenerator();
    }

    return () => {
      // Cleanup on unmount
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [enableTranscription]);

  // ── Internal helper: begin duration timer + transcription ────────────────
  const beginRecordingState = useCallback(() => {
    setIsRecording(true);
    durationIntervalRef.current = window.setInterval(() => {
      setRecordingDuration(prev => prev + 1000);
    }, 1000);
    if (enableTranscription && transcriptGeneratorRef.current) {
      startTranscription();
    }
  }, [enableTranscription]);

  // Start composite recording using a screen stream already obtained by the
  // proctoring flow (getDisplayMedia was called from the overlay button click)
  const startCompositeWithStream = useCallback(async (screenStream: MediaStream) => {
    if (!stream) {
      console.error('Webcam stream not ready');
      return;
    }
    try {
      // Pass the pre-obtained screen stream directly into the composite recorder
      await startCompositeRecording(stream, screenStream);
      usingCompositeRef.current = true;
      beginRecordingState();
      console.log('✅ Composite recording started with pre-obtained screen stream');
    } catch (err) {
      console.error('❌ startCompositeWithStream failed:', err);
      // Fallback to webcam-only
      usingCompositeRef.current = false;
      if (recorderRef.current) {
        await recorderRef.current.startRecording(stream);
        beginRecordingState();
      }
    }
  }, [stream, startCompositeRecording, beginRecordingState]);

  // Start recording — webcam-only fallback (used when screen share was skipped)
  const startRecording = useCallback(async () => {
    if (!stream || !recorderRef.current) {
      console.error('Stream not ready or recorder not initialized');
      return;
    }
    try {
      usingCompositeRef.current = false;
      await recorderRef.current.startRecording(stream);
      beginRecordingState();
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  }, [stream, beginRecordingState]);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<RecordingResult | null> => {
    if (!isRecording) return null;

    try {
      let result: RecordingResult | null = null;

      if (usingCompositeRef.current) {
        result = await stopCompositeRecording();
        usingCompositeRef.current = false;
      } else if (recorderRef.current) {
        result = await recorderRef.current.stopRecording();
      }

      setIsRecording(false);
      setRecordingDuration(0);

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }

      // Stop transcription
      if (isTranscribing) {
        stopTranscription();
      }

      return result;
    } catch (error) {
      console.error('Error stopping recording:', error);
      return null;
    }
  }, [isRecording, isTranscribing, stopCompositeRecording]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (usingCompositeRef.current) return; // composite doesn't support pause
    if (recorderRef.current) {
      recorderRef.current.pauseRecording();
    }
  }, []);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (usingCompositeRef.current) return;
    if (recorderRef.current) {
      recorderRef.current.resumeRecording();
    }
  }, []);

  // Start transcription
  const startTranscription = useCallback(() => {
    if (!transcriptGeneratorRef.current) {
      console.warn('Transcription not supported');
      return;
    }

    setIsTranscribing(true);
    transcriptGeneratorRef.current.startTranscription((text, isFinal) => {
      if (isFinal) {
        setTranscript(prev => prev + ' ' + text);
      }
    });
  }, []);

  // Stop transcription
  const stopTranscription = useCallback((): string => {
    if (!transcriptGeneratorRef.current) {
      return transcript;
    }

    const finalTranscript = transcriptGeneratorRef.current.stopTranscription();
    setIsTranscribing(false);
    return finalTranscript;
  }, [transcript]);

  return {
    // Camera/Microphone
    stream,
    isStreamReady,
    streamError,
    
    // Recording
    isRecording,
    recordingDuration,
    startRecording,
    startCompositeWithStream,
    stopRecording,
    pauseRecording,
    resumeRecording,
    
    // Transcription
    transcript,
    isTranscribing,
    startTranscription,
    stopTranscription,
    
    // Avatar
    avatarState,
    setAvatarState,
    audioElement,
    setAudioElement
  };
}
