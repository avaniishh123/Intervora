/**
 * LiveReportViewPage — Public page for candidates to view their performance report.
 * Accessed via shareable link: /live/report/:reportId
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import '../styles/LiveInterview.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

interface Criteria {
  technicalSkills: number;
  communicationSkills: number;
  problemSolving: number;
  culturalFit: number;
  overallImpression: number;
}

interface Report {
  reportId: string;
  candidateName: string;
  jobRole: string;
  durationMinutes: number;
  criteria: Criteria;
  overallScore: number;
  strengths: string;
  improvements: string;
  recommendation: 'strong_hire' | 'hire' | 'maybe' | 'no_hire';
  additionalNotes: string;
  submittedAt: string;
}

const REC_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  strong_hire: { label: 'Strong Hire', color: '#10b981', icon: '⭐' },
  hire: { label: 'Hire', color: '#3b82f6', icon: '✅' },
  maybe: { label: 'Maybe', color: '#f59e0b', icon: '🤔' },
  no_hire: { label: 'No Hire', color: '#ef4444', icon: '❌' },
};

const CRITERIA_LABELS: { key: keyof Criteria; label: string; icon: string }[] = [
  { key: 'technicalSkills', label: 'Technical Skills', icon: '⚙️' },
  { key: 'communicationSkills', label: 'Communication', icon: '💬' },
  { key: 'problemSolving', label: 'Problem Solving', icon: '🔍' },
  { key: 'culturalFit', label: 'Cultural Fit', icon: '🤝' },
  { key: 'overallImpression', label: 'Overall Impression', icon: '⭐' },
];

export default function LiveReportViewPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!reportId) return;
    fetch(`${API_BASE}/api/live/report/${reportId}`)
      .then(r => r.json())
      .then(data => {
        if (data.status === 'success') {
          setReport(data.data.report);
        } else {
          setError(data.message ?? 'Report not found.');
        }
      })
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  }, [reportId]);

  if (loading) {
    return (
      <div className="li-page">
        <div className="li-card li-card--center">
          <div className="li-spinner-lg" />
          <p className="li-subtitle">Loading report…</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="li-page">
        <div className="li-card li-card--center">
          <div className="li-error-icon">❌</div>
          <h2 className="li-title">Report Not Found</h2>
          <p className="li-subtitle">{error || 'This report link is invalid or has expired.'}</p>
        </div>
      </div>
    );
  }

  const rec = REC_LABELS[report.recommendation];
  const scoreColor = report.overallScore >= 70 ? '#10b981' : report.overallScore >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="li-page">
      <div className="li-card li-card--wide">
        <div className="li-header">
          <div className="li-badge">📋 Performance Report</div>
          <h1 className="li-title">{report.candidateName}</h1>
          <p className="li-subtitle">
            {report.jobRole} Interview · {report.durationMinutes} min ·{' '}
            {new Date(report.submittedAt).toLocaleDateString()}
          </p>
        </div>

        {/* Overall score */}
        <div className="li-report-score-ring" style={{ borderColor: scoreColor }}>
          <span className="li-report-score-num" style={{ color: scoreColor }}>{report.overallScore}</span>
          <span className="li-report-score-denom">/100</span>
        </div>

        {/* Recommendation */}
        <div className="li-report-rec" style={{ color: rec.color, borderColor: rec.color }}>
          {rec.icon} {rec.label}
        </div>

        {/* Criteria breakdown */}
        <div className="li-report-section">
          <div className="li-report-section-title">Evaluation Breakdown</div>
          {CRITERIA_LABELS.map(({ key, label, icon }) => {
            const val = report.criteria[key];
            const pct = (val / 10) * 100;
            const color = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
            return (
              <div key={key} className="li-report-criterion">
                <div className="li-report-criterion-header">
                  <span>{icon} {label}</span>
                  <span className="li-report-criterion-val">{val}/10</span>
                </div>
                <div className="li-report-bar">
                  <div className="li-report-bar-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Strengths */}
        {report.strengths && (
          <div className="li-report-section">
            <div className="li-report-section-title">💪 Strengths</div>
            <p className="li-report-text">{report.strengths}</p>
          </div>
        )}

        {/* Improvements */}
        {report.improvements && (
          <div className="li-report-section">
            <div className="li-report-section-title">📈 Areas for Improvement</div>
            <p className="li-report-text">{report.improvements}</p>
          </div>
        )}

        {/* Additional notes */}
        {report.additionalNotes && (
          <div className="li-report-section">
            <div className="li-report-section-title">📝 Additional Notes</div>
            <p className="li-report-text">{report.additionalNotes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
