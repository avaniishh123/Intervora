import React from 'react';
import SkeletonLoader from './SkeletonLoader';
import '../styles/SkeletonLoader.css';

const LeaderboardSkeleton: React.FC = () => {
  return (
    <div className="leaderboard-skeleton">
      {/* Header skeleton */}
      <div style={{ marginBottom: '24px' }}>
        <SkeletonLoader type="title" width="200px" />
        <SkeletonLoader type="text" width="300px" />
      </div>

      {/* Filter skeleton */}
      <div style={{ marginBottom: '20px' }}>
        <SkeletonLoader type="text" width="150px" height="40px" />
      </div>

      {/* Leaderboard items skeleton */}
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="skeleton-leaderboard-item">
          <SkeletonLoader type="text" width="40px" height="24px" />
          <SkeletonLoader type="avatar" width="48px" height="48px" />
          <div style={{ flex: 1 }}>
            <SkeletonLoader type="text" width="60%" height="18px" />
            <SkeletonLoader type="text" width="40%" height="14px" />
          </div>
          <SkeletonLoader type="text" width="60px" height="24px" />
        </div>
      ))}

      {/* User rank skeleton */}
      <div style={{ marginTop: '30px', padding: '20px', background: 'white', borderRadius: '12px' }}>
        <SkeletonLoader type="text" width="150px" height="20px" />
        <SkeletonLoader type="text" width="200px" height="24px" />
      </div>
    </div>
  );
};

export default LeaderboardSkeleton;
