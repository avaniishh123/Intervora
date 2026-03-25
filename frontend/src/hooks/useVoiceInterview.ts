/**
 * Voice Interview Hook
 * Handles automatic microphone activation and voice-controlled interview flow
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface VoiceInterviewConfig {
  autoStartMicrophone?: boolean;
  enableSpeechRecognition?: boolean;
  enableTextToSpeech?: boolean;
  avatarVoiceEnabled?: boolean;
}

interface VoiceInterviewState {
  isMicrophoneActive: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  currentTranscript: string;
  lastSpokenText: string;
  error: string | null;
}

export const useVoiceInterview = (config: VoiceInterviewConfig = {}) => {
  const {
    autoStartMicrophone = true,
    enableSpeechRecognition = true,
    enableTextToSpeech = true,
    avatarVoiceEnabled = true
  } = config;

  const [state, setState] = useState<VoiceInterviewState>({
    isMicrophoneActive: false,
    isListening: false,
    isSpeaking: false,
    currentTranscript: '',
    lastSpokenText: '',
    error: null
  });

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  /**
   * Initialize microphone automatically
   */
  const initializeMicrophone = useCallback(async () => {
    try {
      console.log('🎤 Initializing microphone automatically...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;
      
      setState(prev => ({
        ...prev,
        isMicrophoneActive: true,
        error: null
      }));

      console.log('✅ Microphone activated successfully');
      
      // Auto-start speech recognition if enabled
      if (enableSpeechRecognition) {
        startSpeechRecognition();
      }

    } catch (error) {
      console.error('❌ Failed to initialize microphone:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to access microphone. Please check permissions.',
        isMicrophoneActive: false
      }));
    }
  }, [enableSpeechRecognition]);

  /**
   * Initialize Speech Recognition
   */
  const initializeSpeechRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('⚠️ Speech Recognition not supported');
      return null;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('🎤 Speech recognition started');
      setState(prev => ({ ...prev, isListening: true, error: null }));
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setState(prev => ({
        ...prev,
        currentTranscript: finalTranscript || interimTranscript
      }));

      // If we have a final result, process it
      if (finalTranscript) {
        console.log('🗣️ Final transcript:', finalTranscript);
        // Here you would send the transcript to your interview processing logic
      }
    };

    recognition.onerror = (event) => {
      console.error('❌ Speech recognition error:', event.error);
      setState(prev => ({
        ...prev,
        error: `Speech recognition error: ${event.error}`,
        isListening: false
      }));
    };

    recognition.onend = () => {
      console.log('🎤 Speech recognition ended');
      setState(prev => ({ ...prev, isListening: false }));
    };

    return recognition;
  }, []);

  /**
   * Start Speech Recognition
   */
  const startSpeechRecognition = useCallback(() => {
    if (!recognitionRef.current) {
      recognitionRef.current = initializeSpeechRecognition();
    }

    if (recognitionRef.current && !state.isListening) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('❌ Failed to start speech recognition:', error);
      }
    }
  }, [initializeSpeechRecognition, state.isListening]);

  /**
   * Stop Speech Recognition
   */
  const stopSpeechRecognition = useCallback(() => {
    if (recognitionRef.current && state.isListening) {
      recognitionRef.current.stop();
    }
  }, [state.isListening]);

  /**
   * Speak text using Text-to-Speech
   */
  const speakText = useCallback((text: string, onComplete?: () => void) => {
    if (!enableTextToSpeech || !avatarVoiceEnabled) {
      onComplete?.();
      return;
    }

    if ('speechSynthesis' in window) {
      // Stop any current speech
      speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;

      utterance.onstart = () => {
        console.log('🗣️ Avatar started speaking:', text.substring(0, 50) + '...');
        setState(prev => ({ ...prev, isSpeaking: true, lastSpokenText: text }));
      };

      utterance.onend = () => {
        console.log('✅ Avatar finished speaking');
        setState(prev => ({ ...prev, isSpeaking: false }));
        onComplete?.();
      };

      utterance.onerror = (error) => {
        console.error('❌ Speech synthesis error:', error);
        setState(prev => ({ ...prev, isSpeaking: false, error: 'Speech synthesis failed' }));
        onComplete?.();
      };

      speechSynthesis.speak(utterance);
    } else {
      console.warn('⚠️ Speech synthesis not supported');
      onComplete?.();
    }
  }, [enableTextToSpeech, avatarVoiceEnabled]);

  /**
   * Stop current speech
   */
  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      setState(prev => ({ ...prev, isSpeaking: false }));
    }
  }, []);

  /**
   * Clean up resources
   */
  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up voice interview resources...');
    
    // Stop speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    // Stop speech synthesis
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }

    // Stop microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setState({
      isMicrophoneActive: false,
      isListening: false,
      isSpeaking: false,
      currentTranscript: '',
      lastSpokenText: '',
      error: null
    });

    console.log('✅ Voice interview cleanup complete');
  }, []);

  /**
   * Auto-initialize on mount
   */
  useEffect(() => {
    if (autoStartMicrophone) {
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        initializeMicrophone();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [autoStartMicrophone, initializeMicrophone]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    // State
    ...state,
    
    // Actions
    initializeMicrophone,
    startSpeechRecognition,
    stopSpeechRecognition,
    speakText,
    stopSpeaking,
    cleanup,
    
    // Utilities
    isVoiceSupported: 'speechSynthesis' in window && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  };
};

export default useVoiceInterview;