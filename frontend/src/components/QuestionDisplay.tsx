import { useEffect, useState, useRef } from 'react';
import { Question } from '../types';
import '../styles/QuestionDisplay.css';

interface QuestionDisplayProps {
  question: Question;
  currentQuestionNumber: number;
  totalQuestions: number;
  enableTextToSpeech?: boolean;
  onSpeechEnd?: () => void;
}

export default function QuestionDisplay({
  question,
  currentQuestionNumber,
  totalQuestions,
  enableTextToSpeech = true,
  onSpeechEnd
}: QuestionDisplayProps) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Get category badge color
  const getCategoryColor = (category: Question['category']): string => {
    const colors = {
      technical: '#3b82f6',
      behavioral: '#8b5cf6',
      situational: '#10b981',
      coding: '#f59e0b'
    };
    return colors[category];
  };

  // Speak the question using Web Speech API
  const speakQuestion = () => {
    if (!('speechSynthesis' in window)) {
      console.warn('Text-to-speech not supported in this browser');
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(question.text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      onSpeechEnd?.();
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsSpeaking(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Stop speaking
  const stopSpeaking = () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Auto-speak when question changes
  useEffect(() => {
    if (enableTextToSpeech && question) {
      // Small delay to ensure component is mounted
      const timer = setTimeout(() => {
        speakQuestion();
      }, 300);

      return () => {
        clearTimeout(timer);
        stopSpeaking();
      };
    }
  }, [question.id, enableTextToSpeech]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  return (
    <div className="question-display">
      <div className="question-header">
        <div className="question-progress">
          <span className="question-number">
            Question {currentQuestionNumber}{totalQuestions > 0 ? ` of ${totalQuestions}` : ''}
          </span>
          <div className="progress-dots">
            {totalQuestions > 0 && Array.from({ length: totalQuestions }, (_, i) => (
              <span
                key={i}
                className={`progress-dot ${i < currentQuestionNumber ? 'completed' : ''} ${
                  i === currentQuestionNumber - 1 ? 'active' : ''
                }`}
              />
            ))}
          </div>
        </div>

        <div
          className="category-badge"
          style={{ backgroundColor: getCategoryColor(question.category) }}
        >
          {question.category}
        </div>
      </div>

      <div className="question-content">
        <div className="question-text">
          {question.text}
        </div>

        {question.difficulty && (
          <div className="question-meta">
            <span className={`difficulty-badge difficulty-${question.difficulty}`}>
              {question.difficulty}
            </span>
            {question.timeLimit > 0 && (
              <span className="time-limit">
                ⏱️ {Math.floor(question.timeLimit / 60)} min
              </span>
            )}
          </div>
        )}
      </div>

      {enableTextToSpeech && (
        <div className="speech-controls">
          {isSpeaking ? (
            <button
              onClick={stopSpeaking}
              className="speech-button stop"
              title="Stop speaking"
            >
              <span className="icon">⏸️</span>
              Stop
            </button>
          ) : (
            <button
              onClick={speakQuestion}
              className="speech-button play"
              title="Read question aloud"
            >
              <span className="icon">🔊</span>
              Read Aloud
            </button>
          )}
        </div>
      )}
    </div>
  );
}
