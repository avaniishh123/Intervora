import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import '../styles/Loading.css';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'candidate' | 'admin';
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  // While auth is being checked, show spinner.
  // Also treat as loading if a token exists but isAuthenticated hasn't resolved yet —
  // this prevents the race condition where the store hasn't hydrated before the
  // lazy-loaded route renders (e.g. navigating to /hybrid/setup from dashboard).
  const hasToken = !!localStorage.getItem('accessToken');
  if (isLoading || (!isAuthenticated && hasToken)) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: String(location.pathname || '/') }} replace />;
  }

  const userRole = typeof user?.role === 'string' ? user.role : '';
  if (requiredRole && userRole !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
