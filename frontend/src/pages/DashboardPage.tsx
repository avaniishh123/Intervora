import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import SessionHistory from '../components/SessionHistory';
import Leaderboard from '../components/Leaderboard';
import UserProfilePanel from '../components/UserProfilePanel';
import HybridFeatureSection from '../components/HybridFeatureSection';
import ContestHistory from '../components/ContestHistory';
import ContestDashboardLeaderboard from '../components/ContestDashboardLeaderboard';
import '../styles/Dashboard.css';
import { InterviewSession } from '../types';

const DashboardPage = () => {
  const { user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  // Shared role filter — drives both SessionHistory and Leaderboard
  const [selectedRole, setSelectedRole] = useState<string>('');
  // All sessions loaded by SessionHistory (used to derive role options)
  const [allSessions, setAllSessions] = useState<InterviewSession[]>([]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#48bb78';
    if (score >= 60) return '#ed8936';
    return '#f56565';
  };

  const getPerformanceLevel = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Improvement';
  };

  // Show loading state while auth is resolving
  if (isLoading) {
    return (
      <div className="dashboard-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Graceful fallback if user data is unavailable
  if (!user) {
    return (
      <div className="dashboard-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center' }}>
          <p>Session expired or unavailable.</p>
          <button onClick={() => navigate('/login')} className="start-interview-button" style={{ marginTop: '1rem' }}>
            Sign In Again
          </button>
        </div>
      </div>
    );
  }

  // Safe accessors with fallbacks
  const userName = user.profile?.name ?? 'there';
  const totalSessions = user.profile?.totalSessions ?? 0;
  const averageScore = user.profile?.averageScore ?? 0;

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Welcome, {userName}!</h1>
        <div className="dashboard-header-actions">
          <button onClick={() => setShowProfile(true)} className="profile-nav-button">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '6px' }}>
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Profile
          </button>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </div>

      {showProfile && (
        <UserProfilePanel
          userId={user.id}
          currentUserId={user.id}
          onClose={() => setShowProfile(false)}
        />
      )}

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#e6f7ff' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1890ff" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Total Sessions</div>
            <div className="stat-value">{totalSessions}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#fff7e6' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fa8c16" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Average Score</div>
            <div
              className="stat-value"
              style={{ color: getScoreColor(averageScore) }}
            >
              {averageScore.toFixed(1)}
            </div>
            <div className="stat-sublabel">
              {getPerformanceLevel(averageScore)}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#f6ffed' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#52c41a" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">Status</div>
            <div className="stat-value" style={{ fontSize: '18px', color: '#52c41a' }}>
              Active
            </div>
            <div className="stat-sublabel">Ready to interview</div>
          </div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="info-card quick-actions-card">
          <h2>Quick Actions</h2>
          <button
            onClick={() => navigate('/interview/setup')}
            className="start-interview-button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
              <circle cx="12" cy="12" r="10" />
              <polygon points="10 8 16 12 10 16 10 8" />
            </svg>
            Start New Interview
          </button>
          {totalSessions === 0 && (
            <p className="first-interview-hint">
              🎯 Start your first interview to begin tracking your progress!
            </p>
          )}
        </div>
      </div>

      {/* Hybrid Interview System — Advanced Modes */}
      <HybridFeatureSection />

      {totalSessions > 0 && (
        <div className="dashboard-history">
          <SessionHistory
            userId={user.id}
            selectedRole={selectedRole}
            onRoleChange={setSelectedRole}
            onSessionsLoaded={setAllSessions}
            allSessions={allSessions}
          />
        </div>
      )}

      {/* Leaderboard Section */}
      <div className="dashboard-leaderboard">
        <Leaderboard userId={user.id} selectedRole={selectedRole} onRoleChange={setSelectedRole} />
      </div>

      {/* Contest History Section */}
      <div className="dashboard-contest-history">
        <ContestHistory userId={user.id} />
      </div>

      {/* Contest Leaderboard Section */}
      <div className="dashboard-contest-leaderboard">
        <ContestDashboardLeaderboard userId={user.id} />
      </div>
    </div>
  );
};

export default DashboardPage;
