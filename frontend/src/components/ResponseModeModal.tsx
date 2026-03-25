import { useState, useEffect } from 'react';
import '../styles/ResponseModeModal.css';

interface ResponseModeModalProps {
  isOpen: boolean;
  onSelectMode: (mode: 'chat' | 'voice') => void;
  autoSelectAfter?: number; // Auto-select chat after X seconds
  questionNumber: number;
}

export default function ResponseModeModal({
  isOpen,
  onSelectMode,
  autoSelectAfter = 15,
  questionNumber
}: ResponseModeModalProps) {
  const [countdown, setCountdown] = useState(autoSelectAfter);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(autoSelectAfter);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Auto-select chat mode
          onSelectMode('chat');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, autoSelectAfter, onSelectMode]);

  if (!isOpen) return null;

  return (
    <div className="response-mode-modal-overlay">
      <div className="response-mode-modal">
        <div className="modal-header">
          <h2>Question {questionNumber}</h2>
          <p className="modal-subtitle">How would you like to respond?</p>
        </div>

        <div className="modal-content">
          <div className="countdown-indicator">
            <div className="countdown-circle">
              <svg viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#e0e0e0"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="8"
                  strokeDasharray={`${(countdown / autoSelectAfter) * 283} 283`}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <span className="countdown-number">{countdown}s</span>
            </div>
            <p className="countdown-text">
              Auto-selecting Chat mode in {countdown} seconds
            </p>
          </div>

          <div className="mode-options">
            <button
              className="mode-button voice-mode"
              onClick={() => onSelectMode('voice')}
            >
              <div className="mode-icon">🎤</div>
              <div className="mode-details">
                <h3>Answer via Voice</h3>
                <p>Speak your response naturally</p>
              </div>
            </button>

            <button
              className="mode-button chat-mode"
              onClick={() => onSelectMode('chat')}
            >
              <div className="mode-icon">💬</div>
              <div className="mode-details">
                <h3>Answer via Chat</h3>
                <p>Type your response</p>
              </div>
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <p className="modal-hint">
            💡 Tip: Voice mode provides a more natural interview experience
          </p>
        </div>
      </div>
    </div>
  );
}
