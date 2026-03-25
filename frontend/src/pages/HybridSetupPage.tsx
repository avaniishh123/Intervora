import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { HybridMode } from '../types/hybrid.types';
import '../styles/HybridSetup.css';

const MODES: { mode: HybridMode; icon: string; title: string; desc: string }[] = [
  { mode: 'ai', icon: '🤖', title: 'AI Interview', desc: 'Gemini-powered questions with real-time evaluation.' },
  { mode: 'human', icon: '👤', title: 'Human Interview', desc: 'A real interviewer sends questions via the panel.' },
  { mode: 'contest', icon: '🏆', title: 'Contest Mode', desc: 'Timed competitive session with live leaderboard.' },
];

export default function HybridSetupPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<HybridMode | null>(null);
  const [jobRole, setJobRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleStart() {
    if (!selected || !jobRole.trim()) return;
    setLoading(true);
    setError('');
    try {
      if (selected === 'contest') {
        navigate('/contest/mode');
        return;
      } else if (selected === 'human') {
        // Human mode: create a waiting room and redirect host there with shareable link
        const roomRes = await api.post('/api/hybrid/rooms', { jobRole });
        const { sessionId } = roomRes.data.data;
        sessionStorage.setItem('hybrid_mode_' + sessionId, 'human');
        sessionStorage.setItem('hybrid_jobrole_' + sessionId, jobRole);
        navigate('/hybrid/room/' + sessionId, { state: { mode: 'human', jobRole } });
      } else {
        const res = await api.post('/api/hybrid/sessions', { mode: selected, jobRole });
        const { sessionId, redirectUrl } = res.data.data;
        sessionStorage.setItem('hybrid_mode_' + sessionId, selected);
        sessionStorage.setItem('hybrid_jobrole_' + sessionId, jobRole);
        navigate(redirectUrl, { state: { mode: selected, jobRole } });
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to create session.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hybrid-setup">
      <div className="hybrid-setup__card">
        <button
          className="hybrid-setup__dashboard-btn"
          onClick={() => navigate('/dashboard')}
          aria-label="Back to Dashboard"
        >
          ← Back to Dashboard
        </button>
        <h1 className="hybrid-setup__title">Hybrid Interview System</h1>
        <p className="hybrid-setup__subtitle">Choose your interview mode to get started</p>

        {!selected ? (
          <div className="hybrid-setup__modes">
            {MODES.map(m => (
              <div key={m.mode} className="hybrid-mode-card" onClick={() => setSelected(m.mode)}>
                <div className="hybrid-mode-card__icon">{m.icon}</div>
                <div className="hybrid-mode-card__title">{m.title}</div>
                <div className="hybrid-mode-card__desc">{m.desc}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="hybrid-setup__form">
            <button className="hybrid-setup__back" onClick={() => { setSelected(null); setError(''); }}>
              ← Back
            </button>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1rem' }}>
              Mode: <strong style={{ color: '#a78bfa' }}>{MODES.find(m => m.mode === selected)?.title}</strong>
            </p>
            <input
              className="hybrid-setup__input"
              placeholder="Job role (e.g. Frontend Engineer)"
              value={jobRole}
              onChange={e => setJobRole(e.target.value)}
            />
            {error && <p style={{ color: '#fca5a5', marginBottom: '0.75rem', fontSize: '0.9rem' }}>{error}</p>}
            <button
              className="hybrid-setup__btn"
              onClick={handleStart}
              disabled={loading || !jobRole.trim()}
            >
              {loading ? 'Starting...' : 'Start Session'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
