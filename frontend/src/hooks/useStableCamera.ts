import { useState, useEffect, useRef, useCallback } from 'react';

interface UseStableCameraOptions {
  onStreamReady?: (stream: MediaStream) => void;
  onError?: (error: Error) => void;
}

interface UseStableCameraReturn {
  stream: MediaStream | null;
  isReady: boolean;
  error: Error | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  toggleVideo: () => void;
  toggleAudio: () => void;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
}

/**
 * Hook for managing stable camera stream without flickering
 * Initializes once and maintains the same stream reference
 */
export function useStableCamera(options: UseStableCameraOptions = {}): UseStableCameraReturn {
  const { onStreamReady, onError } = options;
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const initializingRef = useRef(false);

  // Initialize camera stream once
  useEffect(() => {
    // Prevent multiple initializations
    if (initializingRef.current || streamRef.current) {
      return;
    }

    initializingRef.current = true;
    let mounted = true;

    const initializeCamera = async () => {
      try {
        console.log('🎥 Initializing stable camera stream...');
        
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
            frameRate: { ideal: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100
          }
        });

        if (!mounted) {
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }

        // Store stream reference
        streamRef.current = mediaStream;
        setStream(mediaStream);
        setIsReady(true);
        setError(null);

        // Attach to video element
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        console.log('✅ Stable camera stream initialized');
        
        if (onStreamReady) {
          onStreamReady(mediaStream);
        }
      } catch (err) {
        console.error('❌ Camera initialization error:', err);
        
        if (!mounted) return;

        const errorMessage = err instanceof Error ? err.message : 'Failed to access camera';
        const cameraError = new Error(errorMessage);
        
        setError(cameraError);
        setIsReady(false);

        if (onError) {
          onError(cameraError);
        }
      } finally {
        initializingRef.current = false;
      }
    };

    initializeCamera();

    return () => {
      mounted = false;
      // Cleanup on unmount
      if (streamRef.current) {
        console.log('🧹 Cleaning up stable camera stream');
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []); // Empty dependency array - initialize only once

  // Toggle video track
  const toggleVideo = useCallback(() => {
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, []);

  // Toggle audio track
  const toggleAudio = useCallback(() => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, []);

  return {
    stream,
    isReady,
    error,
    videoRef,
    toggleVideo,
    toggleAudio,
    isVideoEnabled,
    isAudioEnabled
  };
}
