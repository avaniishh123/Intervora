import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import '../styles/PanelReportPage.css';

// ── Types (mirrored from PanelInterviewPage) ──────────────────────────────────
interface AnswerMetric {
  questionIndex:  number;
  technical:      number;
  communication:  number;
  confidence:     number;
  problemSolving: number;
  hrResponse:     number;
  brief:          string;
}

interface SectionScore { label: string; score: number; color: string; icon: string; }
interface PanelMemberFeedback { name: string; color: string; avatar: string; feedback: string; }
interface QASummaryItem { q: string; a: string; score: number; note: string; }

interface PanelReport {
  overallScore:       number;
  grade:              string;
  sectionScores:      SectionScore[];
  strengths:          string[];
  improvements:       string[];
  panelFeedback:      PanelMemberFeedback[];
  timeUtilization:    string;
  answerDepth:        string;
  keywordRelevance:   string;
  consistency:        string;
  recommendations:    string[];
  perQuestionSummary: QASummaryItem[];
  aiJudgeOpinion:     string;
}

// ── State passed via navigate() ───────────────────────────────────────────────
interface LocationState {
  role:         string;
  sessionId:    string;
  duration:     number;
  metrics:      AnswerMetric[];
  qaHistory:    { question: string; answer: string; panelId: string }[];
  answeredTime: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function computeOverall(metrics: AnswerMetric[]): number {
  if (!metrics.length) return 50;
  const avg = metrics.reduce(
    (s, m) => s + (m.technical + m.communication + m.confidence + m.problemSolving + m.hrResponse) / 5, 0
  ) / metrics.length;
  return Math.round(avg * 10);
}

function toGrade(score: number): string {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

function buildSections(metrics: AnswerMetric[]): SectionScore[] {
  if (!metrics.length) return [];
  const avg = (key: keyof Omit<AnswerMetric, 'questionIndex' | 'brief'>) =>
    Math.round(metrics.reduce((s, m) => s + m[key], 0) / metrics.length * 10) / 10;
  return [
    { label: 'Technical Knowledge', score: avg('technical'),      color: '#3b82f6', icon: '⚙' },
    { label: 'Communication',        score: avg('communication'),  color: '#8b5cf6', icon: '💬' },
    { label: 'Confidence',           score: avg('confidence'),     color: '#10b981', icon: '✦' },
    { label: 'Problem Solving',      score: avg('problemSolving'), color: '#f59e0b', icon: '🧩' },
    { label: 'HR & Behavioral',      score: avg('hrResponse'),     color: '#ec4899', icon: '🤝' },
  ];
}

function buildPanelFeedback(metrics: AnswerMetric[]): PanelMemberFeedback[] {
  const techAvg = metrics.length ? Math.round(metrics.reduce((s, m) => s + m.technical,      0) / metrics.length * 10) / 10 : 6;
  const commAvg = metrics.length ? Math.round(metrics.reduce((s, m) => s + m.communication,  0) / metrics.length * 10) / 10 : 6;
  const hrAvg   = metrics.length ? Math.round(metrics.reduce((s, m) => s + m.hrResponse,     0) / metrics.length * 10) / 10 : 6;
  return [
    {
      name: 'Alex Chen', color: '#3b82f6', avatar: 'TL',
      feedback: techAvg >= 7
        ? 'Strong technical foundation. You demonstrated solid understanding of core concepts. Consider diving deeper into system design trade-offs.'
        : 'Good effort on technical questions. Focus on strengthening your system design knowledge and providing more concrete implementation details.',
    },
    {
      name: 'Sarah Mitchell', color: '#8b5cf6', avatar: 'HM',
      feedback: commAvg >= 7
        ? 'Excellent communication skills. Your answers were well-structured and clearly articulated. You showed strong alignment with professional expectations.'
        : 'Work on structuring your answers more clearly. Use the STAR method for behavioral questions and quantify your achievements where possible.',
    },
    {
      name: 'James Park', color: '#10b981', avatar: 'HR',
      feedback: hrAvg >= 7
        ? 'Great cultural fit indicators. You showed self-awareness and professional maturity in your responses.'
        : 'Focus on demonstrating cultural fit and self-awareness. Be more specific about your motivations and how you handle workplace challenges.',
    },
  ];
}

function buildTimeUtil(answeredTime: number, totalTime: number): string {
  const pct = Math.round((answeredTime / totalTime) * 100);
  if (pct >= 80) return 'Excellent — used ' + pct + '% of allocated time effectively';
  if (pct >= 50) return 'Good — used ' + pct + '% of allocated time';
  return 'Low — only used ' + pct + '% of allocated time. Try to elaborate more.';
}

function buildDepth(qa: { question: string; answer: string }[]): string {
  if (!qa.length) return 'No answers recorded';
  const avgLen = Math.round(qa.reduce((s, q) => s + q.answer.length, 0) / qa.length);
  if (avgLen > 300) return 'Deep — average answer length ' + avgLen + ' chars. Good elaboration.';
  if (avgLen > 120) return 'Moderate — average answer length ' + avgLen + ' chars. Consider more detail.';
  return 'Shallow — average answer length ' + avgLen + ' chars. Elaborate more on each point.';
}

function buildQASummary(
  qa: { question: string; answer: string }[],
  metrics: AnswerMetric[]
): QASummaryItem[] {
  return qa.map((item, i) => {
    const m = metrics[i];
    const score = m
      ? Math.round((m.technical + m.communication + m.confidence + m.problemSolving + m.hrResponse) / 5 * 10) / 10
      : 5;
    return {
      q:     item.question,
      a:     item.answer.length > 140 ? item.answer.slice(0, 140) + '…' : item.answer,
      score,
      note:  m?.brief ?? 'Answer recorded.',
    };
  });
}

function scoreColor(score: number): string {
  if (score >= 75) return '#10b981';
  if (score >= 55) return '#f59e0b';
  return '#ef4444';
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PanelReportPage() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const state     = location.state as LocationState | null;

  const [report,   setReport]   = useState<PanelReport | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const generateReport = useCallback(async (
    role: string,
    duration: number,
    metrics: AnswerMetric[],
    qaHistory: { question: string; answer: string; panelId: string }[],
    answeredTime: number,
  ) => {
    const totalTime = duration * 60;
    try {
      const res = await api.post('/api/gemini/interview-report', {
        role, mode: 'panel', qaHistory, metrics, duration, answeredTime,
      });
      const d = res.data?.data ?? {};
      setReport({
        overallScore:       Number(d.overallScore ?? computeOverall(metrics)),
        grade:              String(d.grade ?? toGrade(computeOverall(metrics))),
        sectionScores:      Array.isArray(d.sectionScores)      ? d.sectionScores      : buildSections(metrics),
        strengths:          Array.isArray(d.strengths)          ? d.strengths          : ['Demonstrated relevant knowledge', 'Maintained professional tone'],
        improvements:       Array.isArray(d.improvements)       ? d.improvements       : ['Add more specific examples', 'Quantify your impact'],
        panelFeedback:      Array.isArray(d.panelFeedback)      ? d.panelFeedback      : buildPanelFeedback(metrics),
        timeUtilization:    String(d.timeUtilization   ?? buildTimeUtil(answeredTime, totalTime)),
        answerDepth:        String(d.answerDepth        ?? buildDepth(qaHistory)),
        keywordRelevance:   String(d.keywordRelevance   ?? 'Moderate — include more domain-specific terminology'),
        consistency:        String(d.consistency        ?? 'Good — responses were coherent across panel members'),
        recommendations:    Array.isArray(d.recommendations)    ? d.recommendations    : ['Use the STAR method', 'Quantify achievements', 'Research the company'],
        perQuestionSummary: Array.isArray(d.perQuestionSummary) ? d.perQuestionSummary : buildQASummary(qaHistory, metrics),
        aiJudgeOpinion:     String(d.aiJudgeOpinion ?? d.summary ?? 'Overall a solid performance. Focus on concrete examples and measurable outcomes.'),
      });
    } catch {
      // Full fallback — never show an error to the user
      setReport({
        overallScore:       computeOverall(metrics),
        grade:              toGrade(computeOverall(metrics)),
        sectionScores:      buildSections(metrics),
        strengths:          ['Demonstrated relevant knowledge', 'Maintained professional tone', 'Answered all panel questions'],
        improvements:       ['Provide more specific examples', 'Quantify your impact', 'Structure answers using STAR method'],
        panelFeedback:      buildPanelFeedback(metrics),
        timeUtilization:    buildTimeUtil(answeredTime, totalTime),
        answerDepth:        buildDepth(qaHistory),
        keywordRelevance:   'Moderate — include more domain-specific terminology in your answers',
        consistency:        'Good — responses were coherent and consistent across panel members',
        recommendations:    ['Use the STAR method for behavioral questions', 'Quantify achievements with numbers', 'Research the company before interviews', 'Practice concise, structured answers'],
        perQuestionSummary: buildQASummary(qaHistory, metrics),
        aiJudgeOpinion:     'You completed the panel interview and showed foundational knowledge. To improve, focus on concrete examples, measurable outcomes, and structured responses that address each panel member\'s perspective.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!state) {
      setError('No interview data found. Please complete a panel interview first.');
      setLoading(false);
      return;
    }
    const { role, duration, metrics, qaHistory, answeredTime } = state;
    generateReport(role, duration, metrics ?? [], qaHistory ?? [], answeredTime ?? 0);
  }, [state, generateReport]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="prp-loading">
        <div className="prp-spinner" />
        <p>Generating your panel interview report…</p>
      </div>
    );
  }

  // ── Error ──
  if (error || !report) {
    return (
      <div className="prp-error">
        <div className="prp-error-icon">📋</div>
        <h2>Report Unavailable</h2>
        <p>{error ?? 'Could not generate report. Please try again.'}</p>
        <button className="prp-btn prp-btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const role      = state?.role ?? 'Software Engineer';
  const ringColor = scoreColor(report.overallScore);
  const circumference = 2 * Math.PI * 54; // r=54

  return (
    <div className="prp-root">
      {/* Navbar */}
      <nav className="prp-navbar">
        <div className="prp-navbar-brand">
          <span>AI</span> Interview Maker &nbsp;/&nbsp; Panel Report
        </div>
        <div className="prp-navbar-actions">
          <button className="prp-btn prp-btn-ghost" onClick={() => navigate('/dashboard')}>
            ← Dashboard
          </button>
          <button className="prp-btn prp-btn-success" onClick={() => navigate('/interview/setup')}>
            New Interview
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div className="prp-hero">
        <div className="prp-hero-badge">✦ Interview Complete</div>
        <h1>Panel Interview Report</h1>
        <p className="prp-hero-sub">Mock Panel Interview &nbsp;·&nbsp; {role}</p>
      </div>

      {/* Score Hero Card */}
      <div className="prp-score-card">
        <div className="prp-score-inner">
          <div className="prp-ring-wrap">
            <svg viewBox="0 0 120 120" width="120" height="120">
              <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="54"
                fill="none"
                stroke={ringColor}
                strokeWidth="8"
                strokeDasharray={`${(report.overallScore / 100) * circumference} ${circumference}`}
                strokeLinecap="round"
                transform="rotate(-90 60 60)"
                style={{ transition: 'stroke-dasharray 1.2s ease' }}
              />
            </svg>
            <div className="prp-ring-inner">
              <span className="prp-ring-num" style={{ color: ringColor }}>{report.overallScore}</span>
              <span className="prp-ring-grade">{report.grade}</span>
            </div>
          </div>
          <div className="prp-score-meta">
            <h2>Overall Performance</h2>
            <p>Evaluated across 5 dimensions by 3 panel members</p>
            <div className="prp-score-tags">
              <span className="prp-tag prp-tag-blue">Technical Lead</span>
              <span className="prp-tag prp-tag-purple">Hiring Manager</span>
              <span className="prp-tag prp-tag-green">HR Specialist</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="prp-grid">

        {/* Section Scores */}
        <div className="prp-card prp-grid-full">
          <div className="prp-card-title">Performance Breakdown</div>
          {report.sectionScores.map(s => (
            <div key={s.label} className="prp-section-bar">
              <div className="prp-section-top">
                <span>{s.icon} &nbsp;{s.label}</span>
                <span style={{ color: s.color, fontWeight: 700 }}>{s.score}/10</span>
              </div>
              <div className="prp-bar-bg">
                <div className="prp-bar-fill" style={{ width: `${(s.score / 10) * 100}%`, background: s.color }} />
              </div>
            </div>
          ))}
        </div>

        {/* Strengths */}
        <div className="prp-card">
          <div className="prp-card-title">Strengths</div>
          <ul className="prp-list prp-list-green">
            {report.strengths.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>

        {/* Areas to Improve */}
        <div className="prp-card">
          <div className="prp-card-title">Areas to Improve</div>
          <ul className="prp-list prp-list-amber">
            {report.improvements.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>

        {/* Panel Member Feedback */}
        <div className="prp-card prp-grid-full">
          <div className="prp-card-title">Panel Member Feedback</div>
          <div className="prp-feedback-grid">
            {report.panelFeedback.map((pf, i) => (
              <div key={i} className="prp-feedback-card" style={{ borderLeftColor: pf.color }}>
                <div className="prp-feedback-who">
                  <div
                    className="prp-feedback-avatar"
                    style={{ background: pf.color + '22', color: pf.color }}
                  >
                    {pf.avatar}
                  </div>
                  <div>
                    <div className="prp-feedback-name" style={{ color: pf.color }}>{pf.name}</div>
                    <div className="prp-feedback-role">
                      {pf.avatar === 'TL' ? 'Technical Lead' : pf.avatar === 'HM' ? 'Hiring Manager' : 'HR Specialist'}
                    </div>
                  </div>
                </div>
                <p className="prp-feedback-text">{pf.feedback}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Advanced Insights */}
        <div className="prp-card prp-grid-full">
          <div className="prp-card-title">Advanced Insights</div>
          <div className="prp-insights-grid">
            {[
              { label: 'Time Utilization', val: report.timeUtilization,  icon: '⏱' },
              { label: 'Answer Depth',     val: report.answerDepth,       icon: '📊' },
              { label: 'Keyword Relevance',val: report.keywordRelevance,  icon: '🔑' },
              { label: 'Consistency',      val: report.consistency,       icon: '🔄' },
            ].map(ins => (
              <div key={ins.label} className="prp-insight-card">
                <div className="prp-insight-icon">{ins.icon}</div>
                <div className="prp-insight-label">{ins.label}</div>
                <div className="prp-insight-val">{ins.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Judge Opinion */}
        <div className="prp-card prp-grid-full">
          <div className="prp-card-title">AI Judge Opinion</div>
          <p className="prp-judge-text">"{report.aiJudgeOpinion}"</p>
        </div>

        {/* Recommendations */}
        <div className="prp-card prp-grid-full">
          <div className="prp-card-title">Recommendations</div>
          <ul className="prp-list prp-list-blue" style={{ '--list-color': '#3b82f6' } as React.CSSProperties}>
            {report.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>

        {/* Per-Question Breakdown */}
        {report.perQuestionSummary.length > 0 && (
          <div className="prp-card prp-grid-full">
            <div className="prp-card-title">Per-Question Breakdown</div>
            {report.perQuestionSummary.map((item, i) => (
              <div key={i} className="prp-qa-item">
                <div className="prp-qa-q">Q{i + 1}: {item.q}</div>
                <div className="prp-qa-a">{item.a}</div>
                <div className="prp-qa-meta">
                  <span className="prp-qa-score" style={{ color: scoreColor(item.score * 10) }}>
                    Score: {item.score}/10
                  </span>
                  <span className="prp-qa-note">{item.note}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="prp-actions">
        <button className="prp-btn prp-btn-ghost" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
        <button className="prp-btn prp-btn-primary" onClick={() => navigate('/interview/setup')}>
          New Interview
        </button>
        <button className="prp-btn prp-btn-success" onClick={() => navigate('/interview/panel', { state: { role, duration: state?.duration ?? 15 } })}>
          Retake Panel Interview
        </button>
      </div>
    </div>
  );
}
