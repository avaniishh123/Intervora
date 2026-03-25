import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import api from '../services/api';
import SessionRecording from '../components/SessionRecording';
import '../styles/InterviewReportPage.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type PerformanceLevel = 'Strongly Right' | 'Partially Right' | 'Neutral' | 'Partially Wrong' | 'Strongly Wrong';

interface QuestionBreakdown {
  index: number;
  questionText: string;
  candidateAnswer: string;
  modelAnswer: string;
  score: number;
  performanceLevel: PerformanceLevel;
  topic: string;
  category: string;
  feedback: string;
}

interface SkillScore {
  skill: string;
  percentage: number;
  color: string;
}

interface ReportData {
  sessionId: string;
  jobRole: string;
  mode: string;
  duration: number;
  startTime: string;
  overallScore: number;
  totalQuestions: number;
  questions: QuestionBreakdown[];
  strongTopics: string[];
  weakTopics: string[];
  skills: SkillScore[];
  improvementTips: string[];
  learningStrategies: string[];
  practicalSuggestions: string[];
  accuracyTrend: number[];
  confidenceTrend: number[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreToLevel(score: number): PerformanceLevel {
  if (score >= 85) return 'Strongly Right';
  if (score >= 65) return 'Partially Right';
  if (score >= 45) return 'Neutral';
  if (score >= 25) return 'Partially Wrong';
  return 'Strongly Wrong';
}

function levelColor(level: PerformanceLevel): string {
  const map: Record<PerformanceLevel, string> = {
    'Strongly Right': '#10b981',
    'Partially Right': '#3b82f6',
    'Neutral': '#f59e0b',
    'Partially Wrong': '#f97316',
    'Strongly Wrong': '#ef4444',
  };
  return map[level];
}

function levelBg(level: PerformanceLevel): string {
  const map: Record<PerformanceLevel, string> = {
    'Strongly Right': '#d1fae5',
    'Partially Right': '#dbeafe',
    'Neutral': '#fef3c7',
    'Partially Wrong': '#ffedd5',
    'Strongly Wrong': '#fee2e2',
  };
  return map[level];
}

function scoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Very Good';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Fair';
  return 'Needs Improvement';
}

const SKILL_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#ec4899', '#84cc16',
];

// ─── Build report from raw session data ───────────────────────────────────────

function buildReport(raw: any): ReportData {
  const questions: QuestionBreakdown[] = (raw.questions || []).map((q: any, i: number) => {
    const score = q.evaluation?.score ?? 0;
    // Support both nested question object and flat structure
    const questionText = q.question?.text || q.text || `Question ${i + 1}`;
    const topic = q.question?.topic || q.topic || q.question?.category || q.category || 'General';
    const category = q.question?.category || q.category || 'technical';
    // Model answer: prefer dedicated field, fall back to feedback
    const modelAnswer = q.evaluation?.modelAnswer
      || q.evaluation?.suggestedAnswer
      || q.evaluation?.feedback
      || 'See feedback below.';
    return {
      index: i + 1,
      questionText,
      candidateAnswer: q.answer || '(No answer recorded)',
      modelAnswer,
      score,
      performanceLevel: scoreToLevel(score),
      topic,
      category,
      feedback: q.evaluation?.feedback || '',
    };
  });

  const perf = raw.performanceReport || {};
  const overallScore = perf.overallScore != null
    ? perf.overallScore
    : questions.length > 0
      ? Math.round(questions.reduce((s, q) => s + q.score, 0) / questions.length)
      : 0;

  // Duration: stored in metadata.duration (minutes) by the backend
  const duration = raw.metadata?.duration
    ?? (raw.duration ? Math.round(raw.duration / 60) : 15);

  // Derive strong/weak topics from question scores
  const topicScores: Record<string, number[]> = {};
  questions.forEach(q => {
    if (!topicScores[q.topic]) topicScores[q.topic] = [];
    topicScores[q.topic].push(q.score);
  });
  const topicAvg = Object.entries(topicScores).map(([t, scores]) => ({
    topic: t,
    avg: scores.reduce((a, b) => a + b, 0) / scores.length,
  }));
  const strongTopics = perf.strengths?.length
    ? perf.strengths
    : topicAvg.filter(t => t.avg >= 70).map(t => t.topic);
  const weakTopics = perf.weaknesses?.length
    ? perf.weaknesses
    : topicAvg.filter(t => t.avg < 50).map(t => t.topic);

  // Build skill scores from real category scores
  const catScores = perf.categoryScores || {};
  const sentiment = perf.sentimentAnalysis || {};
  const skillMap: Record<string, number> = {
    'Technical Knowledge': catScores.technical ?? overallScore,
    'Communication': catScores.communication ?? (sentiment.clarity ? Math.round(sentiment.clarity) : overallScore),
    'Problem Solving': catScores.technical ? Math.min(Math.round(catScores.technical * 1.05), 100) : overallScore,
    'System Design': catScores.technical ? Math.max(Math.round(catScores.technical * 0.9), 0) : overallScore,
    'Behavioral': catScores.behavioral ?? overallScore,
    'Confidence': sentiment.confidence ? Math.round(sentiment.confidence) : overallScore,
  };
  const skills: SkillScore[] = Object.entries(skillMap).map(([skill, pct], i) => ({
    skill,
    percentage: Math.round(Math.min(100, Math.max(0, pct))),
    color: SKILL_COLORS[i % SKILL_COLORS.length],
  }));

  // Real accuracy trend from actual question scores
  const accuracyTrend = questions.map(q => q.score);
  // Confidence trend from per-question sentiment if available, else derive from score
  const confidenceTrend = questions.map(q => {
    const conf = (q as any).evaluation?.sentiment?.confidence;
    return conf != null ? Math.round(conf) : Math.min(100, Math.max(0, q.score + (Math.random() > 0.5 ? 5 : -5)));
  });

  return {
    sessionId: raw._id || raw.id || '',
    jobRole: raw.jobRole || 'Interview',
    mode: raw.mode || 'general',
    duration,
    startTime: raw.startTime || new Date().toISOString(),
    overallScore,
    totalQuestions: questions.length,
    questions,
    strongTopics,
    weakTopics,
    skills,
    improvementTips: perf.recommendations?.slice(0, 3) || [
      'Practice explaining concepts out loud to improve clarity.',
      'Review core fundamentals for topics where you scored below 60.',
      'Use the STAR method for behavioral questions.',
    ],
    learningStrategies: perf.recommendations?.slice(3, 6) || [
      'Build a daily 30-minute study habit focused on weak topics.',
      'Work through real-world projects to reinforce theoretical knowledge.',
      'Join mock interview communities for peer practice.',
    ],
    practicalSuggestions: perf.recommendations?.slice(6) || [
      'Record yourself answering questions and review for filler words.',
      'Study the job description carefully and map your experience to it.',
      'Prepare 2-3 strong examples for each competency area.',
    ],
    accuracyTrend,
    confidenceTrend,
  };
}

// ─── Mini chart components ────────────────────────────────────────────────────

function LineChart({ data, color, label }: { data: number[]; color: string; label: string }) {
  if (!data.length) return null;
  const W = 320, H = 80, pad = 10;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = pad + (i / Math.max(data.length - 1, 1)) * (W - pad * 2);
    const y = H - pad - (v / max) * (H - pad * 2);
    return `${x},${y}`;
  });
  return (
    <div className="mini-chart">
      <div className="mini-chart-label">{label}</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="line-svg">
        <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        {data.map((v, i) => {
          const x = pad + (i / Math.max(data.length - 1, 1)) * (W - pad * 2);
          const y = H - pad - (v / max) * (H - pad * 2);
          return <circle key={i} cx={x} cy={y} r="3.5" fill={color} />;
        })}
      </svg>
    </div>
  );
}

function DonutChart({ score, color }: { score: number; color: string }) {
  const r = 54, cx = 64, cy = 64;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg viewBox="0 0 128 128" className="donut-svg">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth="14" />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth="14"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        className="donut-progress"
      />
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize="22" fontWeight="bold" fill={color}>{score}</text>
    </svg>
  );
}

function HeatmapRow({ questions }: { questions: QuestionBreakdown[] }) {
  return (
    <div className="heatmap-row">
      {questions.map(q => (
        <div
          key={q.index}
          className="heatmap-cell"
          style={{ background: levelColor(q.performanceLevel) }}
          title={`Q${q.index}: ${q.performanceLevel} (${q.score})`}
        >
          <span className="heatmap-num">{q.index}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function InterviewReportPage() {
  const [searchParams] = useSearchParams();
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const sessionId = urlSessionId || searchParams.get('sessionId');

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'analytics' | 'guidance' | 'recording'>('overview');
  const confettiRef = useRef(false);

  // Recording state — only populated for timer-completed sessions
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'polling' | 'available' | 'unavailable'>('idle');

  // Local blob URL from sessionStorage — available immediately after session ends
  const [localBlobUrl, setLocalBlobUrl] = useState<string | null>(null);
  const [localBlobExt, setLocalBlobExt] = useState<string>('webm');

  // Resolve a relative recording path to an absolute backend URL
  const resolveRecordingUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    // Already absolute
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) return url;
    // Relative path — prepend the backend base URL
    const backendBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // Read local blob URL from sessionStorage (set by InterviewPage on session end)
  useEffect(() => {
    if (!sessionId) return;
    const blobUrl = sessionStorage.getItem(`recording_blob_${sessionId}`);
    const ext = sessionStorage.getItem(`recording_ext_${sessionId}`) || 'webm';
    if (blobUrl) {
      setLocalBlobUrl(blobUrl);
      setLocalBlobExt(ext);
      console.log('💾 Local recording blob found in sessionStorage');
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) { setError('No session ID provided'); setLoading(false); return; }

    let attempts = 0;
    const MAX_ATTEMPTS = 6;
    const RETRY_DELAY = 2000; // 2s between retries

    const fetchReport = async () => {
      try {
        const res = await api.get(`/api/sessions/${sessionId}`);
        const raw = res.data.data?.session || res.data;

        // If session is still in-progress and has no questions yet, retry
        if (raw.status === 'in-progress' && (!raw.questions || raw.questions.length === 0) && attempts < MAX_ATTEMPTS) {
          attempts++;
          console.log(`⏳ Session still processing, retry ${attempts}/${MAX_ATTEMPTS}...`);
          setTimeout(fetchReport, RETRY_DELAY);
          return;
        }

        // If session is in-progress but has questions, try to complete it
        if (raw.status === 'in-progress' && raw.questions?.length > 0) {
          try {
            await api.post(`/api/sessions/${sessionId}/complete`, {});
            // Re-fetch after completing
            const res2 = await api.get(`/api/sessions/${sessionId}`);
            const raw2 = res2.data.data?.session || res2.data;
            setReport(buildReport(raw2));
            const resolved = resolveRecordingUrl(raw2.recordingUrl);
            setRecordingUrl(resolved);
            setRecordingStatus(resolved ? 'available' : 'polling');
          } catch {
            // Complete failed — build report from what we have
            setReport(buildReport(raw));
            const resolved = resolveRecordingUrl(raw.recordingUrl);
            setRecordingUrl(resolved);
            setRecordingStatus(resolved ? 'available' : 'polling');
          }
        } else {
          setReport(buildReport(raw));
          const resolved = resolveRecordingUrl(raw.recordingUrl);
          setRecordingUrl(resolved);
          setRecordingStatus(resolved ? 'available' : 'polling');
        }

        if (!confettiRef.current) {
          confettiRef.current = true;
          triggerConfetti();
        }
      } catch (err: any) {
        if (attempts < MAX_ATTEMPTS) {
          attempts++;
          console.log(`⏳ Fetch failed, retry ${attempts}/${MAX_ATTEMPTS}...`);
          setTimeout(fetchReport, RETRY_DELAY);
        } else {
          setError(err.response?.data?.message || 'Failed to load report');
          setLoading(false);
        }
        return;
      }
      setLoading(false);
    };

    fetchReport();
  }, [sessionId]);

  // Poll for recordingUrl when session is completed but recording isn't available yet
  // (handles the case where upload finishes just after the report page loads)
  useEffect(() => {
    if (!sessionId || recordingStatus !== 'polling') return;

    let pollCount = 0;
    const MAX_POLLS = 10; // 10 × 2s = 20s max wait
    const POLL_INTERVAL = 2000;

    const poll = async () => {
      try {
        const res = await api.get(`/api/sessions/${sessionId}`);
        const raw = res.data.data?.session || res.data;
        const resolved = resolveRecordingUrl(raw.recordingUrl);
        if (resolved) {
          setRecordingUrl(resolved);
          setRecordingStatus('available');
          return; // done
        }
      } catch {
        // ignore poll errors
      }
      pollCount++;
      if (pollCount < MAX_POLLS) {
        setTimeout(poll, POLL_INTERVAL);
      } else {
        setRecordingStatus('unavailable');
      }
    };

    const timer = setTimeout(poll, POLL_INTERVAL);
    return () => clearTimeout(timer);
  }, [sessionId, recordingStatus]);

  const triggerConfetti = () => {
    import('canvas-confetti').then(({ default: confetti }) => {
      const end = Date.now() + 2500;
      const tick = () => {
        if (Date.now() > end) return;
        confetti({ particleCount: 40, spread: 360, origin: { x: Math.random(), y: Math.random() - 0.2 } });
        requestAnimationFrame(tick);
      };
      tick();
    }).catch(() => {});
  };

  if (loading) return (
    <div className="ir-page"><div className="ir-loading"><div className="ir-spinner" /><p>Generating your performance report...</p></div></div>
  );
  if (error || !report) return (
    <div className="ir-page"><div className="ir-error"><h2>Unable to Load Report</h2><p>{error || 'Session data not found'}</p>
      <button onClick={() => navigate('/dashboard')} className="ir-btn-primary">Back to Dashboard</button></div></div>
  );

  return (
    <div className="ir-page">
      <div className="ir-container">

        {/* ── Header ── */}
        <div className="ir-header">
          <div className="ir-header-badge">Interview Complete</div>
          <h1 className="ir-title">Performance Report</h1>
          <p className="ir-subtitle">
            {report.jobRole} &bull; {new Date(report.startTime).toLocaleDateString()} &bull; {report.duration} min &bull; {report.totalQuestions} questions
          </p>
        </div>

        {/* ── Tab Nav ── */}
        <nav className="ir-tabs">
          {(['overview', 'questions', 'analytics', 'guidance'] as const).map(tab => (
            <button key={tab} className={`ir-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab === 'overview' && '📊 Overview'}
              {tab === 'questions' && '❓ Questions'}
              {tab === 'analytics' && '📈 Analytics'}
              {tab === 'guidance' && '💡 Guidance'}
            </button>
          ))}
          <button className={`ir-tab ${activeTab === 'recording' ? 'active' : ''}`} onClick={() => setActiveTab('recording')}>
            🎬 Session Recording
          </button>
        </nav>

        {/* ══════════════════════════════════════════════════════════════
            TAB: OVERVIEW
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="ir-tab-content">

            {/* Overall Score */}
            <div className="ir-score-card">
              <DonutChart score={report.overallScore} color={scoreColor(report.overallScore)} />
              <div className="ir-score-info">
                <h2>Overall Score</h2>
                <div className="ir-score-label" style={{ color: scoreColor(report.overallScore) }}>
                  {scoreLabel(report.overallScore)}
                </div>
                <p>{report.overallScore}/100 across {report.totalQuestions} questions</p>
              </div>
            </div>

            {/* Skills breakdown */}
            <div className="ir-section">
              <h3 className="ir-section-title">Skills to Focus On</h3>
              <div className="ir-skills-grid">
                {report.skills.map(s => (
                  <div key={s.skill} className="ir-skill-item">
                    <div className="ir-skill-header">
                      <span className="ir-skill-name">{s.skill}</span>
                      <span className="ir-skill-pct" style={{ color: s.color }}>{s.percentage}%</span>
                    </div>
                    <div className="ir-skill-track">
                      <div className="ir-skill-fill" style={{ width: `${s.percentage}%`, background: s.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Strong / Weak topics */}
            <div className="ir-topics-row">
              <div className="ir-topics-card strong">
                <h4>💪 Strong Topics</h4>
                {report.strongTopics.length ? (
                  <ul>{report.strongTopics.map((t, i) => <li key={i}>{t}</li>)}</ul>
                ) : <p className="ir-empty">Keep practicing to build strong areas.</p>}
              </div>
              <div className="ir-topics-card weak">
                <h4>🎯 Weak Topics</h4>
                {report.weakTopics.length ? (
                  <ul>{report.weakTopics.map((t, i) => <li key={i}>{t}</li>)}</ul>
                ) : <p className="ir-empty">Great — no major weak areas detected.</p>}
              </div>
            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB: QUESTIONS BREAKDOWN
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'questions' && (
          <div className="ir-tab-content">
            <h3 className="ir-section-title">Question-by-Question Breakdown</h3>
            <div className="ir-questions-list">
              {report.questions.map(q => (
                <div key={q.index} className="ir-q-card" onClick={() => setExpandedQ(expandedQ === q.index ? null : q.index)}>
                  <div className="ir-q-header">
                    <div className="ir-q-meta">
                      <span className="ir-q-num">Q{q.index}</span>
                      <span className="ir-q-topic">{q.topic}</span>
                      <span className="ir-q-cat">{q.category}</span>
                    </div>
                    <div className="ir-q-right">
                      <span
                        className="ir-level-badge"
                        style={{ background: levelBg(q.performanceLevel), color: levelColor(q.performanceLevel) }}
                      >
                        {q.performanceLevel}
                      </span>
                      <span className="ir-q-score" style={{ color: scoreColor(q.score) }}>{q.score}/100</span>
                      <span className="ir-q-chevron">{expandedQ === q.index ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  <p className="ir-q-text">{q.questionText}</p>

                  {expandedQ === q.index && (
                    <div className="ir-q-detail">
                      <div className="ir-q-block">
                        <div className="ir-q-block-label">Your Answer</div>
                        <div className="ir-q-block-content candidate">{q.candidateAnswer}</div>
                      </div>
                      <div className="ir-q-block">
                        <div className="ir-q-block-label">Model Answer / Recommended Approach</div>
                        <div className="ir-q-block-content model">{q.modelAnswer}</div>
                      </div>
                      {q.feedback && (
                        <div className="ir-q-block">
                          <div className="ir-q-block-label">AI Feedback</div>
                          <div className="ir-q-block-content feedback">{q.feedback}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB: ANALYTICS
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'analytics' && (
          <div className="ir-tab-content">
            <h3 className="ir-section-title">Visual Analytics</h3>

            {/* Heatmap */}
            <div className="ir-analytics-card">
              <h4>Performance Heatmap</h4>
              <p className="ir-analytics-desc">Color intensity shows how well you answered each question.</p>
              <HeatmapRow questions={report.questions} />
              <div className="ir-heatmap-legend">
                {(['Strongly Right', 'Partially Right', 'Neutral', 'Partially Wrong', 'Strongly Wrong'] as PerformanceLevel[]).map(l => (
                  <span key={l} className="ir-legend-item">
                    <span className="ir-legend-dot" style={{ background: levelColor(l) }} />
                    {l}
                  </span>
                ))}
              </div>
            </div>

            {/* Line charts */}
            <div className="ir-charts-row">
              <div className="ir-analytics-card">
                <h4>Response Accuracy Trend</h4>
                <p className="ir-analytics-desc">Score per question over the session.</p>
                <LineChart data={report.accuracyTrend} color="#3b82f6" label="Score" />
              </div>
              <div className="ir-analytics-card">
                <h4>Confidence Indicator</h4>
                <p className="ir-analytics-desc">Estimated confidence level across questions.</p>
                <LineChart data={report.confidenceTrend} color="#8b5cf6" label="Confidence" />
              </div>
            </div>

            {/* Skill distribution bar chart */}
            <div className="ir-analytics-card">
              <h4>Skill Distribution</h4>
              <p className="ir-analytics-desc">Competency breakdown across key skill areas.</p>
              <div className="ir-skill-dist">
                {report.skills.map(s => (
                  <div key={s.skill} className="ir-dist-row">
                    <span className="ir-dist-label">{s.skill}</span>
                    <div className="ir-dist-track">
                      <div className="ir-dist-fill" style={{ width: `${s.percentage}%`, background: s.color }} />
                    </div>
                    <span className="ir-dist-pct" style={{ color: s.color }}>{s.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB: GUIDANCE
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'guidance' && (
          <div className="ir-tab-content">
            <h3 className="ir-section-title">Actionable Improvement Guidance</h3>

            <div className="ir-guidance-grid">
              <div className="ir-guidance-card tips">
                <div className="ir-guidance-icon">🎯</div>
                <h4>Personalized Tips</h4>
                <ul>
                  {report.improvementTips.map((tip, i) => <li key={i}>{tip}</li>)}
                </ul>
              </div>

              <div className="ir-guidance-card strategies">
                <div className="ir-guidance-icon">📚</div>
                <h4>Recommended Learning Strategies</h4>
                <ul>
                  {report.learningStrategies.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>

              <div className="ir-guidance-card practical">
                <div className="ir-guidance-icon">🛠️</div>
                <h4>Practical Suggestions</h4>
                <ul>
                  {report.practicalSuggestions.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>

            {/* Weak topic focus */}
            {report.weakTopics.length > 0 && (
              <div className="ir-focus-section">
                <h4>📌 Priority Focus Areas</h4>
                <p>Based on your session, concentrate on these topics before your next interview:</p>
                <div className="ir-focus-tags">
                  {report.weakTopics.map((t, i) => (
                    <span key={i} className="ir-focus-tag">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB: SESSION RECORDING
        ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'recording' && (
          <div className="ir-tab-content">
            {recordingUrl && sessionId ? (
              <SessionRecording
                sessionId={sessionId}
                recordingUrl={recordingUrl}
                localBlobUrl={localBlobUrl}
                localBlobExt={localBlobExt}
                onRecordingDeleted={() => { setRecordingUrl(null); setRecordingStatus('unavailable'); }}
              />
            ) : recordingStatus === 'polling' ? (
              <div className="ir-empty-recording">
                <div className="ir-recording-spinner" />
                <p>Processing your recording…</p>
                <span className="ir-empty-recording-hint">This usually takes a few seconds. Hang tight.</span>
                {localBlobUrl && (
                  <a
                    href={localBlobUrl}
                    download={`interview-recording.${localBlobExt}`}
                    className="ir-download-local-btn"
                  >
                    ⬇️ Download Recording Now
                  </a>
                )}
              </div>
            ) : (
              <div className="ir-empty-recording">
                <span className="ir-empty-recording-icon">🎬</span>
                <p>No server recording available for this session.</p>
                {localBlobUrl ? (
                  <>
                    <span className="ir-empty-recording-hint">Your recording is available for local download below.</span>
                    <a
                      href={localBlobUrl}
                      download={`interview-recording.${localBlobExt}`}
                      className="ir-download-local-btn"
                    >
                      ⬇️ Download Recording
                    </a>
                  </>
                ) : (
                  <span className="ir-empty-recording-hint">Recordings are only saved for sessions that run to completion.</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Actions ── */}
        <div className="ir-actions">
          <button onClick={() => navigate('/dashboard')} className="ir-btn-secondary">Back to Dashboard</button>
          <button onClick={() => navigate('/interview/setup')} className="ir-btn-primary">Start New Interview</button>
        </div>

      </div>
    </div>
  );
}
