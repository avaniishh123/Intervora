import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface ContestRankEntry {
  rank: number;
  candidateId: string;
  username: string;
  finalScore: number;
  completionTimeMs: number;
  contestId?: string;
  role?: string;
}

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function rankEmoji(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

// Aggregate local contest history into a simple leaderboard
function buildLocalLeaderboard(userId: string, userName: string): ContestRankEntry[] {
  try {
    const raw = localStorage.getItem('contest_history');
    if (!raw) return [];
    const records = JSON.parse(raw) as Array<{
      id: string; role: string; overall: number; completedAt: string;
    }>;
    if (records.length === 0) return [];
    const best = records.reduce((a, b) => (a.overall >= b.overall ? a : b));
    return [{
      rank: 1,
      candidateId: userId,
      username: userName,
      finalScore: best.overall,
      completionTimeMs: 0,
      role: best.role,
    }];
  } catch {
    return [];
  }
}

interface Props { userId: string; }

const ContestDashboardLeaderboard: React.FC<Props> = ({ userId }) => {
  const user = useAuthStore(s => s.user);
  const [entries, setEntries] = useState<ContestRankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        // Try the global contest leaderboard endpoint
        const res = await api.get('/api/leaderboard/contest', { params: { limit: 10 } });
        if (!cancelled) {
          const data = res.data?.data;
          setEntries(data?.leaderboard ?? data?.rankings ?? []);
          setTotal(data?.totalCandidates ?? 0);
        }
      } catch {
        // Endpoint may not exist yet — fall back to local data
        if (!cancelled) {
          const userName = user?.profile?.name ?? 'You';
          setEntries(buildLocalLeaderboard(userId, userName));
          setTotal(1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId, user]);

  return (
    <div className="contest-lb">
      <div className="contest-lb__header">
        <h2 className="contest-lb__title">🏆 Contest Leaderboard</h2>
        <p className="contest-lb__subtitle">Top performers across all contest sessions</p>
      </div>

      {loading && <div className="contest-lb__loading">Loading rankings...</div>}

      {!loading && entries.length === 0 && (
        <div className="contest-lb__empty">
          No contest rankings yet. Complete a Contest Mode session to appear here!
        </div>
      )}

      {!loading && entries.length > 0 && (
        <>
          <table className="contest-lb__table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Participant</th>
                {entries[0]?.role !== undefined && <th>Role</th>}
                <th>Score</th>
                {entries[0]?.completionTimeMs > 0 && <th>Time</th>}
              </tr>
            </thead>
            <tbody>
              {entries.map(e => {
                const isMe = e.candidateId === userId;
                return (
                  <tr key={`${e.rank}-${e.candidateId}`} className={isMe ? 'contest-lb__row--me' : ''}>
                    <td>
                      <span className="contest-lb__rank">{rankEmoji(e.rank)}</span>
                    </td>
                    <td>
                      {e.username}
                      {isMe && (
                        <span style={{ marginLeft: '6px', fontSize: '11px', color: '#a78bfa', fontWeight: 700 }}>
                          (you)
                        </span>
                      )}
                    </td>
                    {e.role !== undefined && <td style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>{e.role}</td>}
                    <td><span className="contest-lb__score">{e.finalScore}</span></td>
                    {e.completionTimeMs > 0 && (
                      <td><span className="contest-lb__time">{formatMs(e.completionTimeMs)}</span></td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {total > 0 && (
            <div className="contest-lb__footer">
              Showing top {entries.length} of {total} contest participants
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ContestDashboardLeaderboard;
