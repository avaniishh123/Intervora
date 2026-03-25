import { useState } from 'react';
import '../styles/MentorModeToggle.css';

interface MentorModeToggleProps {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  showTips?: boolean;
  compact?: boolean;
}

export default function MentorModeToggle({
  isEnabled,
  onToggle,
  showTips = true,
  compact = false
}: MentorModeToggleProps) {
  const [showInfo, setShowInfo] = useState(false);

  const handleToggle = () => {
    onToggle(!isEnabled);
  };

  return (
    <div className={`mentor-mode-container ${compact ? 'header-version' : ''}`}>
      <div className="mentor-mode-toggle">
        <div className="mentor-mode-header">
          <div className="mentor-mode-info">
            <div className="mentor-mode-title">
              <span className="mentor-icon">🎓</span>
              Mentor Mode
            </div>
            {!compact && (
              <button
                onClick={() => setShowInfo(!showInfo)}
                className="info-button"
                title="Learn more about Mentor Mode"
              >
                ℹ️
              </button>
            )}
          </div>

          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={handleToggle}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        {!compact && showInfo && (
          <div className="mentor-mode-description">
            <p>
              <strong>Mentor Mode</strong> helps you structure your answers using the 
              <strong> Context-Action-Result (CAR)</strong> framework.
            </p>
            <p className="description-hint">
              This proven method helps you deliver clear, impactful responses that 
              interviewers love!
            </p>
          </div>
        )}
      </div>

      {!compact && isEnabled && showTips && (
        <div className="mentor-mode-tips">
          <div className="tips-header">
            <span className="tips-icon">💡</span>
            <span className="tips-title">CAR Framework Guide</span>
          </div>

          <div className="tips-content">
            <div className="tip-item">
              <div className="tip-badge context">C</div>
              <div className="tip-details">
                <div className="tip-name">Context</div>
                <div className="tip-description">
                  Set the scene. Describe the situation, challenge, or project background.
                </div>
              </div>
            </div>

            <div className="tip-item">
              <div className="tip-badge action">A</div>
              <div className="tip-details">
                <div className="tip-name">Action</div>
                <div className="tip-description">
                  Explain what YOU did. Focus on your specific contributions and decisions.
                </div>
              </div>
            </div>

            <div className="tip-item">
              <div className="tip-badge result">R</div>
              <div className="tip-details">
                <div className="tip-name">Result</div>
                <div className="tip-description">
                  Share the outcome. Use metrics and data when possible to show impact.
                </div>
              </div>
            </div>
          </div>

          <div className="tips-example">
            <div className="example-header">
              <span className="example-icon">📝</span>
              Quick Example
            </div>
            <div className="example-text">
              <strong>C:</strong> "Our API response time was 3 seconds..."<br />
              <strong>A:</strong> "I implemented Redis caching and optimized queries..."<br />
              <strong>R:</strong> "Response time dropped to 200ms, improving user satisfaction by 40%"
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
