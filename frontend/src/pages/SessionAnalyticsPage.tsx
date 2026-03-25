import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import '../styles/SessionAnalytics.css';

interface Session {
  _id: string;
  userId: {
    _id: string;
    email: string;
    profile: {
      name: string;
    };
  };
  jobRole: string;
  mode: string;
  status: string;
  startTime: string;
  endTime?: string;
  performanceReport?: {
    overallScore: number;
    categoryScores: {
      technical: number;
      behavioral: number;
      communication: number;
    };
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
  questions?: Array<{
    question: {
      text: string;
      category: string;
      difficulty: string;
    };
    answer: string;
    evaluation: {
      score: number;
      feedback: string;
      strengths: string[];
      improvements: string[];
    };
    timeSpent: number;
  }>;
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface ExportStats {
  count: number;
  estimatedSize: string;
}

const SessionAnalyticsPage = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 20,
    hasNextPage: false,
    hasPrevPage: false
  });

  const [filters, setFilters] = useState({
    userId: '',
    jobRole: '',
    status: '',
    startDate: '',
    endDate: '',
    minScore: '',
    maxScore: '',
    sortBy: 'startTime',
    sortOrder: 'desc'
  });

  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [exportStats, setExportStats] = useState<ExportStats | null>(null);
  const [exportLoading, setExportLoading] = useState(false);

  const fetchSessions = async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        page,
        limit: pagination.limit,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      };

      if (filters.userId) params.userId = filters.userId;
      if (filters.jobRole) params.jobRole = filters.jobRole;
      if (filters.status) params.status = filters.status;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.minScore) params.minScore = filters.minScore;
      if (filters.maxScore) params.maxScore = filters.maxScore;

      const response = await api.get('/admin/sessions', { params });

      if (response.data.status === 'success') {
        setSessions(response.data.data.sessions);
        setPagination(response.data.data.pagination);
      }
    } catch (err: any) {
      console.error('Error fetching sessions:', err);
      setError(err.response?.data?.message || 'Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const fetchExportPreview = async () => {
    try {
      const exportFilters: any = {};
      
      if (filters.userId) exportFilters.userId = filters.userId;
      if (filters.jobRole) exportFilters.jobRole = filters.jobRole;
      if (filters.status) exportFilters.status = filters.status;
      if (filters.startDate) exportFilters.startDate = filters.startDate;
      if (filters.endDate) exportFilters.endDate = filters.endDate;
      if (filters.minScore) exportFilters.minScore = parseFloat(filters.minScore);
      if (filters.maxScore) exportFilters.maxScore = parseFloat(filters.maxScore);

      const response = await api.post('/admin/export/preview', { filters: exportFilters });

      if (response.data.status === 'success') {
        setExportStats(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching export preview:', err);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      setExportLoading(true);

      const exportFilters: any = {};
      
      if (filters.userId) exportFilters.userId = filters.userId;
      if (filters.jobRole) exportFilters.jobRole = filters.jobRole;
      if (filters.status) exportFilters.status = filters.status;
      if (filters.startDate) exportFilters.startDate = filters.startDate;
      if (filters.endDate) exportFilters.endDate = filters.endDate;
      if (filters.minScore) exportFilters.minScore = parseFloat(filters.minScore);
      if (filters.maxScore) exportFilters.maxScore = parseFloat(filters.maxScore);

      const response = await api.post('/admin/export', 
        { format, filters: exportFilters },
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.setAttribute('download', `sessions-export-${timestamp}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error exporting data:', err);
      alert('Failed to export data. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const viewSessionDetails = async (sessionId: string) => {
    try {
      const response = await api.get(`/admin/sessions/${sessionId}`);
      
      if (response.data.status === 'success') {
        setSelectedSession(response.data.data.session);
        setShowModal(true);
      }
    } catch (err: any) {
      console.error('Error fetching session details:', err);
      alert('Failed to load session details');
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    fetchSessions(1);
    fetchExportPreview();
  };

  const resetFilters = () => {
    setFilters({
      userId: '',
      jobRole: '',
      status: '',
      startDate: '',
      endDate: '',
      minScore: '',
      maxScore: '',
      sortBy: 'startTime',
      sortOrder: 'desc'
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (start: string, end?: string) => {
    if (!end) return 'In Progress';
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.floor(duration / 60000);
    return `${minutes} min`;
  };

  useEffect(() => {
    fetchSessions();
    fetchExportPreview();
  }, []);

  useEffect(() => {
    if (Object.values(filters).every(v => !v || v === 'startTime' || v === 'desc')) {
      fetchSessions(1);
      fetchExportPreview();
    }
  }, [filters]);

  return (
    <div className="session-analytics-page">
      <div className="page-header">
        <h1>📊 Session Analytics</h1>
        <button className="back-button" onClick={() => navigate('/admin')}>
          ← Back to Dashboard
        </button>
      </div>

      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Job Role</label>
            <input
              type="text"
              className="filter-input"
              placeholder="Search by job role..."
              value={filters.jobRole}
              onChange={(e) => handleFilterChange('jobRole', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Status</label>
            <select
              className="filter-select"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="in-progress">In Progress</option>
              <option value="abandoned">Abandoned</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Start Date</label>
            <input
              type="date"
              className="filter-input"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>End Date</label>
            <input
              type="date"
              className="filter-input"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Min Score</label>
            <input
              type="number"
              className="filter-input"
              placeholder="0"
              min="0"
              max="100"
              value={filters.minScore}
              onChange={(e) => handleFilterChange('minScore', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Max Score</label>
            <input
              type="number"
              className="filter-input"
              placeholder="100"
              min="0"
              max="100"
              value={filters.maxScore}
              onChange={(e) => handleFilterChange('maxScore', e.target.value)}
            />
          </div>

          <div className="filter-group">
            <label>Sort By</label>
            <select
              className="filter-select"
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
            >
              <option value="startTime">Start Time</option>
              <option value="endTime">End Time</option>
              <option value="performanceReport.overallScore">Score</option>
              <option value="jobRole">Job Role</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Order</label>
            <select
              className="filter-select"
              value={filters.sortOrder}
              onChange={(e) => handleFilterChange('sortOrder', e.target.value)}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>

        <div className="filter-actions">
          <button className="apply-button" onClick={applyFilters}>
            Apply Filters
          </button>
          <button className="reset-button" onClick={resetFilters}>
            Reset
          </button>
        </div>
      </div>

      <div className="export-section">
        <div className="export-info">
          {exportStats && (
            <p>
              📦 Export Preview: <strong>{exportStats.count}</strong> sessions (~{exportStats.estimatedSize})
            </p>
          )}
        </div>
        <div className="export-buttons">
          <button
            className="export-button"
            onClick={() => handleExport('csv')}
            disabled={exportLoading || !exportStats || exportStats.count === 0}
          >
            {exportLoading ? 'Exporting...' : '📄 Export CSV'}
          </button>
          <button
            className="export-button"
            onClick={() => handleExport('json')}
            disabled={exportLoading || !exportStats || exportStats.count === 0}
          >
            {exportLoading ? 'Exporting...' : '📋 Export JSON'}
          </button>
        </div>
      </div>

      <div className="content-section">
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading sessions...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <p className="error-message">❌ {error}</p>
            <button className="retry-button" onClick={() => fetchSessions()}>
              Retry
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="no-data">
            <p>No sessions found matching your filters.</p>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="sessions-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Job Role</th>
                    <th>Mode</th>
                    <th>Status</th>
                    <th>Start Time</th>
                    <th>Duration</th>
                    <th>Score</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session._id}>
                      <td>
                        <div className="user-info">
                          <div className="user-name">{session.userId.profile.name}</div>
                          <div className="user-email">{session.userId.email}</div>
                        </div>
                      </td>
                      <td>{session.jobRole}</td>
                      <td>
                        <span className="mode-badge">{session.mode}</span>
                      </td>
                      <td>
                        <span className={`status-badge status-${session.status}`}>
                          {session.status}
                        </span>
                      </td>
                      <td>{formatDate(session.startTime)}</td>
                      <td>{formatDuration(session.startTime, session.endTime)}</td>
                      <td>
                        {session.performanceReport?.overallScore !== undefined ? (
                          <span className="score-value">
                            {session.performanceReport.overallScore.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="score-na">N/A</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="view-details-button"
                          onClick={() => viewSessionDetails(session._id)}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button
                className="pagination-button"
                onClick={() => fetchSessions(pagination.currentPage - 1)}
                disabled={!pagination.hasPrevPage}
              >
                ← Previous
              </button>
              <span className="pagination-info">
                Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalCount} total)
              </span>
              <button
                className="pagination-button"
                onClick={() => fetchSessions(pagination.currentPage + 1)}
                disabled={!pagination.hasNextPage}
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>

      {showModal && selectedSession && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Session Details</h2>
              <button className="close-button" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="session-details-section">
                <h3>Session Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">User</span>
                    <span className="detail-value">{selectedSession.userId.profile.name}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Email</span>
                    <span className="detail-value">{selectedSession.userId.email}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Job Role</span>
                    <span className="detail-value">{selectedSession.jobRole}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Mode</span>
                    <span className="detail-value">{selectedSession.mode}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Status</span>
                    <span className="detail-value">
                      <span className={`status-badge status-${selectedSession.status}`}>
                        {selectedSession.status}
                      </span>
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Start Time</span>
                    <span className="detail-value">{formatDate(selectedSession.startTime)}</span>
                  </div>
                  {selectedSession.endTime && (
                    <div className="detail-item">
                      <span className="detail-label">End Time</span>
                      <span className="detail-value">{formatDate(selectedSession.endTime)}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="detail-label">Duration</span>
                    <span className="detail-value">
                      {formatDuration(selectedSession.startTime, selectedSession.endTime)}
                    </span>
                  </div>
                </div>
              </div>

              {selectedSession.performanceReport && (
                <div className="performance-section">
                  <h3>Performance Report</h3>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <span className="detail-label">Overall Score</span>
                      <span className="detail-value score-highlight">
                        {selectedSession.performanceReport.overallScore.toFixed(1)}%
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Technical</span>
                      <span className="detail-value">
                        {selectedSession.performanceReport.categoryScores.technical.toFixed(1)}%
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Behavioral</span>
                      <span className="detail-value">
                        {selectedSession.performanceReport.categoryScores.behavioral.toFixed(1)}%
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Communication</span>
                      <span className="detail-value">
                        {selectedSession.performanceReport.categoryScores.communication.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="strengths-weaknesses">
                    <div className="strengths">
                      <h4>💪 Strengths</h4>
                      <ul>
                        {selectedSession.performanceReport.strengths.map((strength, idx) => (
                          <li key={idx}>{strength}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="weaknesses">
                      <h4>📈 Areas for Improvement</h4>
                      <ul>
                        {selectedSession.performanceReport.weaknesses.map((weakness, idx) => (
                          <li key={idx}>{weakness}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="recommendations">
                    <h4>💡 Recommendations</h4>
                    <ul>
                      {selectedSession.performanceReport.recommendations.map((rec, idx) => (
                        <li key={idx}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {selectedSession.questions && selectedSession.questions.length > 0 && (
                <div className="qa-section">
                  <h3>Questions & Answers ({selectedSession.questions.length})</h3>
                  <div className="qa-list">
                    {selectedSession.questions.map((qa, idx) => (
                      <div key={idx} className="qa-item">
                        <div className="qa-header">
                          <span className="qa-number">Q{idx + 1}</span>
                          <span className={`qa-category category-${qa.question.category}`}>
                            {qa.question.category}
                          </span>
                          <span className="qa-difficulty">{qa.question.difficulty}</span>
                          <span className="qa-score">Score: {qa.evaluation.score}%</span>
                        </div>
                        <div className="qa-question">
                          <strong>Question:</strong> {qa.question.text}
                        </div>
                        <div className="qa-answer">
                          <strong>Answer:</strong> {qa.answer || 'No answer provided'}
                        </div>
                        <div className="qa-feedback">
                          <strong>Feedback:</strong> {qa.evaluation.feedback}
                        </div>
                        {qa.evaluation.strengths.length > 0 && (
                          <div className="qa-strengths">
                            <strong>Strengths:</strong>
                            <ul>
                              {qa.evaluation.strengths.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {qa.evaluation.improvements.length > 0 && (
                          <div className="qa-improvements">
                            <strong>Improvements:</strong>
                            <ul>
                              {qa.evaluation.improvements.map((imp, i) => (
                                <li key={i}>{imp}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionAnalyticsPage;
