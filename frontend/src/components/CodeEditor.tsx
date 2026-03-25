import React, { useState } from 'react';
import Editor from '@monaco-editor/react';
import '../styles/CodeEditor.css';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  onLanguageChange: (language: string) => void;
  availableLanguages: string[];
  readOnly?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language,
  onLanguageChange,
  availableLanguages,
  readOnly = false,
}) => {
  const [theme, setTheme] = useState<'light' | 'vs-dark'>('vs-dark');

  const handleEditorChange = (value: string | undefined) => {
    onChange(value || '');
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'vs-dark' : 'light'));
  };

  const languageDisplayNames: Record<string, string> = {
    python: 'Python',
    javascript: 'JavaScript',
    java: 'Java',
    cpp: 'C++',
    typescript: 'TypeScript',
    csharp: 'C#',
  };

  return (
    <div className="code-editor-container">
      <div className="code-editor-toolbar">
        <div className="language-selector">
          <label htmlFor="language-select">Language:</label>
          <select
            id="language-select"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            disabled={readOnly}
          >
            {availableLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {languageDisplayNames[lang] || lang}
              </option>
            ))}
          </select>
        </div>
        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
      <div className="editor-wrapper">
        <Editor
          height="500px"
          language={language}
          value={value}
          onChange={handleEditorChange}
          theme={theme}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            readOnly: readOnly,
            contextmenu: true,
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            snippetSuggestions: 'inline',
          }}
          loading={<div className="editor-loading">Loading editor...</div>}
        />
      </div>
    </div>
  );
};

export default CodeEditor;
