import { useState, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import api from '../../services/api';

interface TestResult {
  description: string;
  input: string;
  expected: string;
  passed: boolean;
  error?: string;
  output?: string;
}

interface CodeSimulationProps {
  sessionId: string;
  task: {
    id: string;
    title: string;
    difficulty: string;
    description: string;
    problemStatement: string;
    starterCode: string;
    language: string;
    visibleTests: { input: string; expected: string; description: string }[];
    hints: string[];
    timeLimit: number;
  };
  onSubmit: (result: { score: number; feedback: string; strengths: string[]; weaknesses: string[] }) => void;
  onEvent: (type: string, data?: any) => void;
}

// Supported languages with Monaco language IDs and display labels
const SUPPORTED_LANGUAGES = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python',     label: 'Python 3'   },
  { id: 'java',       label: 'Java'        },
  { id: 'cpp',        label: 'C++'         },
  { id: 'c',          label: 'C'           },
  { id: 'csharp',     label: 'C#'          },
  { id: 'go',         label: 'Go'          },
];

// Starter code templates per language — wraps the core logic scaffold
const LANG_STARTERS: Record<string, string> = {
  javascript: '', // use task.starterCode as-is
  python: `# Write your solution here\ndef solution():\n    pass\n`,
  java: `public class Solution {\n    public static void main(String[] args) {\n        // Write your solution here\n    }\n}\n`,
  cpp: `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n`,
  c: `#include <stdio.h>\n\nint main() {\n    // Write your solution here\n    return 0;\n}\n`,
  csharp: `using System;\n\nclass Solution {\n    static void Main(string[] args) {\n        // Write your solution here\n    }\n}\n`,
  go: `package main\n\nimport "fmt"\n\nfunc main() {\n    // Write your solution here\n    fmt.Println("Hello")\n}\n`,
};

export default function CodeSimulation({ sessionId, task, onSubmit, onEvent }: CodeSimulationProps) {
  const defaultLang = SUPPORTED_LANGUAGES.find(l => l.id === task.language)?.id || 'javascript';
  const [selectedLang, setSelectedLang] = useState(defaultLang);
  // Per-language code buffers so switching doesn't lose work
  const [codeByLang, setCodeByLang] = useState<Record<string, string>>({
    [defaultLang]: task.starterCode,
  });
  const [isRunning,    setIsRunning]    = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResults,  setTestResults]  = useState<{ passed: number; total: number; details: TestResult[] } | null>(null);
  const [output,       setOutput]       = useState('');
  const [activeHint,   setActiveHint]   = useState<number | null>(null);
  const [submitted,    setSubmitted]    = useState(false);
  const runCountRef = useRef(0);

  const currentCode = codeByLang[selectedLang] ?? (LANG_STARTERS[selectedLang] || task.starterCode);

  const difficultyColor =
    task.difficulty === 'easy' ? '#10b981' :
    task.difficulty === 'medium' ? '#f59e0b' : '#ef4444';

  const handleLangChange = (lang: string) => {
    // Preserve current buffer, seed new lang with template if not yet visited
    setCodeByLang(prev => ({
      ...prev,
      [lang]: prev[lang] ?? (LANG_STARTERS[lang] || task.starterCode),
    }));
    setSelectedLang(lang);
    setTestResults(null);
    setOutput('');
    onEvent('language_change', { taskId: task.id, language: lang });
  };

  const handleRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setOutput('Running...');
    setTestResults(null);
    runCountRef.current++;
    onEvent('code_run', { taskId: task.id, runCount: runCountRef.current, language: selectedLang });

    try {
      const res = await api.post(`/api/simulation/${sessionId}/run-code`, {
        code: currentCode, language: selectedLang, taskId: task.id,
      });
      const data = res.data.data;
      setTestResults(data.testResults);
      setOutput(data.output || '');
    } catch (err: any) {
      setOutput('Error: ' + (err.response?.data?.message || err.message));
      onEvent('error_encountered', { taskId: task.id });
    } finally {
      setIsRunning(false);
    }
  }, [currentCode, isRunning, sessionId, task.id, selectedLang, onEvent]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting || submitted) return;
    setIsSubmitting(true);
    try {
      const res = await api.post(`/api/simulation/${sessionId}/submit`, {
        taskId: task.id, content: currentCode, language: selectedLang, testResults,
      });
      const data = res.data.data;
      setSubmitted(true);
      onSubmit({ score: data.score, feedback: data.feedback, strengths: data.strengths || [], weaknesses: data.weaknesses || [] });
    } catch (err: any) {
      setOutput('Submit error: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  }, [currentCode, isSubmitting, submitted, sessionId, task.id, selectedLang, testResults, onSubmit]);

  return (
    <div className="sim-code-container">
      {/* ── Left: Problem description ── */}
      <div className="sim-code-problem">
        <div className="sim-task-header">
          <h3>{task.title}</h3>
          <span className="sim-difficulty-badge" style={{ background: difficultyColor }}>{task.difficulty}</span>
        </div>

        <p className="sim-problem-statement">{task.problemStatement}</p>

        {/* Example test cases */}
        <div className="sim-tests-section">
          <h4>Example Test Cases</h4>
          {task.visibleTests.map((t, i) => (
            <div key={i} className="sim-test-case">
              <div className="sim-test-label">Test {i + 1}: {t.description}</div>
              <div className="sim-test-io">
                <span className="sim-test-input">Input: <code>{t.input}</code></span>
                <span className="sim-test-expected">Expected: <code>{t.expected}</code></span>
              </div>
            </div>
          ))}
        </div>

        {/* Hints */}
        {task.hints.length > 0 && (
          <div className="sim-hints-section">
            <h4>Hints</h4>
            {task.hints.map((hint, i) => (
              <div key={i} className="sim-hint-item">
                <button
                  className="sim-hint-toggle"
                  onClick={() => setActiveHint(activeHint === i ? null : i)}
                >
                  {activeHint === i ? '▼' : '▶'} Hint {i + 1}
                </button>
                {activeHint === i && <p className="sim-hint-text">{hint}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Right: Code editor ── */}
      <div className="sim-code-editor-panel">
        <div className="sim-editor-toolbar">
          {/* Language selector */}
          <select
            className="sim-lang-select"
            value={selectedLang}
            onChange={e => handleLangChange(e.target.value)}
            disabled={submitted}
            aria-label="Select programming language"
          >
            {SUPPORTED_LANGUAGES.map(l => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>

          <div className="sim-editor-actions">
            {/* Always-visible Recompile/Run button */}
            <button
              className="sim-btn sim-btn-run"
              onClick={handleRun}
              disabled={isRunning}
              title="Run code against test cases"
            >
              {isRunning ? '⏳ Running...' : '▶ Run'}
            </button>
            <button
              className="sim-btn sim-btn-submit"
              onClick={handleSubmit}
              disabled={isSubmitting || submitted}
            >
              {isSubmitting ? '⏳ Submitting...' : submitted ? '✅ Submitted' : '📤 Submit'}
            </button>
          </div>
        </div>

        <Editor
          height="100%"
          language={selectedLang}
          value={currentCode}
          onChange={(val) => {
            const v = val || '';
            setCodeByLang(prev => ({ ...prev, [selectedLang]: v }));
            onEvent('answer_change', { taskId: task.id });
          }}
          theme="vs-dark"
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            readOnly: submitted,
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            fontFamily: "'Fira Code', 'Cascadia Code', monospace",
            fontLigatures: true,
          }}
        />
      </div>

      {/* ── Bottom: Output / test results ── */}
      <div className="sim-output-panel">
        {testResults ? (
          <div className="sim-test-results">
            <div className={`sim-test-summary ${testResults.passed === testResults.total ? 'all-pass' : 'some-fail'}`}>
              {testResults.passed === testResults.total ? '✅' : '⚠️'} {testResults.passed}/{testResults.total} tests passed
            </div>
            {testResults.details.map((r, i) => (
              <div key={i} className={`sim-test-result-row ${r.passed ? 'pass' : 'fail'}`}>
                <span>{r.passed ? '✅' : '❌'} {r.description}</span>
                {!r.passed && r.error && <span className="sim-test-error">{r.error}</span>}
              </div>
            ))}
          </div>
        ) : output ? (
          <pre className="sim-output-text">{output}</pre>
        ) : (
          <span style={{ color: '#475569', fontSize: '0.8rem' }}>Run your code to see output here</span>
        )}
      </div>
    </div>
  );
}
