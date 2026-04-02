/**
 * LiveInterviewSetupPage — Interviewer creates a new Human-Based Interview session.
 * Selects job role, session duration, then gets a shareable link.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import '../styles/LiveInterview.css';

const DURATIONS = [
  { value: 5, label: '5 min', desc: 'Quick screen' },
  { value: 15, label: '15 min', desc: 'Short interview' },
  { value: 25, label: '25 min', desc: 'Standard interview' },
  { value: 40, label: '40 min', desc: 'In-depth interview' },
];

const JOB_ROLES = [
  'Software Engineer', 'Frontend Developer', 'Backend Developer',
  'Full Stack Developer', 'DevOps Engineer', 'Data Scientist',
  'AI/ML Engineer', 'Cloud Engineer', 'Cybersecurity Engineer',
  'Product Manager', 'UI/UX Designer', 'Other',
];

export default function LiveInterviewSetupPage() {
  const navigate = useNavigate();
  const user = useAuthStore(s => s.user);
  const [jobRole, setJobRole] = useState('');
  const [customRole, setCustomRole] = useState('');
  const [duration, setDuration] = useState<number>(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const effectiveRole = jobRole === 'Other' ? customRole : jobRole;

  const handleCreate = async () => {
    if (!effectiveRole.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/live/sessions', {
        jobRole: effectiveRole.trim(),
        durationMinutes: duration,
        hostName: user?.profile?.name ?? user?.email,
      });
      const { sessionId } = res.data.data;
      navigate(`/live/waiting/${sessionId}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to create session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="li-setup-page">
      <div className="li-setup-card">
        <button className="li-back-btn" onClick={() => navigate('/dashboard')}>← Back</button>

        <div className="li-setup-header">
          <div className="li-setup-badge">👤 Human Interview</div>
          <h1 className="li-setup-title">Create Interview Session</h1>
          <p className="li-setup-subtitle">
            Set up a live interview session and share the link with your candidate.
          </p>
        </div>

        <div className="li-setup-section">
          <label className="li-setup-label">Job Role</label>
          <select
            className="li-setup-select"
            value={jobRole}
            onChange={e => setJobRole(e.target.value)}
          >
            <option value="">Select a role...</option>
            {JOB_ROLES.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          {jobRole === 'Other' && (
            <input
              className="li-setup-input"
              placeholder="Enter custom role..."
              value={customRole}
              onChange={e => setCustomRole(e.target.value)}
              style={{ marginTop: '0.75rem' }}
            />
          )}
        </div>

        <div className="li-setup-section">
          <label className="li-setup-label">Session Duration</label>
          <div className="li-duration-grid">
            {DURATIONS.map(d => (
              <button
                key={d.value}
                className={`li-duration-btn${duration === d.value ? ' li-duration-btn--active' : ''}`}
                onClick={() => setDuration(d.value)}
              >
                <span className="li-duration-value">{d.label}</span>
                <span className="li-duration-desc">{d.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <div className="li-error">{error}</div>}

        <button
          className="li-create-btn"
          onClick={handleCreate}
          disabled={loading || !effectiveRole.trim()}
        >
          {loading ? 'Creating...' : 'Create Session & Get Link →'}
        </button>
      </div>
    </div>
  );
}
