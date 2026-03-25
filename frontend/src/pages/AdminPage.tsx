import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
} from 'chart.js';
import '../styles/AdminPage.css';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale);

interface AnalyticsData {
  totalUsers: number;
  activeSessions: number;
  completedSessions: number;
  averagePlatformScore: number;
  roleDistribution: Record<string, number>;
}

interface RecentSession {
  _id: string;
  userId: {
    _id: string;
    email: string;
    profile: {
      name: string;
    };
  };
  jobRole: string;
  status: string;
  startTime: string;
  endTime?: string;
  performanceReport?: {
    overallScore: number;
  };
}

interface DashboardData {
  statistics: AnalyticsData;
  recentSessions: RecentSession[];
}

const AdminPage = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/admin/dashboard');
      setDashboardData(response.data.data);
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'status-badge status-completed';
      case 'in-progress':
        return 'status-badge status-in-progress';
      case 'abandoned':
        return 'status-badge status-abandoned';
      default:
        return 'status-badge';
    }
  };

  // Prepare pie chart data
  const getPieChartData = () => {
    if (!dashboardData?.statistics.roleDistribution) {
      return null;
    }

    const roles = Object.keys(dashboardData.statistics.roleDistribution);
    const counts = Object.values(dashboardData.statistics.roleDistribution);

    return {
      labels: roles,
      datasets: [
        {
          label: 'Sessions by Role',
          data: counts,
          backgroundColor: [
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 99, 132, 0.8)',
            'rgba(255, 206, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(153, 102, 255, 0.8)',
            'rgba(255, 159, 64, 0.8)',
          ],
          borderColor: [
            'rgba(54, 162, 235, 1)',
            'rgba(255, 99, 132, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
          ],
          borderWidth: 2,
        },
      ],
    };
  };

  const pieChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <div className="error-container">
          <p className="error-message">{error}</p>
          <button onClick={fetchDashboardData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return null;
  }

  const { statistics, recentSessions } = dashboardData;
  const pieChartData = getPieChartData();

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <div className="admin-nav">
          <button onClick={() => navigate('/admin/users')} className="nav-button">
            User Management
          </button>
          <button onClick={() => navigate('/admin/sessions')} className="nav-button">
            Session Analytics
          </button>
          <button onClick={() => navigate('/dashboard')} className="nav-button secondary">
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>Total Users</h3>
            <p className="stat-value">{statistics.totalUsers}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <h3>Active Sessions</h3>
            <p className="stat-value">{statistics.activeSessions}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>Completed Sessions</h3>
            <p className="stat-value">{statistics.completedSessions}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>Average Score</h3>
            <p className="stat-value">{statistics.averagePlatformScore.toFixed(1)}</p>
          </div>
        </div>
      </div>

      {/* Role Distribution Chart */}
      {pieChartData && (
        <div className="chart-section">
          <h2>Role Distribution</h2>
          <div className="chart-container">
            <Pie data={pieChartData} options={pieChartOptions} />
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div className="recent-sessions-section">
        <h2>Recent Sessions</h2>
        {recentSessions.length === 0 ? (
          <p className="no-data">No sessions found</p>
        ) : (
          <div className="sessions-table-container">
            <table className="sessions-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Job Role</th>
                  <th>Status</th>
                  <th>Start Time</th>
                  <th>Score</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((session) => (
                  <tr key={session._id}>
                    <td>
                      <div className="user-info">
                        <div className="user-name">{session.userId.profile.name}</div>
                        <div className="user-email">{session.userId.email}</div>
                      </div>
                    </td>
                    <td>{session.jobRole}</td>
                    <td>
                      <span className={getStatusBadgeClass(session.status)}>
                        {session.status}
                      </span>
                    </td>
                    <td>{formatDate(session.startTime)}</td>
                    <td>
                      {session.performanceReport?.overallScore !== undefined
                        ? session.performanceReport.overallScore.toFixed(1)
                        : 'N/A'}
                    </td>
                    <td>
                      <button
                        onClick={() => navigate(`/admin/sessions/${session._id}`)}
                        className="view-button"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
