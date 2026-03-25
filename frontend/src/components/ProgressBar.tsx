import '../styles/ProgressBar.css';

interface ProgressBarProps {
  currentQuestion: number;
  totalQuestions: number;
  completionPercentage?: number;
  showPercentage?: boolean;
  showQuestionCount?: boolean;
}

export default function ProgressBar({
  currentQuestion,
  totalQuestions,
  completionPercentage,
  showPercentage = true,
  showQuestionCount = true
}: ProgressBarProps) {
  // Calculate percentage if not provided
  const percentage = completionPercentage ?? 
    Math.round((currentQuestion / totalQuestions) * 100);

  // Determine progress color based on completion
  const getProgressColor = (): string => {
    if (percentage < 33) return '#ef4444'; // Red
    if (percentage < 66) return '#f59e0b'; // Orange
    return '#10b981'; // Green
  };

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-header">
        <div className="progress-bar-title">
          Interview Progress
        </div>
        
        <div className="progress-bar-stats">
          {showQuestionCount && (
            <span className="question-count">
              {currentQuestion} / {totalQuestions} Questions
            </span>
          )}
          {showPercentage && (
            <span className="percentage-badge">
              {percentage}%
            </span>
          )}
        </div>
      </div>

      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: getProgressColor()
          }}
        >
          {percentage > 10 && (
            <span className="progress-bar-label">
              {percentage}%
            </span>
          )}
        </div>
      </div>

      <div className="progress-bar-milestones">
        <span className={`milestone ${percentage >= 25 ? 'reached' : ''}`}>
          25%
        </span>
        <span className={`milestone ${percentage >= 50 ? 'reached' : ''}`}>
          50%
        </span>
        <span className={`milestone ${percentage >= 75 ? 'reached' : ''}`}>
          75%
        </span>
        <span className={`milestone ${percentage >= 100 ? 'reached' : ''}`}>
          100%
        </span>
      </div>
    </div>
  );
}
