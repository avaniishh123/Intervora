import React from 'react';
import '../styles/SkeletonLoader.css';

interface SkeletonLoaderProps {
  type?: 'text' | 'title' | 'card' | 'avatar' | 'chart' | 'table';
  count?: number;
  width?: string;
  height?: string;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ 
  type = 'text', 
  count = 1,
  width,
  height 
}) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'title':
        return <div className="skeleton skeleton-title" style={{ width, height }} />;
      
      case 'card':
        return (
          <div className="skeleton-card">
            <div className="skeleton skeleton-card-header" />
            <div className="skeleton skeleton-text" />
            <div className="skeleton skeleton-text" />
            <div className="skeleton skeleton-text" style={{ width: '60%' }} />
          </div>
        );
      
      case 'avatar':
        return <div className="skeleton skeleton-avatar" style={{ width, height }} />;
      
      case 'chart':
        return (
          <div className="skeleton-chart">
            <div className="skeleton skeleton-chart-bars">
              <div className="skeleton-bar" style={{ height: '60%' }} />
              <div className="skeleton-bar" style={{ height: '80%' }} />
              <div className="skeleton-bar" style={{ height: '40%' }} />
              <div className="skeleton-bar" style={{ height: '90%' }} />
              <div className="skeleton-bar" style={{ height: '70%' }} />
            </div>
          </div>
        );
      
      case 'table':
        return (
          <div className="skeleton-table">
            <div className="skeleton skeleton-table-header" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton skeleton-table-row" />
            ))}
          </div>
        );
      
      case 'text':
      default:
        return <div className="skeleton skeleton-text" style={{ width, height }} />;
    }
  };

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <React.Fragment key={index}>
          {renderSkeleton()}
        </React.Fragment>
      ))}
    </>
  );
};

export default SkeletonLoader;
