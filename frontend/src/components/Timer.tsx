import { useState, useEffect, useRef } from 'react';
import '../styles/Timer.css';

interface TimerProps {
  duration: number; // Duration in seconds
  onTimeUp: () => void;
  isActive?: boolean;
  warningThreshold?: number; // Seconds remaining to show warning
  showProgress?: boolean;
}

export default function Timer({
  duration,
  onTimeUp,
  isActive = true,
  warningThreshold = 10,
  showProgress = true
}: TimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isPaused, setIsPaused] = useState(!isActive);
  const intervalRef = useRef<number | null>(null);
  const hasCalledTimeUpRef = useRef(false);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progressPercentage = (timeRemaining / duration) * 100;

  // Determine if warning should be shown
  const isWarning = timeRemaining <= warningThreshold && timeRemaining > 0;
  const isTimeUp = timeRemaining <= 0;

  // Timer logic
  useEffect(() => {
    if (!isActive || isPaused) {
      return;
    }

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Start countdown
    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = prev - 1;

        // Time's up
        if (newTime <= 0) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          
          // Call onTimeUp only once
          if (!hasCalledTimeUpRef.current) {
            hasCalledTimeUpRef.current = true;
            onTimeUp();
          }
          
          return 0;
        }

        return newTime;
      });
    }, 1000);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, isPaused, onTimeUp]);

  // Reset when duration changes
  useEffect(() => {
    setTimeRemaining(duration);
    hasCalledTimeUpRef.current = false;
  }, [duration]);

  // Pause/Resume handlers
  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  // Get timer class based on state
  const getTimerClass = (): string => {
    if (isTimeUp) return 'timer-display time-up';
    if (isWarning) return 'timer-display warning';
    return 'timer-display';
  };

  return (
    <div className="timer-container">
      <div className={getTimerClass()}>
        <div className="timer-icon">
          {isTimeUp ? '⏰' : isWarning ? '⚠️' : '⏱️'}
        </div>
        
        <div className="timer-time">
          {formatTime(timeRemaining)}
        </div>

        {isActive && !isTimeUp && (
          <button
            onClick={togglePause}
            className="timer-pause-button"
            title={isPaused ? 'Resume' : 'Pause'}
          >
            {isPaused ? '▶️' : '⏸️'}
          </button>
        )}
      </div>

      {showProgress && (
        <div className="timer-progress-container">
          <div
            className={`timer-progress-bar ${isWarning ? 'warning' : ''} ${isTimeUp ? 'time-up' : ''}`}
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      )}

      {isWarning && !isTimeUp && (
        <div className="timer-warning-message">
          ⚠️ Time running low!
        </div>
      )}

      {isTimeUp && (
        <div className="timer-timeup-message">
          ⏰ Time's up! Submitting answer...
        </div>
      )}

      {isPaused && !isTimeUp && (
        <div className="timer-paused-message">
          ⏸️ Timer paused
        </div>
      )}
    </div>
  );
}
