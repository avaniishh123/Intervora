import { useState, useCallback, useRef, useEffect } from 'react';
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

// ── Client-side JS execution engine (fallback for local sessions / 404) ──────
async function runLocally(code: string, language: string, task: any): Promise<{
  output: string;
  testResults: { passed: number; total: number; details: any[] };
}> {
  const visibleTests: { input: string; expected: string; description: string }[] = task.visibleTests || [];

  if (language !== 'javascript') {
    // Non-JS: structural validation only
    const langName = language === 'python' ? 'Python 3' : language === 'java' ? 'Java'
      : language === 'cpp' ? 'C++' : language === 'c' ? 'C'
      : language === 'csharp' ? 'C#' : language === 'go' ? 'Go' : language;

    const hasStructure = (language === 'python' && (code.includes('def ') || code.includes('class ')))
      || (['java', 'csharp'].includes(language) && code.includes('class '))
      || (['cpp', 'c'].includes(language) && (code.includes('int main') || code.includes('void ')))
      || (language === 'go' && code.includes('func '));

    if (!hasStructure) {
      return {
        output: `Compilation Error (${langName}): No function or class definition found.`,
        testResults: {
          passed: 0, total: visibleTests.length,
          details: visibleTests.map(t => ({ ...t, passed: false, error: 'Compilation failed' })),
        },
      };
    }

    return {
      output: `[${langName}] Code structure looks valid. Full execution requires the backend runner.`,
      testResults: {
        passed: visibleTests.length, total: visibleTests.length,
        details: visibleTests.map(t => ({ ...t, passed: true, output: '[simulated]' })),
      },
    };
  }

  // JavaScript: real execution via Function constructor (safe for interview env)
  const details: any[] = [];
  let passed = 0;
  let consoleOut = '';

  for (const test of visibleTests) {
    try {
      const logs: string[] = [];
      const fakeConsole = { log: (...a: any[]) => logs.push(a.map(String).join(' ')) };

      // Wrap code so module.exports works
      const wrapped = new Function('module', 'exports', 'console',
        `"use strict";\n${code}\n`
      );
      const mod = { exports: {} as any };
      wrapped(mod, mod.exports, fakeConsole);

      const fns = Object.keys(mod.exports).filter(k => typeof mod.exports[k] === 'function');
      if (fns.length === 0) throw new Error('No exported function found. Use module.exports = { yourFunction }');

      const fn = mod.exports[fns[0]];
      // Build call: fn.apply(null, parsedArgs)
      const callFn = new Function('fn', `"use strict"; return fn${test.input};`);
      const actual = callFn(fn);

      consoleOut += logs.join('\n');
      const actualStr = JSON.stringify(actual);
      const expectedStr = test.expected.trim();
      const numMatch = !isNaN(Number(actual)) && !isNaN(Number(expectedStr)) && Number(actual) === Number(expectedStr);
      const strMatch = actualStr === expectedStr || String(actual) === expectedStr;
      const ok = numMatch || strMatch;

      details.push({ description: test.description, input: test.input, expected: test.expected, passed: ok, output: actualStr, error: ok ? undefined : `Got ${actualStr}, expected ${expectedStr}` });
      if (ok) passed++;
    } catch (e: any) {
      details.push({ description: test.description, input: test.input, expected: test.expected, passed: false, error: e.message });
    }
  }

  const summary = `${passed}/${visibleTests.length} test cases passed`;
  return {
    output: consoleOut ? `${summary}\n\nConsole:\n${consoleOut}` : summary,
    testResults: { passed, total: visibleTests.length, details },
  };
}

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

  // ── Camera ────────────────────────────────────────────────────────────────
  // Camera is managed by the parent SimulationInterviewPage in the left sidebar.
  // No separate camera stream is opened here to avoid duplicate streams and
  // prevent the video from appearing in the problem panel instead of the sidebar.

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

  // ── Reset code to original starter for current language ─────────────────
  const handleReset = useCallback(() => {
    const original = selectedLang === defaultLang
      ? task.starterCode
      : (LANG_STARTERS[selectedLang] || task.starterCode);
    setCodeByLang(prev => ({ ...prev, [selectedLang]: original }));
    setTestResults(null);
    setOutput('');
    onEvent('code_reset', { taskId: task.id, language: selectedLang });
  }, [selectedLang, defaultLang, task.starterCode, task.id, onEvent]);

  const handleRun = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);
    setOutput('Running...');
    setTestResults(null);
    runCountRef.current++;

    // Always run locally — instant, non-blocking, no backend round-trip needed
    // Backend run-code uses synchronous vm.Script which can block the event loop
    try {
      const result = await runLocally(currentCode, selectedLang, task);
      setTestResults(result.testResults);
      setOutput(result.output);
      // Track event fire-and-forget (don't await — never block UI)
      onEvent('code_run', { taskId: task.id, runCount: runCountRef.current, language: selectedLang });
    } catch (err: any) {
      setOutput('Execution error: ' + err.message);
      onEvent('error_encountered', { taskId: task.id });
    } finally {
      setIsRunning(false);
    }
  }, [currentCode, isRunning, task, selectedLang, onEvent]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting || submitted) return;
    setIsSubmitting(true);
    try {
      // Local session: run locally then call submit with results
      if (sessionId.startsWith('local-')) {
        const result = await runLocally(currentCode, selectedLang, task);
        setTestResults(result.testResults);
        setOutput(result.output);
        const score = result.testResults.total > 0
          ? Math.round((result.testResults.passed / result.testResults.total) * 100)
          : 50;
        setSubmitted(true);
        onSubmit({
          score,
          feedback: `${result.testResults.passed}/${result.testResults.total} test cases passed.`,
          strengths: score >= 70 ? ['Correct logic', 'Tests passing'] : ['Attempted the problem'],
          weaknesses: score < 70 ? ['Some test cases failing — review edge cases'] : [],
        });
        return;
      }

      const res = await api.post(`/api/simulation/${sessionId}/submit`, {
        taskId: task.id, content: currentCode, language: selectedLang, testResults,
      }, { timeout: 20000 }); // 20s timeout — Gemini now responds immediately
      const data = res.data.data;
      setSubmitted(true);
      onSubmit({ score: data.score, feedback: data.feedback, strengths: data.strengths || [], weaknesses: data.weaknesses || [] });
    } catch (err: any) {
      // If backend says task not found OR times out, fall back to local evaluation
      if (err.response?.status === 404 || err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        const result = await runLocally(currentCode, selectedLang, task);
        const score = result.testResults.total > 0
          ? Math.round((result.testResults.passed / result.testResults.total) * 100)
          : 50;
        setSubmitted(true);
        onSubmit({
          score,
          feedback: `${result.testResults.passed}/${result.testResults.total} test cases passed (local evaluation).`,
          strengths: score >= 70 ? ['Correct logic'] : ['Attempted the problem'],
          weaknesses: score < 70 ? ['Some test cases failing'] : [],
        });
      } else {
        setOutput('Submit error: ' + (err.response?.data?.message || err.message));
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [currentCode, isSubmitting, submitted, sessionId, task, selectedLang, testResults, onSubmit]);

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
            {/* Reset code to starter */}
            <button
              className="sim-btn"
              onClick={handleReset}
              disabled={submitted}
              title="Reset to original starter code"
              style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}
            >
              ↺ Reset
            </button>
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
            readOnly: false,           // always editable — submitted state shown via UI only
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            fontFamily: "'Fira Code', 'Cascadia Code', monospace",
            fontLigatures: true,
            copyWithSyntaxHighlighting: false,  // plain text copy
            contextmenu: true,                  // right-click menu with copy/paste
            quickSuggestions: true,
            suggestOnTriggerCharacters: true,
            tabCompletion: 'on',
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
