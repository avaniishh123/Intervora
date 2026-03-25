import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import '../styles/InterviewReportPage.css';

// Reuse the same visual helpers from InterviewReportPage
type PerformanceLevel = 'Strongly Right' | 'Partially Right' | 'Neutral' | 'Partially Wrong' | 'Strongly Wrong';

function scoreToLevel(score: number): PerformanceLevel {
  if (score >= 85) return 'Strongly Right';
  if (score >= 65) return 'Partially Right';
  if (score >= 45) return 'Neutral';
  if (score >= 25) return 'Partially Wrong';
  return 'Strongly Wrong';
}
function levelColor(level: PerformanceLevel) {
  const m: Record<PerformanceLevel, string> = { 'Strongly Right': '#10b981', 'Partially Right': '#3b82f6', 'Neutral': '#f59e0b', 'Partially Wrong': '#f97316', 'Strongly Wrong': '#ef4444' };
  return m[level];
}
function scoreColor(s: number) { return s >= 80 ? '#10b981' : s >= 60 ? '#f59e0b' : '#ef4444'; }
function scoreLabel(s: number) {
  if (s >= 90) return 'Excellent'; if (s >= 80) return 'Very Good'; if (s >= 70) return 'Good'; if (s >= 60) return 'Fair'; return 'Needs Improvement';
}

function DonutChart({ score, color }: { score: number; color: string }) {
  const r = 54, cx = 64, cy = 64, circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg viewBox="0 0 128 128" className="donut-svg">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="14" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="14"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} className="donut-progress" />
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize="22" fontWeight="bold" fill={color}>{score}</text>
    </svg>
  );
}

export default function SimulationReportPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get('sessionId');

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'behavior' | 'recruiter'>('overview');

  useEffect(() => {
    if (!sessionId) { setError('No session ID'); setLoading(false); return; }
    let attempts = 0;
    const fetch = async () => {
      try {
        const res = await api.get(`/api/simulation/${sessionId}`);
        const s = res.data.data?.session;
        if (s.status === 'in-progress' && attempts < 5) {
          attempts++;
          setTimeout(fetch, 2000);
          return;
        }
        // If still in-progress, complete it
        if (s.status === 'in-progress') {
          await api.post(`/api/simulation/${sessionId}/complete`, {});
          const res2 = await api.get(`/api/simulation/${sessionId}`);
          setSession(res2.data.data?.session);
        } else {
          setSession(s);
        }
        setLoading(false);
      } catch (e: any) {
        if (attempts < 5) { attempts++; setTimeout(fetch, 2000); }
        else { setError('Failed to load report'); setLoading(false); }
      }
    };
    fetch();
  }, [sessionId]);

  if (loading) return (
    <div className="ir-page"><div className="ir-loading"><div className="ir-spinner" /><p>Generating your simulation report...</p></div></div>
  );
  if (error || !session) return (
    <div className="ir-page"><div className="ir-error"><h2>Unable to Load Report</h2><p>{error}</p>
      <button onClick={() => navigate('/dashboard')} className="ir-btn-primary">Back to Dashboard</button></div></div>
  );

  const report = session.report || {};
  const overallScore = report.overallScore || 0;
  const sectionScores: Record<string, number> = report.sectionScores || {};
  const evaluations: any[] = session.evaluations || [];
  const hiringRec = report.hiringRecommendation || 'Borderline';
  const hiringColor = hiringRec === 'Strong Hire' ? '#10b981' : hiringRec === 'Hire' ? '#3b82f6' : hiringRec === 'Borderline' ? '#f59e0b' : '#ef4444';

  return (
    <div className="ir-page">
      <div className="ir-container">
        {/* Header */}
        <div className="ir-header">
          <div className="ir-header-badge">🧪 Simulation Complete</div>
          <h1 className="ir-title">Simulation Report</h1>
          <p className="ir-subtitle">
            {session.jobRole} &bull; {new Date(session.startTime).toLocaleDateString()} &bull; {session.duration} min &bull; {evaluations.length} tasks
          </p>
        </div>

        {/* Tabs */}
        <nav className="ir-tabs">
          {(['overview', 'tasks', 'behavior', 'recruiter'] as const).map(tab => (
            <button key={tab} className={`ir-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab === 'overview' && '📊 Overview'}
              {tab === 'tasks' && '📋 Task Breakdown'}
              {tab === 'behavior' && '🔍 Behavioral Analysis'}
              {tab === 'recruiter' && '👔 Recruiter View'}
            </button>
          ))}
        </nav>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="ir-tab-content">
            <div className="ir-score-card">
              <DonutChart score={overallScore} color={scoreColor(overallScore)} />
              <div className="ir-score-info">
                <h2>Overall Score</h2>
                <div className="ir-score-label" style={{ color: scoreColor(overallScore) }}>{scoreLabel(overallScore)}</div>
                <p>{overallScore}/100 across {evaluations.length} simulation tasks</p>
                <div className="sim-hiring-badge" style={{ background: hiringColor + '22', color: hiringColor, border: `1px solid ${hiringColor}` }}>
                  {hiringRec}
                </div>
              </div>
            </div>

            {/* Section scores */}
            {Object.keys(sectionScores).length > 0 && (
              <div className="ir-section">
                <h3 className="ir-section-title">Task Scores</h3>
                <div className="ir-skills-grid">
                  {Object.entries(sectionScores).map(([title, score]) => (
                    <div key={title} className="ir-skill-item">
                      <div className="ir-skill-header">
                        <span className="ir-skill-name">{title}</span>
                        <span className="ir-skill-pct" style={{ color: scoreColor(score) }}>{score}%</span>
                      </div>
                      <div className="ir-skill-track">
                        <div className="ir-skill-fill" style={{ width: `${score}%`, background: scoreColor(score) }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths / Weaknesses */}
            <div className="ir-topics-row">
              <div className="ir-topics-card strong">
                <h4>💪 Strengths</h4>
                {(report.strengths || []).length ? (
                  <ul>{(report.strengths || []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                ) : <p className="ir-empty">Keep practicing to build strong areas.</p>}
              </div>
              <div className="ir-topics-card weak">
                <h4>🎯 Areas to Improve</h4>
                {(report.weaknesses || []).length ? (
                  <ul>{(report.weaknesses || []).map((w: string, i: number) => <li key={i}>{w}</li>)}</ul>
                ) : <p className="ir-empty">No major weak areas detected.</p>}
              </div>
            </div>
          </div>
        )}

        {/* TASK BREAKDOWN */}
        {activeTab === 'tasks' && (
          <div className="ir-tab-content">
            <h3 className="ir-section-title">Task-by-Task Breakdown</h3>
            {evaluations.length === 0 ? (
              <p className="ir-empty">No task evaluations available.</p>
            ) : evaluations.map((ev: any, i: number) => {
              const task = session.tasks?.find((t: any) => t.id === ev.taskId);
              const level = scoreToLevel(ev.finalScore);
              return (
                <div key={i} className="ir-q-card">
                  <div className="ir-q-header">
                    <div className="ir-q-meta">
                      <span className="ir-q-num">Task {i + 1}</span>
                      <span className="ir-q-topic">{task?.title || ev.taskId}</span>
                    </div>
                    <div className="ir-q-right">
                      <span className="ir-level-badge" style={{ background: levelColor(level) + '22', color: levelColor(level) }}>{level}</span>
                      <span className="ir-q-score" style={{ color: scoreColor(ev.finalScore) }}>{ev.finalScore}/100</span>
                    </div>
                  </div>
                  <div className="ir-q-detail">
                    <div className="ir-q-block">
                      <div className="ir-q-block-label">AI Assessment</div>
                      <div className="ir-q-block-content feedback">{ev.reasoning}</div>
                    </div>
                    {ev.strengths?.length > 0 && (
                      <div className="ir-q-block">
                        <div className="ir-q-block-label">Strengths</div>
                        <div className="ir-q-block-content model">{ev.strengths.join(' • ')}</div>
                      </div>
                    )}
                    {ev.weaknesses?.length > 0 && (
                      <div className="ir-q-block">
                        <div className="ir-q-block-label">Areas to Improve</div>
                        <div className="ir-q-block-content candidate">{ev.weaknesses.join(' • ')}</div>
                      </div>
                    )}
                    <div className="sim-score-breakdown">
                      <span>Rule-based: {ev.ruleBasedScore}</span>
                      <span>AI: {ev.aiScore}</span>
                      <span>Time: {ev.timePerformance}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* BEHAVIORAL */}
        {activeTab === 'behavior' && (
          <div className="ir-tab-content">
            <h3 className="ir-section-title">Behavioral Observations</h3>
            <div className="ir-guidance-grid">
              <div className="ir-guidance-card tips">
                <div className="ir-guidance-icon">🔍</div>
                <h4>Observed Behaviors</h4>
                <ul>
                  {(report.behavioralObservations || ['No behavioral data recorded.']).map((o: string, i: number) => <li key={i}>{o}</li>)}
                </ul>
              </div>
              <div className="ir-guidance-card strategies">
                <div className="ir-guidance-icon">📊</div>
                <h4>Session Metrics</h4>
                <ul>
                  <li>Total tasks: {session.metadata?.totalTasks || 0}</li>
                  <li>Completed tasks: {session.metadata?.completedTasks || 0}</li>
                  <li>Total code runs: {session.metadata?.totalRunCount || 0}</li>
                  <li>Total attempts: {session.metadata?.totalAttempts || 0}</li>
                </ul>
              </div>
              <div className="ir-guidance-card practical">
                <div className="ir-guidance-icon">💡</div>
                <h4>Confidence Indicators</h4>
                <p>{report.confidenceIndicators || 'Not assessed'}</p>
              </div>
            </div>
            {(report.candidateView?.tips || []).length > 0 && (
              <div className="ir-focus-section">
                <h4>📌 Improvement Tips</h4>
                <ul>{(report.candidateView.tips || []).map((t: string, i: number) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}
          </div>
        )}

        {/* RECRUITER VIEW */}
        {activeTab === 'recruiter' && (
          <div className="ir-tab-content">
            <h3 className="ir-section-title">Recruiter Summary</h3>
            <div className="sim-hiring-card" style={{ borderColor: hiringColor }}>
              <div className="sim-hiring-rec" style={{ color: hiringColor }}>
                {hiringRec}
              </div>
              <p>{report.hiringRationale}</p>
              <p>{report.recruiterView?.summary}</p>
            </div>
            <div className="ir-topics-row">
              <div className="ir-topics-card strong">
                <h4>✅ Positive Signals</h4>
                <ul>{(report.recruiterView?.positiveSignals || []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
              </div>
              <div className="ir-topics-card weak">
                <h4>⚠️ Risk Factors</h4>
                <ul>{(report.recruiterView?.riskFactors || []).map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="ir-actions">
          <button onClick={() => navigate('/dashboard')} className="ir-btn-secondary">Dashboard</button>
          <button onClick={() => navigate('/interview/setup')} className="ir-btn-primary">New Interview</button>
        </div>
      </div>
    </div>
  );
}
