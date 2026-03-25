/**
 * HybridFeatureSection — surfaced on the Dashboard between Quick Actions and Session History.
 * Purely additive component, imported by DashboardPage.
 */
import { useNavigate } from 'react-router-dom';
import '../styles/HybridFeatureSection.css';

export default function HybridFeatureSection() {
  const navigate = useNavigate();

  return (
    <div className="hybrid-feature-section">
      <div className="hybrid-feature-section__header">
        <span className="hybrid-feature-section__badge">NEW</span>
        <h2 className="hybrid-feature-section__title">Advanced Interview Modes</h2>
        <p className="hybrid-feature-section__subtitle">
          Go beyond standard AI interviews — collaborate with a human interviewer or compete in real-time contests.
        </p>
      </div>

      <div className="hybrid-feature-section__cards">
        {/* Hybrid Interview Card */}
        <div className="hybrid-feature-card hybrid-feature-card--hybrid">
          <div className="hybrid-feature-card__icon">🤝</div>
          <div className="hybrid-feature-card__content">
            <div className="hybrid-feature-card__tag">AI + Human</div>
            <h3 className="hybrid-feature-card__title">Hybrid Interview Mode</h3>
            <p className="hybrid-feature-card__desc">
              Experience a real interview with a human interviewer asking questions live, 
              while AI evaluates your answers in real time. Supports voice mode with strict 
              turn-taking — mic only opens after the question is fully delivered.
            </p>
            <ul className="hybrid-feature-card__features">
              <li>🎙 Voice mode with turn-gate control</li>
              <li>👤 Human interviewer panel</li>
              <li>🤖 AI evaluation on every answer</li>
              <li>📊 4-dimension scoring (Technical, Clarity, Depth, Confidence)</li>
            </ul>
          </div>
          <button
            className="hybrid-feature-card__btn hybrid-feature-card__btn--primary"
            onClick={() => navigate('/hybrid/setup')}
          >
            Start Hybrid Interview
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: '6px' }}>
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Contest Mode Card */}
        <div className="hybrid-feature-card hybrid-feature-card--contest">
          <div className="hybrid-feature-card__icon">🏆</div>
          <div className="hybrid-feature-card__content">
            <div className="hybrid-feature-card__tag hybrid-feature-card__tag--contest">Competitive</div>
            <h3 className="hybrid-feature-card__title">Contest Mode</h3>
            <p className="hybrid-feature-card__desc">
              Compete against other candidates in a timed interview session. Answer the same 
              questions under strict constraints — no pausing, no skipping — and see where 
              you rank on the live leaderboard.
            </p>
            <ul className="hybrid-feature-card__features">
              <li>⏱ Dual countdown timers (per-question + total)</li>
              <li>🚫 No pause, no skip — real pressure</li>
              <li>📈 Auto-submit on timer expiry</li>
              <li>🥇 Live leaderboard with tie-breaking</li>
            </ul>
          </div>
          <button
            className="hybrid-feature-card__btn hybrid-feature-card__btn--contest"
            onClick={() => navigate('/hybrid/setup')}
          >
            Enter Contest Mode
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: '6px' }}>
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Quick access strip */}
      <div className="hybrid-feature-section__strip">
        <span className="hybrid-feature-section__strip-label">Quick access:</span>
        <button className="hybrid-strip-btn" onClick={() => navigate('/hybrid/setup')}>
          🤖 AI Interview
        </button>
        <button className="hybrid-strip-btn" onClick={() => navigate('/hybrid/setup')}>
          👤 Human Interview
        </button>
        <button className="hybrid-strip-btn hybrid-strip-btn--contest" onClick={() => navigate('/hybrid/setup')}>
          🏆 Contest
        </button>
      </div>
    </div>
  );
}
