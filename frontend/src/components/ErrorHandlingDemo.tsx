import React, { useState } from 'react';
import { useToastContext } from '../contexts/ToastContext';
import LoadingSpinner from './LoadingSpinner';
import SkeletonLoader from './SkeletonLoader';
import DashboardSkeleton from './DashboardSkeleton';
import LeaderboardSkeleton from './LeaderboardSkeleton';

/**
 * Demo component to showcase error handling and loading state features
 * This component is for demonstration purposes only
 */
const ErrorHandlingDemo: React.FC = () => {
  const { success, error, warning, info } = useToastContext();
  const [showSpinner, setShowSpinner] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);

  const handleThrowError = () => {
    throw new Error('This is a test error to demonstrate ErrorBoundary');
  };

  const handleShowSpinner = () => {
    setShowSpinner(true);
    setTimeout(() => setShowSpinner(false), 3000);
  };

  const handleShowSkeleton = () => {
    setShowSkeleton(true);
    setTimeout(() => setShowSkeleton(false), 3000);
  };

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Error Handling & Loading States Demo</h1>
      
      <section style={{ marginBottom: '40px' }}>
        <h2>Toast Notifications</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => success('Operation completed successfully!')}>
            Show Success Toast
          </button>
          <button onClick={() => error('Something went wrong!')}>
            Show Error Toast
          </button>
          <button onClick={() => warning('This action cannot be undone')}>
            Show Warning Toast
          </button>
          <button onClick={() => info('New features available!')}>
            Show Info Toast
          </button>
        </div>
      </section>

      <section style={{ marginBottom: '40px' }}>
        <h2>Loading Spinners</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <button onClick={handleShowSpinner}>
            Show Loading Spinner
          </button>
        </div>
        {showSpinner && (
          <div>
            <h3>Small Spinner</h3>
            <LoadingSpinner size="small" message="Loading..." />
            
            <h3>Medium Spinner</h3>
            <LoadingSpinner size="medium" message="Processing..." />
            
            <h3>Large Spinner</h3>
            <LoadingSpinner size="large" message="Please wait..." />
          </div>
        )}
      </section>

      <section style={{ marginBottom: '40px' }}>
        <h2>Skeleton Loaders</h2>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <button onClick={handleShowSkeleton}>
            Show Skeleton Loaders
          </button>
        </div>
        {showSkeleton && (
          <div>
            <h3>Text Skeleton</h3>
            <SkeletonLoader type="text" count={3} />
            
            <h3>Card Skeleton</h3>
            <SkeletonLoader type="card" count={2} />
            
            <h3>Chart Skeleton</h3>
            <SkeletonLoader type="chart" />
            
            <h3>Dashboard Skeleton</h3>
            <DashboardSkeleton />
            
            <h3>Leaderboard Skeleton</h3>
            <LeaderboardSkeleton />
          </div>
        )}
      </section>

      <section style={{ marginBottom: '40px' }}>
        <h2>Error Boundary</h2>
        <p>Click the button below to throw an error and see the ErrorBoundary in action:</p>
        <button onClick={handleThrowError} style={{ background: '#f44336', color: 'white' }}>
          Throw Test Error
        </button>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
          Note: This will trigger the error boundary and show the error fallback UI
        </p>
      </section>

      <style>{`
        button {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          background: #667eea;
          color: white;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.2s;
        }
        
        button:hover {
          background: #5568d3;
          transform: translateY(-2px);
        }
        
        section {
          background: white;
          padding: 24px;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        h2 {
          margin-top: 0;
          color: #333;
        }
        
        h3 {
          margin-top: 20px;
          margin-bottom: 12px;
          color: #666;
          font-size: 16px;
        }
      `}</style>
    </div>
  );
};

export default ErrorHandlingDemo;
