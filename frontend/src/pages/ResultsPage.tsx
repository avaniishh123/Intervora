import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { InterviewSession } from '../types';
import api from '../services/api';
import PerformanceChart from '../components/PerformanceChart';
import SessionRecording from '../components/SessionRecording';
import confetti from 'canvas-confetti';
import '../styles/ResultsPage.css';

const ResultsPage = () => {
  const [searchParams] = useSearchParams();
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  // Support both URL parameter and query parameter
  const sessionId = urlSessionId || searchParams.get('sessionId');
  
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided');
      setLoading(false);
      return;
    }

    fetchSessionResults();
  }, [sessionId]);

  const fetchSessionResults = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/sessions/${sessionId}`);
      // Backend returns data in response.data.data.session format
      const sessionData = response.data.data?.session || response.data;
      setSession(sessionData);
      
      // Trigger confetti celebration after data loads
      setTimeout(() => {
        triggerConfetti();
      }, 500);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load session results');
    } finally {
      setLoading(false);
    }
  };

  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval: any = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#4caf50';
    if (score >= 60) return '#ff9800';
    return '#f44336';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Very Good';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Improvement';
  };

  if (loading) {
    return (
      <div className="results-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading your results...</p>
        </div>
      </div>
    );
  }

  if (error || !session || !session.performanceReport) {
    return (
      <div className="results-page">
        <div className="error-container">
          <h2>Unable to Load Results</h2>
          <p>{error || 'Session data not found'}</p>
          <button onClick={() => navigate('/dashboard')} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { performanceReport } = session;

  return (
    <div className="results-page">
      <div className="results-container">
        {/* Header */}
        <div className="results-header">
          <h1>🎉 Interview Complete!</h1>
          <p className="session-info">
            {session.jobRole} • {new Date(session.startTime).toLocaleDateString()}
          </p>
        </div>

        {/* Overall Score */}
        <div className="overall-score-section">
          <div className="score-gauge">
            <svg viewBox="0 0 200 200" className="gauge-svg">
              <circle
                cx="100"
                cy="100"
                r="80"
                fill="none"
                stroke="#e0e0e0"
                strokeWidth="20"
              />
              <circle
                cx="100"
                cy="100"
                r="80"
                fill="none"
                stroke={getScoreColor(performanceReport.overallScore)}
                strokeWidth="20"
                strokeDasharray={`${(performanceReport.overallScore / 100) * 502.4} 502.4`}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
                className="gauge-progress"
              />
              <text
                x="100"
                y="100"
                textAnchor="middle"
                dy="10"
                className="gauge-score"
                fill={getScoreColor(performanceReport.overallScore)}
              >
                {performanceReport.overallScore}
              </text>
            </svg>
          </div>
          <div className="score-details">
            <h2>Overall Performance</h2>
            <p className="score-label" style={{ color: getScoreColor(performanceReport.overallScore) }}>
              {getScoreLabel(performanceReport.overallScore)}
            </p>
            <p className="score-description">
              You've completed the interview with a score of {performanceReport.overallScore}/100
            </p>
          </div>
        </div>

        {/* Category Scores */}
        <div className="category-scores-section">
          <h3>Performance by Category</h3>
          <div className="category-bars">
            <div className="category-bar">
              <div className="category-label">
                <span className="category-icon">💻</span>
                <span>Technical</span>
              </div>
              <div className="bar-container">
                <div
                  className="bar-fill"
                  style={{
                    width: `${performanceReport.categoryScores.technical}%`,
                    backgroundColor: getScoreColor(performanceReport.categoryScores.technical)
                  }}
                ></div>
                <span className="bar-value">{performanceReport.categoryScores.technical}</span>
              </div>
            </div>

            <div className="category-bar">
              <div className="category-label">
                <span className="category-icon">🤝</span>
                <span>Behavioral</span>
              </div>
              <div className="bar-container">
                <div
                  className="bar-fill"
                  style={{
                    width: `${performanceReport.categoryScores.behavioral}%`,
                    backgroundColor: getScoreColor(performanceReport.categoryScores.behavioral)
                  }}
                ></div>
                <span className="bar-value">{performanceReport.categoryScores.behavioral}</span>
              </div>
            </div>

            <div className="category-bar">
              <div className="category-label">
                <span className="category-icon">💬</span>
                <span>Communication</span>
              </div>
              <div className="bar-container">
                <div
                  className="bar-fill"
                  style={{
                    width: `${performanceReport.categoryScores.communication}%`,
                    backgroundColor: getScoreColor(performanceReport.categoryScores.communication)
                  }}
                ></div>
                <span className="bar-value">{performanceReport.categoryScores.communication}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Charts */}
        <PerformanceChart session={session} />

        {/* Strengths */}
        <div className="feedback-section">
          <div
            className={`feedback-card strengths ${expandedSection === 'strengths' ? 'expanded' : ''}`}
            onClick={() => toggleSection('strengths')}
          >
            <div className="feedback-header">
              <div className="feedback-title">
                <span className="feedback-icon">✅</span>
                <h3>Strengths</h3>
              </div>
              <span className="expand-icon">{expandedSection === 'strengths' ? '−' : '+'}</span>
            </div>
            {expandedSection === 'strengths' && (
              <ul className="feedback-list">
                {performanceReport.strengths.map((strength, index) => (
                  <li key={index}>{strength}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Weaknesses */}
          <div
            className={`feedback-card weaknesses ${expandedSection === 'weaknesses' ? 'expanded' : ''}`}
            onClick={() => toggleSection('weaknesses')}
          >
            <div className="feedback-header">
              <div className="feedback-title">
                <span className="feedback-icon">⚠️</span>
                <h3>Areas for Improvement</h3>
              </div>
              <span className="expand-icon">{expandedSection === 'weaknesses' ? '−' : '+'}</span>
            </div>
            {expandedSection === 'weaknesses' && (
              <ul className="feedback-list">
                {performanceReport.weaknesses.map((weakness, index) => (
                  <li key={index}>{weakness}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Recommendations */}
          <div
            className={`feedback-card recommendations ${expandedSection === 'recommendations' ? 'expanded' : ''}`}
            onClick={() => toggleSection('recommendations')}
          >
            <div className="feedback-header">
              <div className="feedback-title">
                <span className="feedback-icon">💡</span>
                <h3>Recommendations</h3>
              </div>
              <span className="expand-icon">{expandedSection === 'recommendations' ? '−' : '+'}</span>
            </div>
            {expandedSection === 'recommendations' && (
              <ul className="feedback-list">
                {performanceReport.recommendations.map((recommendation, index) => (
                  <li key={index}>{recommendation}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Session Recording */}
        {session.recordingUrl && sessionId && (
          <SessionRecording
            sessionId={sessionId}
            recordingUrl={session.recordingUrl}
          />
        )}

        {/* Actions */}
        <div className="results-actions">
          <button onClick={() => navigate('/dashboard')} className="btn-secondary">
            Back to Dashboard
          </button>
          <button onClick={() => navigate('/interview/setup')} className="btn-primary">
            Start New Interview
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultsPage;
