import { appendFileSync } from 'fs';
const T = 'frontend/src/pages/CompanyInterviewPage.tsx';

appendFileSync(T, `
  // ── Phase: Interview Room ─────────────────────────────────────────────
  return (
    <div className="ci-room">
      <header className="ci-topbar">
        <div className="ci-topbar-left">
          <div
            className="ci-mode-badge"
            style={{ background: companyColor + '33', color: companyColor, border: '1px solid ' + companyColor + '55' }}
          >
            {companyName} Interview
          </div>
          <div className="ci-role-chip">{role}</div>
          <div className="ci-round-indicator">
            Q <strong>{Math.min(questionCount + 1, totalQuestions)}</strong> / {totalQuestions}
          </div>
          {voice.isSpeaking && activePanelMember && (
            <div
              className="ci-speaking-pill"
              style={{ background: activePanelMember.color + '22', border: '1px solid ' + activePanelMember.color + '55', color: activePanelMember.color }}
            >
              <span className="ci-wave"><span /><span /><span /></span>
              {activePanelMember.name} speaking
            </div>
          )}
          {voice.isListening && (
            <div className="ci-listening-pill">
              <span className="ci-wave"><span /><span /><span /></span>
              Listening...
            </div>
          )}
        </div>

        <div className="ci-topbar-center">
          <div className="ci-timer-ring">
            <svg viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="#1e293b" strokeWidth="4" />
              <circle
                cx="22" cy="22" r="18" fill="none" stroke={timerColor} strokeWidth="4"
                strokeDasharray={String((timerPct / 100) * 113) + ' 113'}
                strokeLinecap="round" transform="rotate(-90 22 22)"
                style={{ transition: 'stroke-dasharray 1s linear' }}
              />
            </svg>
            <span style={{ color: timerColor }}>{formatTime(timeRemaining)}</span>
          </div>
        </div>

        <button className="ci-end-btn" onClick={handleEnd}>End Interview</button>
      </header>

      <div className="ci-body">
        <aside className={'ci-left' + (leftCollapsed ? ' ci-left--collapsed' : '')}>
          <button
            className="ci-collapse-btn"
            onClick={() => setLeftCollapsed(v => !v)}
            aria-label={leftCollapsed ? 'Expand' : 'Collapse'}
          >
            {leftCollapsed ? '>' : '<'}
          </button>

          {!leftCollapsed && (
            <>
              <div className="ci-section-label" style={{ marginTop: 44 }}>Panel</div>
              {PANEL.map(p => {
                const isTTSSpeaking = voice.activeVoiceSpeaker === p.id;
                const isActive = activeSpeaker === p.id || isTTSSpeaking;
                return (
                  <div
                    key={p.id}
                    className={'ci-iv-card' + (isActive ? ' active' : '')}
                    style={{ '--ic': p.color } as React.CSSProperties}
                  >
                    <div
                      className="ci-iv-avatar"
                      style={{ background: p.color + '22', border: '2px solid ' + (isActive ? p.color : 'transparent') }}
                    >
                      {p.avatar}
                    </div>
                    <div className="ci-iv-info">
                      <div className="ci-iv-name">{p.name}</div>
                      <div className="ci-iv-title" style={{ color: p.color }}>{p.title}</div>
                    </div>
                    {isActive && (isThinking || isTTSSpeaking) && (
                      <div className="ci-dots"><span /><span /><span /></div>
                    )}
                  </div>
                );
              })}

              <div className="ci-section-label" style={{ marginTop: 16 }}>Progress</div>
              <div className="ci-progress-bar-wrap">
                <div
                  className="ci-progress-bar"
                  style={{ width: String(Math.round((questionCount / totalQuestions) * 100)) + '%', background: companyColor }}
                />
              </div>
              <div className="ci-progress-text">{questionCount} / {totalQuestions} questions</div>

              <div className="ci-section-label" style={{ marginTop: 16 }}>You</div>
              <div className={'ci-camera-wrap' + (voice.isListening ? ' ci-camera-wrap--listening' : '')}>
                <video
                  ref={cameraRef} autoPlay playsInline muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px', background: '#0f172a' }}
                />
              </div>
            </>
          )}

          {leftCollapsed && (
            <div style={{ marginTop: 52 }}>
              {PANEL.map(p => {
                const isActive = activeSpeaker === p.id || voice.activeVoiceSpeaker === p.id;
                return (
                  <div
                    key={p.id}
                    className="ci-collapsed-avatar"
                    title={p.name}
                    style={{ background: isActive ? p.color : p.color + '22', margin: '8px auto' }}
                  >
                    {p.avatar}
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        <main className="ci-workspace">
          <div className="ci-chat-area">
            {messages.map((m, i) => {
              const pm = PANEL.find(p => p.id === m.from);
              const msgClass = m.from === 'candidate' ? 'candidate' : m.from === 'system' ? 'system' : 'interviewer';
              return (
                <div key={i} className={'ci-msg ci-msg--' + msgClass}>
                  {pm && (
                    <div className="ci-msg-avatar" style={{ background: pm.color + '22' }}>
                      {pm.avatar}
                    </div>
                  )}
                  <div className="ci-msg-content">
                    {pm && (
                      <div className="ci-msg-meta">
                        <span className="ci-msg-name">{pm.name}</span>
                        <span className="ci-msg-title" style={{ color: pm.color }}>{pm.title}</span>
                        {m.isCross && (
                          <span className="ci-round-badge" style={{ background: pm.color + '22', color: pm.color }}>
                            Follow-up
                          </span>
                        )}
                      </div>
                    )}
                    <div className="ci-msg-bubble">{m.text}</div>
                  </div>
                </div>
              );
            })}

            {isThinking && (
              <div className="ci-msg ci-msg--interviewer">
                <div
                  className="ci-msg-avatar"
                  style={{ background: PANEL[currentPanel % PANEL.length].color + '22' }}
                >
                  {PANEL[currentPanel % PANEL.length].avatar}
                </div>
                <div className="ci-msg-content">
                  <div className="ci-typing-indicator"><span /><span /><span /></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {!sessionEnded && (
            <div className="ci-answer-area">
              <div className="ci-mode-toggle">
                <button
                  className={'ci-mode-tab' + (voice.responseMode === 'text' ? ' active' : '')}
                  onClick={() => handleToggleResponseMode('text')}
                >
                  Text
                </button>
                <button
                  className={'ci-mode-tab' + (voice.responseMode === 'voice' ? ' active' : '')}
                  onClick={() => handleToggleResponseMode('voice')}
                  disabled={!voice.sttSupported}
                >
                  Voice
                </button>
              </div>

              <div className="ci-input-wrap">
                <textarea
                  ref={answerRef}
                  className={'ci-answer-input' + (voice.responseMode === 'voice' ? ' ci-answer-input--voice' : '')}
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSubmitAnswer(); }}
                  placeholder={
                    voice.responseMode === 'voice'
                      ? (voice.isListening ? 'Listening... speak your answer' : 'Click the mic to start speaking')
                      : 'Type your answer here... (Ctrl+Enter to submit)'
                  }
                  rows={4}
                  readOnly={voice.responseMode === 'voice' && voice.isListening}
                />
                {voice.responseMode === 'voice' && (
                  <button
                    className={'ci-mic-btn' + (voice.isListening ? ' ci-mic-btn--active' : '')}
                    onClick={handleMicToggle}
                    disabled={voice.isSpeaking}
                    aria-label={voice.isListening ? 'Stop microphone' : 'Start microphone'}
                  >
                    {voice.isListening
                      ? <><span>Mic</span><span className="ci-mic-pulse" /></>
                      : <span>Mic</span>}
                  </button>
                )}
              </div>

              {voice.error && <div className="ci-voice-error">{voice.error}</div>}

              <div className="ci-answer-footer">
                <span className="ci-answer-hint">
                  {voice.responseMode === 'voice'
                    ? 'Speak your answer, edit if needed, then submit'
                    : 'Ctrl+Enter to submit'}
                </span>
                <button
                  className="ci-submit-btn"
                  style={{ background: 'linear-gradient(135deg,' + companyColor + ',' + companyColor + 'cc)' }}
                  onClick={handleSubmitAnswer}
                  disabled={!answer.trim()}
                >
                  Submit Answer
                </button>
              </div>
            </div>
          )}

          {sessionEnded && (
            <div className="ci-ended-banner">
              Interview complete - redirecting to your report...
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
`, 'utf8');
console.log('Part 5 written');
