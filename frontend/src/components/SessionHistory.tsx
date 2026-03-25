import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { InterviewSession } from '../types';
import '../styles/SessionHistory.css';

interface SessionHistoryProps {
  userId: string;
  selectedRole?: string;
  onRoleChange?: (role: string) => void;
  allSessions?: InterviewSession[];
  onSessionsLoaded?: (sessions: InterviewSession[]) => void;
}

const DASHBOARD_LIMIT = 5;

const SessionHistory = ({
  userId,
  selectedRole = '',
  onRoleChange,
  allSessions: externalSessions,
  onSessionsLoaded
}: SessionHistoryProps) => {
  const navigate = useNavigate();
  const [internalSessions, setInternalSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterDateRange, setFilterDateRange] = useState<string>('all');

  // Delete confirmation dialog state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const allFetchedSessions = externalSessions && externalSessions.length > 0
    ? externalSessions
    : internalSessions;

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/api/sessions/user/${userId}`, {
        params: { status: 'completed', limit: 50, skip: 0 }
      });
      const fetched: InterviewSession[] = response.data.data.sessions;
      setInternalSessions(fetched);
      onSessionsLoaded?.(fetched);
    } catch (err: any) {
      console.error('Error fetching sessions:', err);
      setError(err.response?.data?.message || 'Failed to load session history');
    } finally {
      setLoading(false);
    }
  }, [userId, onSessionsLoaded]);

  useEffect(() => {
    if (!externalSessions || externalSessions.length === 0) {
      fetchSessions();
    } else {
      setLoading(false);
    }
  }, [userId]);

  const handleDeleteClick = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTargetId(sessionId);
  };

  const handleCancelDelete = () => {
    setDeleteTargetId(null);
  };

  const handleProceedDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/sessions/${deleteTargetId}`);
      const updated = internalSessions.filter(s => {
        const sid = (s as any)._id || s.id;
        return sid !== deleteTargetId;
      });
      setInternalSessions(updated);
      onSessionsLoaded?.(updated);
      setDeleteTargetId(null);
    } catch (err: any) {
      console.error('Error deleting session:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const filterSessionsByDateRange = (sessions: InterviewSession[], range: string): InterviewSession[] => {
    if (range === 'all') return sessions;
    const now = new Date();
    return sessions.filter(session => {
      const daysDiff = Math.floor((now.getTime() - new Date(session.startTime).getTime()) / (1000 * 60 * 60 * 24));
      if (range === 'week') return daysDiff <= 7;
      if (range === 'month') return daysDiff <= 30;
      if (range === '3months') return daysDiff <= 90;
      return true;
    });
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#48bb78';
    if (score >= 60) return '#ed8936';
    return '#f56565';
  };

  const handleViewSession = (sessionId: string) => {
    navigate(`/interview/report/${sessionId}`);
  };

  const uniqueRoles = Array.from(new Set(allFetchedSessions.map(s => s.jobRole))).sort();

  let filtered = filterSessionsByDateRange(allFetchedSessions, filterDateRange);
  if (selectedRole) {
    filtered = filtered.filter(s => s.jobRole === selectedRole);
  }
  const sortedSessions = [...filtered].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  );

  const recentSessions = sortedSessions.slice(0, DASHBOARD_LIMIT);
  const hasMore = sortedSessions.length > DASHBOARD_LIMIT;

  if (loading) {
    return (
      <div className="session-history-loading">
        <div className="spinner"></div>
        <p>Loading session history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="session-history-error">
        <p>{error}</p>
        <button onClick={fetchSessions} className="retry-button">Retry</button>
      </div>
    );
  }

  return (
    <div className="session-history">
      {/* Delete Confirmation Dialog */}
      {deleteTargetId && (
        <div className="delete-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-dialog-title">
          <div className="delete-dialog">
            <div className="delete-dialog-icon">🗑️</div>
            <h3 id="delete-dialog-title" className="delete-dialog-title">Delete Session?</h3>
            <p className="delete-dialog-message">
              Are you sure you want to delete this session? Please note that once this session is deleted, it cannot be recovered.
            </p>
            <div className="delete-dialog-actions">
              <button
                className="delete-dialog-cancel"
                onClick={handleCancelDelete}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="delete-dialog-proceed"
                onClick={handleProceedDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="session-history-header">
        <h2>Session History</h2>
        <div className="session-filters">
          <select
            value={filterDateRange}
            onChange={(e) => setFilterDateRange(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Time</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="3months">Last 3 Months</option>
          </select>

          <select
            value={selectedRole}
            onChange={(e) => onRoleChange?.(e.target.value)}
            className="filter-select"
          >
            <option value="">All Roles</option>
            {uniqueRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>
      </div>

      {recentSessions.length === 0 ? (
        <div className="no-sessions">
          <p>No completed sessions found.</p>
          <p className="no-sessions-hint">Start your first interview to see your history here!</p>
        </div>
      ) : (
        <>
          <div className="session-cards">
            {recentSessions.map(session => {
              const sessionId = (session as any)._id || session.id;
              return (
                <div key={sessionId} className="session-card">
                  <div className="session-card-header">
                    <div className="session-info">
                      <h3>{session.jobRole}</h3>
                      <span className="session-date">{formatDate(session.startTime)}</span>
                    </div>
                    <div
                      className="session-score"
                      style={{ color: getScoreColor(session.performanceReport?.overallScore || 0) }}
                    >
                      {session.performanceReport?.overallScore != null
                        ? session.performanceReport.overallScore.toFixed(1)
                        : 'N/A'}
                    </div>
                  </div>

                  <div className="session-card-body">
                    <div className="session-meta">
                      <span className="session-mode-badge">{session.mode}</span>
                      <span className="session-questions">{session.questions.length} questions</span>
                    </div>

                    {session.performanceReport && (
                      <div className="session-categories">
                        <div className="category-score">
                          <span className="category-label">Technical</span>
                          <span className="category-value">
                            {(session.performanceReport.categoryScores.technical ?? 0).toFixed(0)}
                          </span>
                        </div>
                        <div className="category-score">
                          <span className="category-label">Behavioral</span>
                          <span className="category-value">
                            {(session.performanceReport.categoryScores.behavioral ?? 0).toFixed(0)}
                          </span>
                        </div>
                        <div className="category-score">
                          <span className="category-label">Communication</span>
                          <span className="category-value">
                            {(session.performanceReport.categoryScores.communication ?? 0).toFixed(0)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="session-card-footer">
                    <button
                      onClick={() => handleViewSession(sessionId)}
                      className="view-details-button"
                    >
                      View Details
                    </button>
                    <button
                      className="session-delete-btn"
                      onClick={(e) => handleDeleteClick(sessionId, e)}
                      title="Delete this session"
                      aria-label="Delete session"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <div className="view-past-sessions">
              <button
                className="view-past-sessions-btn"
                onClick={() => navigate('/sessions/history')}
              >
                View Past Session Details
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '6px' }}>
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SessionHistory;
