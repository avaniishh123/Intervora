import { appendFileSync } from 'fs';
const T = 'frontend/src/pages/CompanyInterviewPage.tsx';

appendFileSync(T, `
  // ── Phase: Company Selection ──────────────────────────────────────────
  if (phase === 'select-company') {
    return (
      <div className="ci-select-page">
        <div className="ci-select-header">
          <div className="ci-select-back" onClick={() => navigate(-1)}>Back</div>
          <div className="ci-select-title">
            <span className="ci-select-icon">Co.</span>
            <h1>Choose Your Company</h1>
            <p>Select a company to get tailored interview questions for <strong>{role}</strong></p>
          </div>
          <div className="ci-search-wrap">
            <span className="ci-search-icon">S</span>
            <input className="ci-search-input" type="text" placeholder="Search companies..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus />
            {searchQuery && (
              <button className="ci-search-clear" onClick={() => setSearchQuery('')}>x</button>
            )}
          </div>
        </div>

        <div className="ci-company-grid">
          {filteredCompanies.length === 0 && (
            <div className="ci-no-results">No companies match &quot;{searchQuery}&quot;</div>
          )}
          {filteredCompanies.map(company => (
            <button
              key={company.name}
              className={'ci-company-card' + (selectedCompany && selectedCompany.name === company.name ? ' selected' : '')}
              style={{ '--cc': company.color } as React.CSSProperties}
              onClick={() => setSelectedCompany(company)}
            >
              {selectedCompany && selectedCompany.name === company.name && (
                <span className="ci-co-check">v</span>
              )}
              <span className="ci-co-emoji"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 36, borderRadius: '50%', background: company.color + '22',
                  color: company.color, fontWeight: 700, fontSize: 12 }}>
                {company.icon}
              </span>
              <span className="ci-co-name">{company.name}</span>
              <span className="ci-co-tier" style={{ color: company.color }}>{company.tier}</span>
            </button>
          ))}
        </div>

        {selectedCompany && (
          <div className="ci-select-footer">
            <div className="ci-selected-preview">
              <span style={{ fontWeight: 700, color: selectedCompany.color }}>{selectedCompany.name}</span>
              <span className="ci-selected-role"> &middot; {role} &middot; {duration} min</span>
            </div>
            <button className="ci-start-btn" onClick={() => setPhase('precheck')}>
              Continue
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Phase: Pre-check ──────────────────────────────────────────────────
  if (phase === 'precheck') {
    const canStart = screenShared && isFullscreen;
    return (
      <div className="ci-setup">
        <div className="ci-setup-header">
          <div className="ci-setup-icon">Lock</div>
          <h1>Pre-Interview Check</h1>
          <p>Complete the steps below before your {companyName} interview begins.</p>
          <div className="ci-setup-role-chip">{role} &middot; {duration} min &middot; {totalQuestions} questions</div>
        </div>

        <div className="ci-archetype-grid" style={{ maxWidth: 560 }}>
          <div
            className={'ci-archetype-card' + (screenShared ? ' selected' : '')}
            style={{ '--ac': '#3b82f6' } as React.CSSProperties}
          >
            <div className="ci-archetype-icon">{screenShared ? 'OK' : 'Screen'}</div>
            <div className="ci-archetype-label">Screen Share</div>
            <div className="ci-archetype-desc">
              {screenShared
                ? 'Screen sharing is active.'
                : 'Share your screen to proceed. This ensures interview integrity.'}
            </div>
            {!screenShared && (
              <button className="ci-start-btn" style={{ marginTop: 8 }} onClick={handleShareScreen}>
                Share Screen
              </button>
            )}
          </div>

          <div
            className={'ci-archetype-card' + (isFullscreen ? ' selected' : '')}
            style={{ '--ac': '#8b5cf6' } as React.CSSProperties}
          >
            <div className="ci-archetype-icon">{isFullscreen ? 'OK' : 'Full'}</div>
            <div className="ci-archetype-label">Fullscreen Mode</div>
            <div className="ci-archetype-desc">
              {isFullscreen
                ? 'Fullscreen is active.'
                : 'Enter fullscreen to minimize distractions during the interview.'}
            </div>
            {!isFullscreen && (
              <button
                className="ci-start-btn"
                style={{ marginTop: 8, background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)' }}
                onClick={handleEnterFullscreen}
              >
                Enter Fullscreen
              </button>
            )}
          </div>
        </div>

        <div className="ci-setup-actions">
          <button className="ci-start-btn" disabled={!canStart} onClick={() => setPhase('interview')}>
            {canStart ? 'Start ' + companyName + ' Interview' : 'Complete steps above to continue'}
          </button>
        </div>
      </div>
    );
  }
`, 'utf8');
console.log('Part 4 written');
