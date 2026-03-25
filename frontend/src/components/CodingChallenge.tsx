import React, { useState, useEffect } from 'react';
import LazyCodeEditor from './LazyCodeEditor';
import api from '../services/api';
import { CodingChallenge as CodingChallengeType, CodeFeedback, Question } from '../types';
import '../styles/CodingChallenge.css';

interface CodingChallengeProps {
  role: string;
  onComplete?: (feedback: CodeFeedback) => void;
  sessionId?: string;
}

const CodingChallenge: React.FC<CodingChallengeProps> = ({ role, onComplete, sessionId }) => {
  const [challenges, setChallenges] = useState<CodingChallengeType[]>([]);
  const [currentChallenge, setCurrentChallenge] = useState<CodingChallengeType | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('python');
  const [code, setCode] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<CodeFeedback | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchChallenges();
  }, [role]);

  useEffect(() => {
    if (currentChallenge && currentChallenge.starterCode[selectedLanguage]) {
      setCode(currentChallenge.starterCode[selectedLanguage]);
    }
  }, [currentChallenge, selectedLanguage]);

  const fetchChallenges = async () => {
    try {
      setIsLoading(true);
      setError('');
      const response = await api.get(`/api/coding/challenges/${role}`);
      
      if (response.data.success && response.data.data.length > 0) {
        setChallenges(response.data.data);
        const firstChallenge = response.data.data[0];
        setCurrentChallenge(firstChallenge);
        
        // Set initial language and code
        const initialLang = firstChallenge.language[0] || 'python';
        setSelectedLanguage(initialLang);
        setCode(firstChallenge.starterCode[initialLang] || '');
      } else {
        setError('No coding challenges available for this role.');
      }
    } catch (err: any) {
      console.error('Error fetching challenges:', err);
      setError(err.response?.data?.message || 'Failed to load coding challenges.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
    if (currentChallenge && currentChallenge.starterCode[language]) {
      setCode(currentChallenge.starterCode[language]);
    }
  };

  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
  };

  const handleSubmit = async () => {
    if (!currentChallenge || !code.trim()) {
      setError('Please write some code before submitting.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      setFeedback(null);

      const response = await api.post('/api/coding/submit', {
        challengeId: currentChallenge.id,
        code,
        language: selectedLanguage,
        sessionId,
      });

      if (response.data.success) {
        const codeFeedback = response.data.data;
        setFeedback(codeFeedback);
        
        if (onComplete) {
          onComplete(codeFeedback);
        }
      }
    } catch (err: any) {
      console.error('Error submitting code:', err);
      setError(err.response?.data?.message || 'Failed to submit code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectChallenge = (challenge: CodingChallengeType) => {
    setCurrentChallenge(challenge);
    setFeedback(null);
    setError('');
    const initialLang = challenge.language[0] || 'python';
    setSelectedLanguage(initialLang);
    setCode(challenge.starterCode[initialLang] || '');
  };

  if (isLoading) {
    return (
      <div className="coding-challenge-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading coding challenges...</p>
        </div>
      </div>
    );
  }

  if (error && !currentChallenge) {
    return (
      <div className="coding-challenge-container">
        <div className="error-state">
          <p className="error-message">{error}</p>
          <button onClick={fetchChallenges} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="coding-challenge-container">
      <div className="challenge-header">
        <h2>Coding Challenge</h2>
        {challenges.length > 1 && (
          <div className="challenge-selector">
            <label>Select Challenge:</label>
            <select
              value={currentChallenge?.id || ''}
              onChange={(e) => {
                const challenge = challenges.find((c) => c.id === e.target.value);
                if (challenge) handleSelectChallenge(challenge);
              }}
            >
              {challenges.map((challenge, index) => (
                <option key={challenge.id} value={challenge.id}>
                  Challenge {index + 1}: {challenge.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {currentChallenge && (
        <>
          <div className="challenge-description">
            <div className="challenge-title-row">
              <h3>{currentChallenge.title}</h3>
              <span className={`difficulty-badge ${currentChallenge.difficulty.toLowerCase()}`}>
                {currentChallenge.difficulty}
              </span>
            </div>
            <p className="description-text">{currentChallenge.description}</p>

            {currentChallenge.testCases.length > 0 && (
              <div className="test-cases">
                <h4>Test Cases:</h4>
                {currentChallenge.testCases
                  .filter((tc) => !tc.isHidden)
                  .map((testCase, index) => (
                    <div key={index} className="test-case">
                      <div className="test-case-row">
                        <span className="test-label">Input:</span>
                        <code>{JSON.stringify(testCase.input)}</code>
                      </div>
                      <div className="test-case-row">
                        <span className="test-label">Expected Output:</span>
                        <code>{JSON.stringify(testCase.expectedOutput)}</code>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="code-editor-section">
            <LazyCodeEditor
              value={code}
              onChange={handleCodeChange}
              language={selectedLanguage}
              onLanguageChange={handleLanguageChange}
              availableLanguages={currentChallenge.language}
              readOnly={isSubmitting}
            />
          </div>

          <div className="submit-section">
            {error && <p className="error-message">{error}</p>}
            <button
              className="submit-btn"
              onClick={handleSubmit}
              disabled={isSubmitting || !code.trim()}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Code'}
            </button>
          </div>

          {feedback && (
            <div className="feedback-section">
              <h3>Feedback</h3>
              
              <div className={`result-status ${feedback.isCorrect ? 'success' : 'partial'}`}>
                {feedback.isCorrect ? '✓ All tests passed!' : '⚠ Some tests failed'}
              </div>

              {feedback.testResults && feedback.testResults.length > 0 && (
                <div className="test-results">
                  <h4>Test Results:</h4>
                  {feedback.testResults.map((result: any, index: number) => (
                    <div key={index} className={`test-result ${result.passed ? 'passed' : 'failed'}`}>
                      <span className="test-number">Test {index + 1}:</span>
                      <span className="test-status">{result.passed ? 'Passed ✓' : 'Failed ✗'}</span>
                      {!result.passed && result.error && (
                        <div className="test-error">{result.error}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="gemini-analysis">
                <h4>AI Analysis</h4>
                <div className="analysis-item">
                  <span className="analysis-label">Code Quality:</span>
                  <div className="quality-bar">
                    <div
                      className="quality-fill"
                      style={{ width: `${feedback.geminiAnalysis.codeQuality}%` }}
                    ></div>
                  </div>
                  <span className="quality-score">{feedback.geminiAnalysis.codeQuality}/100</span>
                </div>

                <div className="analysis-item">
                  <span className="analysis-label">Efficiency:</span>
                  <p>{feedback.geminiAnalysis.efficiency}</p>
                </div>

                {feedback.geminiAnalysis.bestPractices.length > 0 && (
                  <div className="analysis-item">
                    <span className="analysis-label">Best Practices:</span>
                    <ul className="practices-list">
                      {feedback.geminiAnalysis.bestPractices.map((practice, index) => (
                        <li key={index}>{practice}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {feedback.geminiAnalysis.suggestions.length > 0 && (
                  <div className="analysis-item">
                    <span className="analysis-label">Suggestions:</span>
                    <ul className="suggestions-list">
                      {feedback.geminiAnalysis.suggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {feedback.followUpQuestions && feedback.followUpQuestions.length > 0 && (
                <div className="follow-up-questions">
                  <h4>Follow-up Questions:</h4>
                  {feedback.followUpQuestions.map((question: Question, index: number) => (
                    <div key={question.id} className="follow-up-question">
                      <p>
                        <strong>Q{index + 1}:</strong> {question.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CodingChallenge;
