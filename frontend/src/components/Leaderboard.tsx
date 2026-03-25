import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { LeaderboardEntry, UserRankInfo } from '../types';
import LeaderboardSkeleton from './LeaderboardSkeleton';
import UserProfilePanel from './UserProfilePanel';
import { useToastContext } from '../contexts/ToastContext';
import { handleApiError } from '../utils/errorHandler';
import '../styles/Leaderboard.css';

interface LeaderboardProps {
  userId?: string;
  // Shared role filter from DashboardPage
  selectedRole?: string;
  onRoleChange?: (role: string) => void;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ userId, selectedRole: externalRole, onRoleChange }) => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalCandidates, setTotalCandidates] = useState<number>(0);
  // Use external role if provided (shared with SessionHistory), otherwise internal
  const [internalRole, setInternalRole] = useState<string>('');
  const selectedRole = externalRole !== undefined ? externalRole : internalRole;
  const setSelectedRole = (role: string) => {
    if (onRoleChange) onRoleChange(role);
    else setInternalRole(role);
  };
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [userRankInfo, setUserRankInfo] = useState<UserRankInfo | null>(null);
  const [profilePanelUserId, setProfilePanelUserId] = useState<string | null>(null);
  const toast = useToastContext();

  // Fetch available roles
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await api.get('/api/leaderboard/roles');
        setAvailableRoles(response.data.data.roles);
      } catch (err) {
        console.error('Error fetching roles:', err);
      }
    };

    fetchRoles();
  }, []);

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      setError(null);

      try {
        const params: any = { limit: 10 };
        if (selectedRole) {
          params.role = selectedRole;
        }

        const response = await api.get('/api/leaderboard', { params });
        
        setLeaderboard(response.data.data.leaderboard);
        setTotalCandidates(response.data.data.totalCandidates || 0);
      } catch (err: any) {
        const errorMessage = handleApiError(err, (msg) => toast.error(msg));
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [selectedRole]);

  // Fetch user's detailed rank info if authenticated
  useEffect(() => {
    const fetchUserRankInfo = async () => {
      if (!userId) return;

      try {
        const response = await api.get('/api/leaderboard/me');
        setUserRankInfo(response.data.data);
      } catch (err) {
        console.error('Error fetching user rank info:', err);
      }
    };

    fetchUserRankInfo();
  }, [userId]);

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRole(e.target.value);
  };

  const handleUsernameClick = (clickedUserId: string) => {
    setProfilePanelUserId(clickedUserId);
  };

  const getRankBadgeClass = (rank: number): string => {
    if (rank === 1) return 'rank-badge gold';
    if (rank === 2) return 'rank-badge silver';
    if (rank === 3) return 'rank-badge bronze';
    return 'rank-badge';
  };

  const getRankIcon = (rank: number): string => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  if (loading) {
    return <LeaderboardSkeleton />;
  }

  if (error) {
    return (
      <div className="leaderboard-container">
        <div className="error-message">
          <p>⚠️ {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <h2>🏆 Leaderboard</h2>
        <p className="leaderboard-subtitle">
          Top performers across all interviews
        </p>
      </div>

      {/* Role Filter */}
      <div className="leaderboard-filters">
        <label htmlFor="role-filter">Filter by Role:</label>
        <select
          id="role-filter"
          value={selectedRole}
          onChange={handleRoleChange}
          className="role-filter-select"
        >
          <option value="">All Roles</option>
          {availableRoles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>

      {/* Leaderboard Table */}
      <div className="leaderboard-table-container">
        {leaderboard.length === 0 ? (
          <div className="no-data">
            <p>No leaderboard entries yet. Complete an interview to appear here!</p>
          </div>
        ) : (
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Candidate</th>
                <th>Role</th>
                <th>Avg Score</th>
                <th>Sessions</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => (
                <tr
                  key={entry.userId}
                  className={entry.userId === userId ? 'current-user' : ''}
                >
                  <td>
                    <span className={getRankBadgeClass(entry.rank)}>
                      {getRankIcon(entry.rank)}
                    </span>
                  </td>
                  <td className="username-cell">
                    <span
                      className="username-clickable"
                      onClick={() => handleUsernameClick(entry.userId)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && handleUsernameClick(entry.userId)}
                    >
                      {entry.username}
                    </span>
                    {entry.userId === userId && (
                      <span className="you-badge">You</span>
                    )}
                  </td>
                  <td className="role-cell">{entry.jobRole}</td>
                  <td className="score-cell">
                    <span className="score-value">{entry.averageScore.toFixed(1)}</span>
                    <span className="score-max">/100</span>
                  </td>
                  <td className="sessions-cell">{entry.totalSessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* User Leaderboard and Progress */}
      {userId && userRankInfo && (
        <div className="user-progress-section">
          <h3>📊 User Leaderboard &amp; Progress</h3>
          <div className="progress-grid">
            <div className="progress-card">
              <span className="progress-card-icon">🏅</span>
              <span className="progress-card-value">#{userRankInfo.rank}</span>
              <span className="progress-card-label">Global Rank</span>
            </div>
            <div className="progress-card">
              <span className="progress-card-icon">📈</span>
              <span className="progress-card-value">{userRankInfo.percentile.toFixed(1)}%</span>
              <span className="progress-card-label">Top Percentile</span>
            </div>
            <div className="progress-card">
              <span className="progress-card-icon">🎯</span>
              <span className="progress-card-value">{userRankInfo.averageScore.toFixed(1)}</span>
              <span className="progress-card-label">Avg Score</span>
            </div>
            <div className="progress-card">
              <span className="progress-card-icon">🗂️</span>
              <span className="progress-card-value">{userRankInfo.totalSessions}</span>
              <span className="progress-card-label">Sessions Done</span>
            </div>
          </div>
          <div className="progress-bar-section">
            <div className="progress-bar-label">
              <span>Ranking Progress</span>
              <span>{userRankInfo.percentile.toFixed(1)}% top</span>
            </div>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill"
                style={{ width: `${Math.min(userRankInfo.percentile, 100)}%` }}
              />
            </div>
          </div>
          <p className="rank-message">
            {userRankInfo.percentile >= 90
              ? '🌟 Outstanding! You\'re in the top 10%!'
              : userRankInfo.percentile >= 75
              ? '🎯 Great job! You\'re performing above average!'
              : userRankInfo.percentile >= 50
              ? '💪 Keep going! You\'re in the top half!'
              : '📈 Keep practicing to improve your ranking!'}
          </p>
        </div>
      )}

      {!selectedRole && totalCandidates > 0 && (
        <div className="leaderboard-footer">
          <p>
            Showing top 10 of {totalCandidates} total candidates
          </p>
        </div>
      )}

      {/* Profile Panel */}
      {profilePanelUserId && (
        <UserProfilePanel
          userId={profilePanelUserId}
          currentUserId={userId}
          onClose={() => setProfilePanelUserId(null)}
        />
      )}
    </div>
  );
};

export default Leaderboard;
