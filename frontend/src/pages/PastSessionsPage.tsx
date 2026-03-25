import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { InterviewSession } from '../types';
import '../styles/PastSessionsPage.css';

const PastSessionsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterDateRange, setFilterDateRange] = useState<string>('all');

  // Delete dialog state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchSessions = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/api/sessions/user/${user.id}`, {
        params: { status: 'completed', limit: 200, skip: 0 }
      });
      const fetched: InterviewSession[] = response.data.data.sessions;
      // Sort most recent first
      fetched.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
      setSessions(fetched);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const filterByDateRange = (list: InterviewSession[], range: string): InterviewSession[] => {
    if (range === 'all') return list;
    const now = new Date();
    return list.filter(s => {
      const days = Math.floor((now.getTime() - new Date(s.startTime).getTime()) / (1000 * 60 * 60 * 24));
      if (range === 'week') return days <= 7;
      if (range === 'month') return days <= 30;
      if (range === '3months') return days <= 90;
      return true;
    });
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#48bb78';
    if (score >= 60) return '#ed8936';
    return '#f56565';
  };

  const handleDeleteClick = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTargetId(sessionId);
  };

  const handleCancelDelete = () => setDeleteTargetId(null);

  const handleProceedDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/sessions/${deleteTargetId}`);
      setSessions(prev => prev.filter(s => {
        const sid = (s as any)._id || s.id;
        return sid !== deleteTargetId;
      }));
      setDeleteTargetId(null);
    } catch (err: any) {
      console.error('Error deleting session:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const uniqueRoles = Array.from(new Set(sessions.map(s => s.jobRole))).sort();

  let displayed = filterByDateRange(sessions, filterDateRange);
  if (filterRole) displayed = displayed.filter(s => s.jobRole === filterRole);

  return (
    <div className="past-sessions-page">
      {/* Delete Confirmation Dialog */}
      {deleteTargetId && (
        <div className="psp-delete-overlay" role="dialog" aria-modal="true" aria-labelledby="psp-delete-title">
          <div className="psp-delete-dialog">
            <div className="psp-delete-icon">🗑️</div>
            <h3 id="psp-delete-title" className="psp-delete-title">Delete Session?</h3>
            <p className="psp-delete-message">
              Are you sure you want to delete this session? Please note that once this session is deleted, it cannot be recovered.
            </p>
            <div className="psp-delete-actions">
              <button className="psp-delete-cancel" onClick={handleCancelDelete} disabled={isDeleting}>
                Cancel
              </button>
              <button className="psp-delete-proceed" onClick={handleProceedDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Proceed'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="past-sessions-container">
        <div className="past-sessions-header">
          <button className="back-btn" onClick={() => navigate('/dashboard')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          <h1>Past Session Details</h1>
          <p className="past-sessions-subtitle">Complete history of all your interview sessions</p>
        </div>

        <div className="past-sessions-filters">
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
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="filter-select"
          >
            <option value="">All Roles</option>
            {uniqueRoles.map(role => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>

          <span className="session-count-badge">{displayed.length} session{displayed.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="past-sessions-loading">
            <div className="spinner"></div>
            <p>Loading sessions...</p>
          </div>
        ) : error ? (
          <div className="past-sessions-error">
            <p>{error}</p>
            <button onClick={fetchSessions} className="retry-button">Retry</button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="no-sessions">
            <p>No sessions found for the selected filters.</p>
          </div>
        ) : (
          <div className="past-session-cards">
            {displayed.map(session => {
              const sessionId = (session as any)._id || session.id;
              return (
                <div key={sessionId} className="past-session-card">
                  <div className="past-session-card-header">
                    <div className="past-session-info">
                      <h3>{session.jobRole}</h3>
                      <span className="session-date">{formatDate(session.startTime)}</span>
                    </div>
                    <div
                      className="past-session-score"
                      style={{ color: getScoreColor(session.performanceReport?.overallScore || 0) }}
                    >
                      {session.performanceReport?.overallScore != null
                        ? session.performanceReport.overallScore.toFixed(1)
                        : 'N/A'}
                    </div>
                  </div>

                  <div className="past-session-card-body">
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

                  <div className="past-session-card-footer">
                    <button
                      className="view-details-button"
                      onClick={() => navigate(`/interview/report/${sessionId}`)}
                    >
                      View Details
                    </button>
                    <button
                      className="psp-delete-btn"
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
        )}
      </div>
    </div>
  );
};

export default PastSessionsPage;
