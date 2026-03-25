import React from 'react';
import SkeletonLoader from './SkeletonLoader';
import '../styles/SkeletonLoader.css';

const DashboardSkeleton: React.FC = () => {
  return (
    <div className="dashboard-skeleton">
      {/* Stats cards skeleton */}
      <div className="skeleton-stats-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-stat-card">
            <SkeletonLoader type="text" width="40%" height="20px" />
            <SkeletonLoader type="text" width="60%" height="36px" />
          </div>
        ))}
      </div>

      {/* Session history skeleton */}
      <div style={{ marginBottom: '30px' }}>
        <SkeletonLoader type="title" width="200px" />
        <SkeletonLoader type="card" count={3} />
      </div>

      {/* Performance chart skeleton */}
      <div>
        <SkeletonLoader type="title" width="250px" />
        <SkeletonLoader type="chart" />
      </div>
    </div>
  );
};

export default DashboardSkeleton;
