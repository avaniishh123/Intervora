import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { RankingEntry } from '../types/hybrid.types';
import '../styles/ContestLeaderboard.css';

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function ContestLeaderboardPage() {
  const { contestId } = useParams<{ contestId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);

  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!contestId) return;
    api.get(`/api/hybrid/contest/${contestId}/leaderboard`)
      .then(res => setRankings(res.data.data.leaderboard.rankings ?? []))
      .catch(err => setError(err?.response?.data?.message ?? 'Failed to load leaderboard.'))
      .finally(() => setLoading(false));
  }, [contestId]);

  const rankClass = (rank: number) =>
    rank === 1 ? 'contest-leaderboard__rank--1' :
    rank === 2 ? 'contest-leaderboard__rank--2' :
    rank === 3 ? 'contest-leaderboard__rank--3' : '';

  const rankEmoji = (rank: number) =>
    rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

  return (
    <div className="contest-leaderboard">
      <div className="contest-leaderboard__card">
        <h1 className="contest-leaderboard__title">🏆 Contest Results</h1>
        <p className="contest-leaderboard__subtitle">Contest ID: {contestId}</p>

        {loading && <div className="contest-leaderboard__loading">Loading results...</div>}
        {error && <div style={{ color: '#fca5a5', textAlign: 'center', padding: '1rem' }}>{error}</div>}

        {!loading && !error && (
          <table className="contest-leaderboard__table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Participant</th>
                <th>Score</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map(r => {
                const isMe = user?.profile?.name === r.username || r.candidateId === user?.id;
                return (
                  <tr key={r.rank} className={isMe ? 'contest-leaderboard__row--me' : ''}>
                    <td>
                      <span className={`contest-leaderboard__rank ${rankClass(r.rank)}`}>
                        {rankEmoji(r.rank)}
                      </span>
                    </td>
                    <td>
                      {r.username}
                      {isMe && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#a78bfa' }}>(you)</span>}
                    </td>
                    <td><span className="contest-leaderboard__score">{r.finalScore}</span></td>
                    <td><span className="contest-leaderboard__time">{formatMs(r.completionTimeMs)}</span></td>
                  </tr>
                );
              })}
              {rankings.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '2rem' }}>
                    No results yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button className="contest-leaderboard__back-btn" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
