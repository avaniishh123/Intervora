import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { UserPublicProfile, getUserStatus } from '../types';
import '../styles/UserProfilePanel.css';

interface UserProfilePanelProps {
  userId: string;
  onClose: () => void;
  currentUserId?: string;
}

const STATUS_COLORS: Record<string, string> = {
  NOOB: '#6b7280',
  INTERMEDIATE: '#3b82f6',
  PRO: '#f59e0b',
};

const STATUS_LABELS: Record<string, string> = {
  NOOB: '🌱 NOOB',
  INTERMEDIATE: '⚡ INTERMEDIATE',
  PRO: '🔥 PRO',
};

const UserProfilePanel: React.FC<UserProfilePanelProps> = ({ userId, onClose, currentUserId }) => {
  const [profile, setProfile] = useState<UserPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/leaderboard/user/${userId}`);
        setProfile(res.data.data.profile);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId]);

  const formatJoinDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const status = profile ? getUserStatus(profile.totalSessions) : null;

  return (
    <div className="profile-panel-overlay" onClick={onClose}>
      <div className="profile-panel" onClick={(e) => e.stopPropagation()}>
        <button className="profile-panel-close" onClick={onClose} aria-label="Close">✕</button>

        {loading && (
          <div className="profile-panel-loading">
            <div className="profile-spinner" />
            <p>Loading profile...</p>
          </div>
        )}

        {error && <div className="profile-panel-error">{error}</div>}

        {profile && status && (
          <>
            <div className="profile-panel-avatar">
              {profile.profilePhoto
                ? <img src={profile.profilePhoto} alt={profile.name} className="profile-photo" />
                : <div className="profile-initials">{profile.name.charAt(0).toUpperCase()}</div>
              }
            </div>

            <div className="profile-panel-name">
              {profile.name}
              {userId === currentUserId && <span className="profile-you-badge">You</span>}
            </div>

            <div
              className="profile-status-badge"
              style={{ background: STATUS_COLORS[status] }}
            >
              {STATUS_LABELS[status]}
            </div>

            <div className="profile-panel-meta">
              <span>Joined {formatJoinDate(profile.joinedAt)}</span>
              {profile.jobRole && <span>Role: {profile.jobRole}</span>}
            </div>

            <div className="profile-panel-stats">
              <div className="profile-stat">
                <span className="profile-stat-value">{profile.totalSessions}</span>
                <span className="profile-stat-label">Sessions</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-value">{profile.averageScore.toFixed(1)}</span>
                <span className="profile-stat-label">Avg Score</span>
              </div>
              <div className="profile-stat">
                <span className="profile-stat-value">{profile.rank != null ? `#${profile.rank}` : '—'}</span>
                <span className="profile-stat-label">Rank</span>
              </div>
            </div>

            <div className="profile-status-progress">
              <div className="status-track">
                <div
                  className="status-track-fill"
                  style={{
                    width: status === 'PRO'
                      ? '100%'
                      : status === 'INTERMEDIATE'
                      ? `${((profile.totalSessions - 6) / 13) * 100}%`
                      : `${(profile.totalSessions / 6) * 100}%`,
                    background: STATUS_COLORS[status]
                  }}
                />
              </div>
              <p className="status-hint">
                {status === 'PRO'
                  ? 'Maximum level reached!'
                  : status === 'INTERMEDIATE'
                  ? `${19 - profile.totalSessions} more sessions to reach PRO`
                  : `${6 - profile.totalSessions} more sessions to reach INTERMEDIATE`}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UserProfilePanel;
