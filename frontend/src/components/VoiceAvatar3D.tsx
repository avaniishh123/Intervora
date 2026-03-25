/**
 * Voice-Enabled 3D Avatar Component
 * Integrates with Text-to-Speech and provides visual feedback
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import '../styles/Avatar3D.css';

interface VoiceAvatar3DProps {
  state: 'idle' | 'listening' | 'speaking' | 'thinking' | 'celebrating';
  questionText?: string;
  emotionalResponse?: string;
  onSpeechStart?: () => void;
  onSpeechComplete?: () => void;
  enableVoice?: boolean;
  autoSpeak?: boolean;
  className?: string;
}

const VoiceAvatar3D: React.FC<VoiceAvatar3DProps> = ({
  state,
  questionText,
  emotionalResponse,
  onSpeechStart,
  onSpeechComplete,
  enableVoice = true,
  autoSpeak = true,
  className = ''
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  /**
   * Speak the given text with avatar animation
   */
  const speakText = useCallback((text: string) => {
    if (!enableVoice || !text || !('speechSynthesis' in window)) {
      onSpeechComplete?.();
      return;
    }

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configure voice settings for natural interview tone
    utterance.rate = 0.85; // Slightly slower for clarity
    utterance.pitch = 1.0;
    utterance.volume = 0.9;
    
    // Try to use a professional-sounding voice
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.name.includes('Google') || 
      voice.name.includes('Microsoft') ||
      voice.lang.startsWith('en')
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      console.log('🗣️ Avatar started speaking question');
      setIsSpeaking(true);
      setCurrentText(text);
      onSpeechStart?.();
    };

    utterance.onend = () => {
      console.log('✅ Avatar finished speaking question');
      setIsSpeaking(false);
      setCurrentText('');
      onSpeechComplete?.();
    };

    utterance.onerror = (error) => {
      console.error('❌ Speech synthesis error:', error);
      setIsSpeaking(false);
      setCurrentText('');
      onSpeechComplete?.();
    };

    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
  }, [enableVoice, onSpeechStart, onSpeechComplete]);

  /**
   * Stop current speech
   */
  const stopSpeaking = useCallback(() => {
    if (utteranceRef.current) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
      setCurrentText('');
    }
  }, []);

  /**
   * Auto-speak when question text changes
   */
  useEffect(() => {
    if (autoSpeak && questionText && questionText !== currentText && state === 'speaking') {
      // Small delay to ensure avatar animation starts
      const timer = setTimeout(() => {
        speakText(questionText);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [questionText, autoSpeak, speakText, currentText, state]);

  /**
   * Handle emotional responses (HR phase)
   */
  useEffect(() => {
    if (autoSpeak && emotionalResponse && emotionalResponse !== currentText) {
      console.log('💝 Avatar speaking emotional response:', emotionalResponse);
      // Speak emotional response with empathetic tone
      const timer = setTimeout(() => {
        speakText(emotionalResponse);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [emotionalResponse, autoSpeak, speakText, currentText]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (utteranceRef.current) {
        speechSynthesis.cancel();
      }
    };
  }, []);

  /**
   * Get avatar animation class based on state
   */
  const getAvatarClass = () => {
    const baseClass = 'avatar-3d';
    const stateClass = `avatar-${state}`;
    const speakingClass = isSpeaking ? 'avatar-speaking' : '';
    
    return `${baseClass} ${stateClass} ${speakingClass} ${className}`.trim();
  };

  /**
   * Get status message for accessibility
   */
  const getStatusMessage = () => {
    if (isSpeaking) return 'Speaking question...';
    
    switch (state) {
      case 'listening': return 'Listening to your answer...';
      case 'thinking': return 'Processing your response...';
      case 'celebrating': return 'Interview completed!';
      case 'speaking': return 'Asking question...';
      default: return 'Ready for interview';
    }
  };

  return (
    <div className="voice-avatar-container">
      {/* 3D Avatar */}
      <div 
        ref={avatarRef}
        className={getAvatarClass()}
        role="img"
        aria-label="AI Interviewer Avatar"
      >
        {/* Avatar Face */}
        <div className="avatar-face">
          <div className="avatar-eyes">
            <div className="eye left-eye"></div>
            <div className="eye right-eye"></div>
          </div>
          <div className="avatar-mouth">
            <div className="mouth-shape"></div>
          </div>
        </div>

        {/* Voice Indicator */}
        {isSpeaking && (
          <div className="voice-indicator">
            <div className="sound-wave wave-1"></div>
            <div className="sound-wave wave-2"></div>
            <div className="sound-wave wave-3"></div>
          </div>
        )}

        {/* State Indicator */}
        <div className="state-indicator">
          <div className={`state-dot state-${state}`}></div>
        </div>
      </div>

      {/* Status Display */}
      <div className="avatar-status">
        <span className="status-text">{getStatusMessage()}</span>
        {isSpeaking && (
          <button 
            className="stop-speech-btn"
            onClick={stopSpeaking}
            aria-label="Stop speaking"
          >
            🔇
          </button>
        )}
      </div>

      {/* Current Question Display */}
      {questionText && (
        <div className="current-question">
          <p className="question-text">{questionText}</p>
          {enableVoice && !isSpeaking && (
            <button 
              className="repeat-question-btn"
              onClick={() => speakText(questionText)}
              aria-label="Repeat question"
            >
              🔊 Repeat Question
            </button>
          )}
        </div>
      )}

      {/* Voice Support Warning */}
      {enableVoice && !('speechSynthesis' in window) && (
        <div className="voice-warning">
          ⚠️ Voice synthesis not supported in this browser
        </div>
      )}
    </div>
  );
};

export default VoiceAvatar3D;