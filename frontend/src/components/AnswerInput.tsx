import { useState, useEffect, useRef, ChangeEvent } from 'react';
import '../styles/AnswerInput.css';

interface AnswerInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoSaveInterval?: number;
  onAutoSave?: (value: string) => void;
  maxLength?: number;
}

export default function AnswerInput({
  value,
  onChange,
  placeholder = 'Type your answer here...',
  disabled = false,
  autoSaveInterval = 3000,
  onAutoSave,
  maxLength = 5000
}: AnswerInputProps) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Calculate character and word count
  const characterCount = value.length;
  const wordCount = value.trim() === '' ? 0 : value.trim().split(/\s+/).length;

  // Handle input change
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    
    // Enforce max length
    if (newValue.length <= maxLength) {
      onChange(newValue);
    }
  };

  // Auto-save functionality
  useEffect(() => {
    if (!onAutoSave || value.trim() === '') {
      return;
    }

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer
    autoSaveTimerRef.current = window.setTimeout(() => {
      setIsSaving(true);
      
      try {
        onAutoSave(value);
        setLastSaved(new Date());
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsSaving(false);
      }
    }, autoSaveInterval);

    // Cleanup
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [value, autoSaveInterval, onAutoSave]);

  // Format last saved time
  const formatLastSaved = (): string => {
    if (!lastSaved) return '';
    
    const now = new Date();
    const diffMs = now.getTime() - lastSaved.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) {
      return 'Saved just now';
    } else if (diffSec < 3600) {
      const minutes = Math.floor(diffSec / 60);
      return `Saved ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    } else {
      return `Saved at ${lastSaved.toLocaleTimeString()}`;
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [value]);

  return (
    <div className="answer-input-container">
      <div className="answer-input-header">
        <label className="answer-label">Your Answer</label>
        
        <div className="answer-stats">
          <span className="stat-item">
            <span className="stat-label">Words:</span>
            <span className="stat-value">{wordCount}</span>
          </span>
          <span className="stat-divider">|</span>
          <span className="stat-item">
            <span className="stat-label">Characters:</span>
            <span className={`stat-value ${characterCount > maxLength * 0.9 ? 'warning' : ''}`}>
              {characterCount}/{maxLength}
            </span>
          </span>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        className="answer-textarea"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        rows={6}
        maxLength={maxLength}
      />

      <div className="answer-input-footer">
        <div className="auto-save-status">
          {isSaving ? (
            <span className="saving-indicator">
              <span className="spinner"></span>
              Saving...
            </span>
          ) : lastSaved ? (
            <span className="saved-indicator">
              ✓ {formatLastSaved()}
            </span>
          ) : null}
        </div>

        {characterCount > maxLength * 0.9 && (
          <div className="character-warning">
            {maxLength - characterCount} characters remaining
          </div>
        )}
      </div>
    </div>
  );
}
