import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import '../styles/UserManagement.css';

interface User {
  _id: string;
  email: string;
  role: 'candidate' | 'admin';
  profile: {
    name: string;
    totalSessions: number;
    averageScore: number;
  };
  createdAt: string;
}

interface Session {
  _id: string;
  jobRole: string;
  status: string;
  startTime: string;
  endTime?: string;
  performanceReport?: {
    overallScore: number;
  };
}

interface UserDetails {
  user: User;
  sessions: Session[];
}

interface Pagination {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

const UserManagementPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  // User details modal
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [searchQuery, roleFilter, sortBy, sortOrder, currentPage]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        page: currentPage,
        limit: 20,
        sortBy,
        sortOrder,
      };

      if (searchQuery) {
        params.search = searchQuery;
      }

      if (roleFilter) {
        params.role = roleFilter;
      }

      const response = await api.get('/api/admin/users', { params });
      setUsers(response.data.data.users);
      setPagination(response.data.data.pagination);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetails = async (userId: string) => {
    try {
      setLoadingDetails(true);
      const response = await api.get(`/api/admin/users/${userId}`);
      setSelectedUser(response.data.data);
      setShowModal(true);
    } catch (err: any) {
      console.error('Error fetching user details:', err);
      alert(err.response?.data?.message || 'Failed to load user details');
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset to first page on search
  };

  const handleRoleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRoleFilter(e.target.value);
    setCurrentPage(1);
  };

  const handleSortChange = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedUser(null);
  };

  const getSortIcon = (field: string) => {
    if (sortBy !== field) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="user-management-page">
      <div className="page-header">
        <h1>User Management</h1>
        <button onClick={() => navigate('/admin')} className="back-button">
          ← Back to Dashboard
        </button>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>

        <div className="filter-controls">
          <select
            value={roleFilter}
            onChange={handleRoleFilterChange}
            className="filter-select"
          >
            <option value="">All Roles</option>
            <option value="candidate">Candidate</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="content-section">
        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading users...</p>
          </div>
        ) : error ? (
          <div className="error-container">
            <p className="error-message">{error}</p>
            <button onClick={fetchUsers} className="retry-button">
              Retry
            </button>
          </div>
        ) : users.length === 0 ? (
          <p className="no-data">No users found</p>
        ) : (
          <>
            <div className="table-container">
              <table className="users-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSortChange('profile.name')} className="sortable">
                      Name {getSortIcon('profile.name')}
                    </th>
                    <th onClick={() => handleSortChange('email')} className="sortable">
                      Email {getSortIcon('email')}
                    </th>
                    <th onClick={() => handleSortChange('role')} className="sortable">
                      Role {getSortIcon('role')}
                    </th>
                    <th onClick={() => handleSortChange('profile.totalSessions')} className="sortable">
                      Sessions {getSortIcon('profile.totalSessions')}
                    </th>
                    <th onClick={() => handleSortChange('profile.averageScore')} className="sortable">
                      Avg Score {getSortIcon('profile.averageScore')}
                    </th>
                    <th onClick={() => handleSortChange('createdAt')} className="sortable">
                      Joined {getSortIcon('createdAt')}
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user._id}>
                      <td className="user-name">{user.profile.name}</td>
                      <td className="user-email">{user.email}</td>
                      <td>
                        <span className={`role-badge role-${user.role}`}>
                          {user.role}
                        </span>
                      </td>
                      <td>{user.profile.totalSessions}</td>
                      <td>
                        {user.profile.averageScore > 0
                          ? user.profile.averageScore.toFixed(1)
                          : 'N/A'}
                      </td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>
                        <button
                          onClick={() => fetchUserDetails(user._id)}
                          className="view-details-button"
                          disabled={loadingDetails}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={!pagination.hasPrevPage}
                  className="pagination-button"
                >
                  Previous
                </button>

                <span className="pagination-info">
                  Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalCount} total users)
                </span>

                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                  className="pagination-button"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* User Details Modal */}
      {showModal && selectedUser && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>User Details</h2>
              <button onClick={closeModal} className="close-button">
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="user-details-section">
                <h3>Profile Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Name:</span>
                    <span className="detail-value">{selectedUser.user.profile.name}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Email:</span>
                    <span className="detail-value">{selectedUser.user.email}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Role:</span>
                    <span className={`role-badge role-${selectedUser.user.role}`}>
                      {selectedUser.user.role}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Joined:</span>
                    <span className="detail-value">{formatDate(selectedUser.user.createdAt)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Total Sessions:</span>
                    <span className="detail-value">{selectedUser.user.profile.totalSessions}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Average Score:</span>
                    <span className="detail-value">
                      {selectedUser.user.profile.averageScore > 0
                        ? selectedUser.user.profile.averageScore.toFixed(1)
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="session-history-section">
                <h3>Session History</h3>
                {selectedUser.sessions.length === 0 ? (
                  <p className="no-data">No sessions found</p>
                ) : (
                  <div className="sessions-list">
                    {selectedUser.sessions.map((session) => (
                      <div key={session._id} className="session-card">
                        <div className="session-info">
                          <div className="session-role">{session.jobRole}</div>
                          <div className="session-date">{formatDate(session.startTime)}</div>
                        </div>
                        <div className="session-status">
                          <span className={`status-badge status-${session.status}`}>
                            {session.status}
                          </span>
                        </div>
                        <div className="session-score">
                          {session.performanceReport?.overallScore !== undefined
                            ? `Score: ${session.performanceReport.overallScore.toFixed(1)}`
                            : 'No score'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementPage;
