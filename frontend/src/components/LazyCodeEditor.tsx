import React, { lazy, Suspense } from 'react';
import LoadingSpinner from './LoadingSpinner';

// Lazy load the Monaco Editor component
const CodeEditor = lazy(() => import('./CodeEditor'));

interface LazyCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  onLanguageChange: (language: string) => void;
  availableLanguages: string[];
  readOnly?: boolean;
}

const LazyCodeEditor: React.FC<LazyCodeEditorProps> = (props) => {
  return (
    <Suspense 
      fallback={
        <div style={{ 
          height: '500px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: '#1e1e1e',
          borderRadius: '8px'
        }}>
          <LoadingSpinner />
        </div>
      }
    >
      <CodeEditor {...props} />
    </Suspense>
  );
};

export default LazyCodeEditor;
