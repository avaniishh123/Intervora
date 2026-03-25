import { useState, useEffect, useRef } from 'react';
import '../styles/VoiceRecorder.css';

interface VoiceRecorderProps {
  onTranscriptChange: (transcript: string) => void;
  isEnabled?: boolean;
  language?: string;
  continuous?: boolean;
}

export default function VoiceRecorder({
  onTranscriptChange,
  isEnabled = true,
  language = 'en-US',
  continuous = true
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Speech recognition is not supported in this browser');
      return;
    }

    // Initialize speech recognition
    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    // Handle results
    recognition.onresult = (event: any) => {
      let interimText = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptPart = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalText += transcriptPart + ' ';
        } else {
          interimText += transcriptPart;
        }
      }

      if (finalText) {
        const newTranscript = transcript + finalText;
        setTranscript(newTranscript);
        onTranscriptChange(newTranscript);
      }

      setInterimTranscript(interimText);
    };

    // Handle errors
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      
      if (event.error === 'no-speech') {
        setError('No speech detected. Please try again.');
      } else if (event.error === 'audio-capture') {
        setError('Microphone not accessible. Please check permissions.');
      } else if (event.error === 'not-allowed') {
        setError('Microphone permission denied.');
      } else {
        setError(`Error: ${event.error}`);
      }
      
      setIsRecording(false);
    };

    // Handle end
    recognition.onend = () => {
      if (isRecording) {
        // Restart if still recording (for continuous mode)
        try {
          recognition.start();
        } catch (e) {
          console.error('Failed to restart recognition:', e);
          setIsRecording(false);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [language, continuous]);

  // Start recording
  const startRecording = () => {
    if (!isSupported || !recognitionRef.current) {
      return;
    }

    setError(null);
    setIsRecording(true);

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error('Failed to start recognition:', e);
      setError('Failed to start recording. Please try again.');
      setIsRecording(false);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (recognitionRef.current) {
      setIsRecording(false);
      recognitionRef.current.stop();
    }
  };

  // Clear transcript
  const clearTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
    onTranscriptChange('');
  };

  if (!isSupported) {
    return (
      <div className="voice-recorder">
        <div className="voice-recorder-error">
          <span className="error-icon">⚠️</span>
          <p>Speech recognition is not supported in your browser.</p>
          <p className="error-hint">Try using Chrome, Edge, or Safari.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="voice-recorder">
      <div className="voice-recorder-header">
        <h3 className="voice-recorder-title">Voice Input</h3>
        
        {transcript && (
          <button
            onClick={clearTranscript}
            className="clear-button"
            title="Clear transcript"
          >
            Clear
          </button>
        )}
      </div>

      <div className="voice-recorder-controls">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={!isEnabled}
            className="record-button"
            title="Start recording"
          >
            <span className="record-icon">🎤</span>
            <span className="record-text">Start Recording</span>
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="record-button recording"
            title="Stop recording"
          >
            <span className="recording-indicator">
              <span className="recording-pulse"></span>
              <span className="recording-icon">⏹️</span>
            </span>
            <span className="record-text">Stop Recording</span>
          </button>
        )}
      </div>

      {error && (
        <div className="voice-recorder-error-message">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {(transcript || interimTranscript) && (
        <div className="transcript-display">
          <div className="transcript-label">Live Transcript:</div>
          <div className="transcript-content">
            <span className="transcript-final">{transcript}</span>
            {interimTranscript && (
              <span className="transcript-interim">{interimTranscript}</span>
            )}
          </div>
        </div>
      )}

      {isRecording && (
        <div className="recording-status">
          <div className="audio-visualizer">
            <span className="visualizer-bar"></span>
            <span className="visualizer-bar"></span>
            <span className="visualizer-bar"></span>
            <span className="visualizer-bar"></span>
            <span className="visualizer-bar"></span>
          </div>
          <span className="status-text">Listening...</span>
        </div>
      )}
    </div>
  );
}
