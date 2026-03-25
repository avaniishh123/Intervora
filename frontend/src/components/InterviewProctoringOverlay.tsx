import { ProctoringState } from '../hooks/useInterviewProctor';
import '../styles/InterviewProctoringOverlay.css';

interface Props {
  state: ProctoringState;
  maxWarnings: number;
  screenShareError: string | null;
  onRequestScreenShare: () => void;
  onEnterFullscreen: () => void;
  onDismissWarning: () => void;
}

const InterviewProctoringOverlay = ({
  state,
  maxWarnings,
  screenShareError,
  onRequestScreenShare,
  onEnterFullscreen,
  onDismissWarning,
}: Props) => {
  const { phase, warningCount, violationReason } = state;

  // ── Step 1: Screen-share gate (entire screen required) ─────────────────────
  if (phase === 'requesting-screen-share') {
    return (
      <div className="proctoring-overlay proctoring-gate" role="dialog" aria-modal="true">
        <div className="proctoring-card">
          <div className="proctoring-icon">🖥️</div>
          <h2 className="proctoring-title">Share Your Entire Screen</h2>
          <p className="proctoring-body">
            To record your full interview session, you must share your{' '}
            <strong>entire screen</strong> — not just a tab or window.
          </p>
          <ul className="proctoring-rules">
            <li>📌 In the browser prompt, click the <strong>"Entire screen"</strong> tab</li>
            <li>🖥️ Select your monitor and click <strong>"Share"</strong></li>
            <li>🚫 Do <strong>not</strong> select "Chrome tab" or "Window"</li>
            <li>🎬 This captures the full session — questions, timer, and your answers</li>
            <li>🔒 After sharing, you'll enter full-screen mode to begin</li>
          </ul>
          {screenShareError && (
            <p className="proctoring-error">{screenShareError}</p>
          )}
          <button
            className="proctoring-btn proctoring-btn-primary"
            onClick={onRequestScreenShare}
          >
            Share Entire Screen &amp; Continue
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Fullscreen gate ─────────────────────────────────────────────────
  if (phase === 'requesting-fullscreen') {
    return (
      <div className="proctoring-overlay proctoring-gate" role="dialog" aria-modal="true">
        <div className="proctoring-card">
          <div className="proctoring-icon">🔒</div>
          <h2 className="proctoring-title">Full-Screen Required</h2>
          <p className="proctoring-body">
            Screen sharing is active. Now enter full-screen mode to begin your
            distraction-free interview session.
          </p>
          <ul className="proctoring-rules">
            <li>🚫 Do not exit full-screen during the interview</li>
            <li>🚫 Do not switch tabs or minimize the window</li>
            <li>🚫 Do not use copy, paste, or right-click</li>
            <li>⚠️ Violations will trigger warnings and may end your session</li>
          </ul>
          <button
            className="proctoring-btn proctoring-btn-primary"
            onClick={onEnterFullscreen}
          >
            Enter Full-Screen &amp; Start Interview
          </button>
        </div>
      </div>
    );
  }

  // ── Violation warning ───────────────────────────────────────────────────────
  if (phase === 'warning') {
    const remaining = maxWarnings - warningCount;
    return (
      <div className="proctoring-overlay proctoring-warning" role="alertdialog" aria-modal="true">
        <div className="proctoring-card proctoring-card-warning">
          <div className="proctoring-icon">⚠️</div>
          <h2 className="proctoring-title">Security Violation Detected</h2>
          <p className="proctoring-body">
            {violationReason || 'A security violation was detected.'}
          </p>
          <p className="proctoring-body proctoring-warning-detail">
            Exiting full-screen or switching tabs compromises the interview environment
            and is not permitted. Please return to full-screen mode immediately.
          </p>
          <div className="proctoring-warning-counter">
            <span className="proctoring-warning-badge">
              Warning {warningCount} / {maxWarnings}
            </span>
            {remaining > 0 && (
              <span className="proctoring-remaining">
                {remaining} violation{remaining !== 1 ? 's' : ''} remaining before session termination
              </span>
            )}
          </div>
          <button className="proctoring-btn proctoring-btn-warning" onClick={onDismissWarning}>
            Return to Full-Screen
          </button>
        </div>
      </div>
    );
  }

  // ── Terminated ──────────────────────────────────────────────────────────────
  if (phase === 'terminated') {
    return (
      <div className="proctoring-overlay proctoring-terminated" role="alertdialog" aria-modal="true">
        <div className="proctoring-card proctoring-card-terminated">
          <div className="proctoring-icon">🚫</div>
          <h2 className="proctoring-title">Session Terminated</h2>
          <p className="proctoring-body">
            Your interview session has been <strong>automatically terminated</strong> due to
            repeated security violations.
          </p>
          <p className="proctoring-body">
            Exiting full-screen mode multiple times compromises the integrity of the
            interview. The session has been securely saved. Please contact support if
            you believe this was an error.
          </p>
          <div className="proctoring-terminated-note">
            Session is being saved and closed…
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default InterviewProctoringOverlay;
