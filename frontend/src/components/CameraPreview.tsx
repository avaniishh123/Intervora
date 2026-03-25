import { useEffect, useRef, useState } from 'react';
import '../styles/CameraPreview.css';

interface CameraPreviewProps {
  stream?: MediaStream | null;
  onStreamReady?: (stream: MediaStream) => void;
  onError?: (error: Error) => void;
  className?: string;
  showControls?: boolean;
  manageOwnStream?: boolean; // allow parent to supply stream without re-requesting
}

export default function CameraPreview({
  stream: externalStream,
  onStreamReady,
  onError,
  className = '',
  showControls = true,
  manageOwnStream = true
}: CameraPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [internalStream, setInternalStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [error, setError] = useState<string | null>(null);

  // Use external stream if provided, otherwise request media access
  const stream = externalStream || internalStream;

  // Handle external stream or request media access
  useEffect(() => {
    let mounted = true;

    if (externalStream) {
      // Use external stream provided by parent
      setPermissionStatus('granted');
      setError(null);
      
      // Only update video element if stream has changed
      if (videoRef.current && videoRef.current.srcObject !== externalStream) {
        videoRef.current.srcObject = externalStream;
      }
      
      if (onStreamReady) {
        onStreamReady(externalStream);
      }
      return;
    }

    // Only request media access if no external stream is provided and we are allowed to manage it internally
    if (!manageOwnStream) {
      setPermissionStatus('pending');
      return;
    }

    // Only request media access if no external stream is provided
    const requestMediaAccess = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        if (!mounted) {
          mediaStream.getTracks().forEach(track => track.stop());
          return;
        }

        setInternalStream(mediaStream);
        setPermissionStatus('granted');
        setError(null);

        // Attach stream to video element
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        // Notify parent component
        if (onStreamReady) {
          onStreamReady(mediaStream);
        }
      } catch (err) {
        console.error('Error accessing media devices:', err);
        
        if (!mounted) return;

        let errorMessage = 'Failed to access camera/microphone';
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            errorMessage = 'Camera/microphone access denied. Please allow permissions in your browser.';
          } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            errorMessage = 'No camera or microphone found. Please connect a device.';
          } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            errorMessage = 'Camera/microphone is already in use by another application.';
          } else {
            errorMessage = err.message;
          }
        }
        
        setError(errorMessage);
        setPermissionStatus('denied');

        if (onError && err instanceof Error) {
          onError(err);
        }
      }
    };

    requestMediaAccess();

    // Cleanup function
    return () => {
      mounted = false;
      if (internalStream) {
        internalStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [externalStream, onStreamReady, onError, manageOwnStream]);

  // Toggle video track
  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Toggle audio track
  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  if (permissionStatus === 'denied') {
    return (
      <div className={`camera-preview-error ${className}`}>
        <div className="error-icon">📷</div>
        <h3>Camera/Microphone Access Denied</h3>
        <p>{error || 'Please enable camera and microphone permissions in your browser settings.'}</p>
        <button onClick={() => window.location.reload()} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  if (permissionStatus === 'pending') {
    return (
      <div className={`camera-preview-loading ${className}`}>
        <div className="loading-spinner"></div>
        <p>Requesting camera and microphone access...</p>
      </div>
    );
  }

  return (
    <div className={`camera-preview-container ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="camera-preview-video"
        style={{ objectFit: 'cover' }}
      />

      {showControls && (
        <div className="camera-preview-controls">
          <button
            onClick={toggleVideo}
            className={`control-button ${!isVideoEnabled ? 'disabled' : ''}`}
            title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            {isVideoEnabled ? '📹' : '📹❌'}
          </button>
          <button
            onClick={toggleAudio}
            className={`control-button ${!isAudioEnabled ? 'disabled' : ''}`}
            title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {isAudioEnabled ? '🎤' : '🎤❌'}
          </button>
        </div>
      )}

      {!isVideoEnabled && (
        <div className="camera-disabled-overlay">
          <span>Camera Off</span>
        </div>
      )}
    </div>
  );
}
