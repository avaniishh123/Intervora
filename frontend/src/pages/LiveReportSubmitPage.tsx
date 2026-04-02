/**
 * LiveReportSubmitPage — Interviewer fills out performance evaluation after session ends.
 * Generates a shareable report link and provides email option.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import '../styles/LiveInterview.css';

const RECOMMENDATIONS = [
  { value: 'strong_hire', label: '⭐ Strong Hire', color: '#10b981' },
  { value: 'hire', label: '✅ Hire', color: '#3b82f6' },
  { value: 'maybe', label: '🤔 Maybe', color: '#f59e0b' },
  { value: 'no_hire', label: '❌ No Hire', color: '#ef4444' },
];

interface Criteria {
  technicalSkills: number;
  communicationSkills: number;
  problemSolving: number;
  culturalFit: number;
  overallImpression: number;
}

export default function LiveReportSubmitPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [candidateName, setCandidateName] = useState('');
  const [criteria, setCriteria] = useState<Criteria>({
    technicalSkills: 5,
    communicationSkills: 5,
    problemSolving: 5,
    culturalFit: 5,
    overallImpression: 5,
  });
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reportId, setReportId] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<{ jobRole: string; durationMinutes: number } | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    api.get(`/api/live/sessions/${sessionId}`)
      .then(res => {
        const s = res.data.data.session;
        setSessionInfo({ jobRole: s.jobRole, durationMinutes: s.durationMinutes });
        // Pre-fill candidate name if available
        const candidate = s.participants?.find((p: any) => p.role === 'candidate');
        if (candidate) setCandidateName(candidate.name);
      })
      .catch(() => {});
  }, [sessionId]);

  const overallScore = Math.round(
    ((criteria.technicalSkills + criteria.communicationSkills +
      criteria.problemSolving + criteria.culturalFit + criteria.overallImpression) / 5) * 10
  );

  const handleSubmit = async () => {
    if (!candidateName.trim() || !recommendation) {
      setError('Please fill in candidate name and recommendation.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post(`/api/live/sessions/${sessionId}/report`, {
        candidateName,
        criteria,
        strengths,
        improvements,
        recommendation,
        additionalNotes,
      });
      setReportId(res.data.data.reportId);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  const reportUrl = reportId ? `${window.location.origin}/live/view/${reportId}` : '';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(reportUrl);
  };

  const handleSendEmail = () => {
    if (!candidateEmail.trim() || !reportUrl) return;
    const subject = encodeURIComponent(`Your Interview Performance Report — ${sessionInfo?.jobRole ?? 'Interview'}`);
    const body = encodeURIComponent(
      `Hi ${candidateName},\n\nThank you for participating in the interview. Please find your performance report at the link below:\n\n${reportUrl}\n\nBest regards`
    );
    window.open(`mailto:${candidateEmail}?subject=${subject}&body=${body}`);
    setEmailSent(true);
  };

  const setCriterion = (key: keyof Criteria, val: number) => {
    setCriteria(prev => ({ ...prev, [key]: val }));
  };

  if (reportId) {
    return (
      <div className="li-page">
        <div className="li-card">
          <div className="li-header">
            <div className="li-badge">📋 Report Submitted</div>
            <h1 className="li-title">Report Generated</h1>
            <p className="li-subtitle">Share the link below with the candidate.</p>
          </div>

          <div className="li-report-score-ring">
            <span className="li-report-score-num">{overallScore}</span>
            <span className="li-report-score-denom">/100</span>
          </div>

          <div className="li-link-box" style={{ marginTop: '1.5rem' }}>
            <div className="li-link-label">Shareable Report Link</div>
            <div className="li-link-row">
              <input className="li-link-input" readOnly value={reportUrl} onFocus={e => e.target.select()} />
              <button className="li-copy-btn" onClick={handleCopyLink}>Copy</button>
            </div>
          </div>

          <div className="li-email-section">
            <label className="li-setup-label">Send via Email (optional)</label>
            <div className="li-link-row">
              <input
                className="li-setup-input"
                placeholder="candidate@email.com"
                value={candidateEmail}
                onChange={e => setCandidateEmail(e.target.value)}
                type="email"
              />
              <button
                className="li-copy-btn"
                onClick={handleSendEmail}
                disabled={!candidateEmail.trim() || emailSent}
              >
                {emailSent ? '✓ Sent' : 'Send'}
              </button>
            </div>
            <p className="li-link-hint">Opens your email client with the report link pre-filled.</p>
          </div>

          <button className="li-start-btn" style={{ marginTop: '1.5rem' }} onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="li-page">
      <div className="li-card li-card--wide">
        <div className="li-header">
          <div className="li-badge">📋 Performance Evaluation</div>
          <h1 className="li-title">Candidate Report</h1>
          <p className="li-subtitle">
            Fill out the evaluation for {sessionInfo?.jobRole ?? 'this'} interview.
          </p>
        </div>

        <div className="li-report-form">
          <div className="li-setup-section">
            <label className="li-setup-label">Candidate Name</label>
            <input
              className="li-setup-input"
              value={candidateName}
              onChange={e => setCandidateName(e.target.value)}
              placeholder="Candidate's full name"
            />
          </div>

          <div className="li-setup-section">
            <label className="li-setup-label">Evaluation Criteria (1–10)</label>
            <div className="li-criteria-grid">
              {([
                { key: 'technicalSkills', label: '⚙️ Technical Skills' },
                { key: 'communicationSkills', label: '💬 Communication' },
                { key: 'problemSolving', label: '🔍 Problem Solving' },
                { key: 'culturalFit', label: '🤝 Cultural Fit' },
                { key: 'overallImpression', label: '⭐ Overall Impression' },
              ] as { key: keyof Criteria; label: string }[]).map(({ key, label }) => (
                <div key={key} className="li-criterion">
                  <div className="li-criterion-header">
                    <span>{label}</span>
                    <span className="li-criterion-val">{criteria[key]}/10</span>
                  </div>
                  <input
                    type="range"
                    min={1} max={10} step={1}
                    value={criteria[key]}
                    onChange={e => setCriterion(key, Number(e.target.value))}
                    className="li-criterion-slider"
                  />
                </div>
              ))}
            </div>
            <div className="li-overall-score">
              Overall Score: <strong>{overallScore}/100</strong>
            </div>
          </div>

          <div className="li-setup-section">
            <label className="li-setup-label">Strengths</label>
            <textarea
              className="li-setup-textarea"
              placeholder="What did the candidate do well?"
              value={strengths}
              onChange={e => setStrengths(e.target.value)}
              rows={3}
            />
          </div>

          <div className="li-setup-section">
            <label className="li-setup-label">Areas for Improvement</label>
            <textarea
              className="li-setup-textarea"
              placeholder="What could the candidate improve?"
              value={improvements}
              onChange={e => setImprovements(e.target.value)}
              rows={3}
            />
          </div>

          <div className="li-setup-section">
            <label className="li-setup-label">Hiring Recommendation</label>
            <div className="li-recommendation-grid">
              {RECOMMENDATIONS.map(r => (
                <button
                  key={r.value}
                  className={`li-rec-btn${recommendation === r.value ? ' li-rec-btn--active' : ''}`}
                  style={recommendation === r.value ? { borderColor: r.color, color: r.color } : {}}
                  onClick={() => setRecommendation(r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="li-setup-section">
            <label className="li-setup-label">Additional Notes (optional)</label>
            <textarea
              className="li-setup-textarea"
              placeholder="Any other observations..."
              value={additionalNotes}
              onChange={e => setAdditionalNotes(e.target.value)}
              rows={2}
            />
          </div>

          {error && <div className="li-error">{error}</div>}

          <button
            className="li-create-btn"
            onClick={handleSubmit}
            disabled={submitting || !candidateName.trim() || !recommendation}
          >
            {submitting ? 'Submitting…' : 'Submit Report & Generate Link →'}
          </button>
        </div>
      </div>
    </div>
  );
}
