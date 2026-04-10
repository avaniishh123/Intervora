import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import '../styles/SessionHistory.css'; // reuse delete dialog + shared styles

interface ContestRecord {
  id: string;
  role: string;
  duration: number; // minutes
  mcqScore: number;
  mcqTotal: number;
  interviewAvg: number;
  overall: number;
  grade: string;
  completedAt: string;
}

interface ContestHistoryProps {
  userId: string;
}

const LIMIT = 6;

function getScoreColor(score: number): string {
  if (score >= 80) return '#48bb78';
  if (score >= 60) return '#ed8936';
  return '#f56565';
}

function getGradeClass(overall: number): string {
  if (overall >= 80) return 'contest-grade-pill--excellent';
  if (overall >= 60) return 'contest-grade-pill--good';
  return 'contest-grade-pill--fair';
}

function getGradeLabel(overall: number): string {
  if (overall >= 90) return '🏆 S Grade';
  if (overall >= 80) return '🥇 A Grade';
  if (overall >= 70) return '🥈 B Grade';
  if (overall >= 60) return '🥉 C Grade';
  return '📈 D Grade';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

// Reads contest records stored locally by ContestModePage after completion
function loadLocalContestHistory(): ContestRecord[] {
  try {
    const raw = localStorage.getItem('contest_history');
    if (!raw) return [];
    return JSON.parse(raw) as ContestRecord[];
  } catch {
    return [];
  }
}

const ContestHistory: React.FC<ContestHistoryProps> = ({ userId }) => {
  const [records, setRecords] = useState<ContestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('');

  // Delete confirmation state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Try fetching from backend first; fall back to localStorage
      const res = await api.get(`/api/sessions/user/${userId}`, {
        params: { status: 'completed', limit: 50, mode: 'contest' },
      });
      const sessions = res.data?.data?.sessions ?? [];
      if (sessions.length > 0) {
        const mapped: ContestRecord[] = sessions.map((s: any) => ({
          id: s._id || s.id,
          role: s.jobRole || s.metadata?.jobRole || 'Unknown',
          duration: s.metadata?.durationMinutes ?? 10,
          mcqScore: s.metadata?.mcqScore ?? 0,
          mcqTotal: s.metadata?.mcqTotal ?? 0,
          interviewAvg: s.metadata?.interviewAvg ?? 0,
          overall: s.performanceReport?.overallScore ?? s.metadata?.overall ?? 0,
          grade: s.metadata?.grade ?? 'D',
          completedAt: s.endTime || s.startTime,
        }));
        setRecords(mapped);
        return;
      }
    } catch {
      // backend doesn't have contest sessions — use local storage
    }
    setRecords(loadLocalContestHistory());
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTargetId(id);
  };

  const handleCancelDelete = () => setDeleteTargetId(null);

  const handleProceedDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      // Attempt backend delete; silently ignore 404 (local-only records)
      await api.delete(`/api/sessions/${deleteTargetId}`).catch(() => {});

      // Always remove from local state
      const updated = records.filter(r => r.id !== deleteTargetId);
      setRecords(updated);

      // Sync localStorage if this record came from there
      try {
        const raw = localStorage.getItem('contest_history');
        if (raw) {
          const local: ContestRecord[] = JSON.parse(raw);
          localStorage.setItem(
            'contest_history',
            JSON.stringify(local.filter(r => r.id !== deleteTargetId)),
          );
        }
      } catch { /* ignore storage errors */ }

      setDeleteTargetId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const uniqueRoles = Array.from(new Set(records.map(r => r.role))).sort();
  const filtered = filterRole ? records.filter(r => r.role === filterRole) : records;
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );
  const visible = sorted.slice(0, LIMIT);

  if (loading) {
    return (
      <div className="contest-history">
        <div className="session-history-loading">
          <div className="spinner" />
          <p>Loading contest history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="contest-history">
      {/* Delete Confirmation Dialog — identical pattern to SessionHistory */}
      {deleteTargetId && (
        <div className="delete-dialog-overlay" role="dialog" aria-modal="true" aria-labelledby="contest-delete-title">
          <div className="delete-dialog">
            <div className="delete-dialog-icon">🗑️</div>
            <h3 id="contest-delete-title" className="delete-dialog-title">Delete Contest Record?</h3>
            <p className="delete-dialog-message">
              Are you sure you want to delete this contest record? Please note that once deleted, it cannot be recovered.
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

      <div className="contest-history-header">
        <h2>⚡ Contest History</h2>
        <div className="session-filters">
          <select
            className="filter-select"
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
          >
            <option value="">All Roles</option>
            {uniqueRoles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="contest-no-data">
          <p>No contest sessions found.</p>
          <p className="hint">Complete a Contest Mode session to see your history here!</p>
        </div>
      ) : (
        <div className="session-cards">
          {visible.map(rec => (
            <div key={rec.id} className="contest-card">
              <div className="contest-card-header">
                <div className="contest-card-info">
                  <h3>{rec.role}</h3>
                  <span className="contest-card-date">{formatDate(rec.completedAt)}</span>
                </div>
                <div
                  className="contest-card-score"
                  style={{ color: getScoreColor(rec.overall) }}
                >
                  {rec.overall}%
                </div>
              </div>

              <div className="contest-card-meta">
                <span className="contest-badge">⚡ Contest</span>
                <span className="contest-duration-badge">⏱ {rec.duration} min</span>
              </div>

              <div className="contest-card-stats">
                <div className="contest-stat">
                  <span className="contest-stat-label">MCQ</span>
                  <span className="contest-stat-value">{rec.mcqScore}/{rec.mcqTotal}</span>
                </div>
                <div className="contest-stat">
                  <span className="contest-stat-label">Interview</span>
                  <span className="contest-stat-value">
                    {rec.interviewAvg > 0 ? `${rec.interviewAvg}/10` : '—'}
                  </span>
                </div>
                <div className="contest-stat">
                  <span className="contest-stat-label">Overall</span>
                  <span className="contest-stat-value" style={{ color: getScoreColor(rec.overall) }}>
                    {rec.overall}%
                  </span>
                </div>
              </div>

              <div className="contest-card-footer">
                <span className={`contest-grade-pill ${getGradeClass(rec.overall)}`}>
                  {getGradeLabel(rec.overall)}
                </span>
                <button
                  className="session-delete-btn"
                  onClick={(e) => handleDeleteClick(rec.id, e)}
                  title="Delete this contest record"
                  aria-label="Delete contest record"
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
          ))}
        </div>
      )}
    </div>
  );
};

export default ContestHistory;
