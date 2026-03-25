import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContestHistory;
