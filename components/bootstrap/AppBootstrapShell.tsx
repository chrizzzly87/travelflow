import React from 'react';

type AppBootstrapShellVariant = 'marketing' | 'trip';

interface AppBootstrapShellProps {
  variant?: AppBootstrapShellVariant;
  testId?: string;
  shellState?: string;
  handoffReady?: boolean;
}

const TRIP_DAYS = [0, 1, 2, 3, 4];
const TRIP_BLOCKS = [0, 1, 2];

export const AppBootstrapShell: React.FC<AppBootstrapShellProps> = ({
  variant = 'marketing',
  testId,
  shellState,
  handoffReady = false,
}) => (
  <div
    className="tf-boot-shell"
    data-testid={testId}
    data-shell-variant={variant}
    data-shell-state={shellState}
    data-tf-handoff-ready={handoffReady ? 'true' : undefined}
    aria-hidden="true"
  >
    <header className="tf-boot-header">
      <div className="tf-boot-header-inner">
        <div className="tf-boot-brand">
          <span className="tf-boot-logo-frame">
            <img className="tf-boot-logo-image" src="/favicon.svg" alt="" />
          </span>
          <span className="tf-boot-wordmark">TravelFlow</span>
        </div>
        <nav className="tf-boot-nav" aria-hidden="true">
          <span className="tf-boot-nav-link"><span className="tf-boot-nav-skeleton tf-boot-nav-skeleton--features"></span></span>
          <span className="tf-boot-nav-link"><span className="tf-boot-nav-skeleton tf-boot-nav-skeleton--inspirations"></span></span>
          <span className="tf-boot-nav-link"><span className="tf-boot-nav-skeleton tf-boot-nav-skeleton--updates"></span></span>
          <span className="tf-boot-nav-link"><span className="tf-boot-nav-skeleton tf-boot-nav-skeleton--blog"></span></span>
          <span className="tf-boot-nav-link"><span className="tf-boot-nav-skeleton tf-boot-nav-skeleton--pricing"></span></span>
        </nav>
        <div className="tf-boot-actions">
          <span className="tf-boot-action-chip tf-boot-action-chip--locale">
            <span className="tf-boot-control-flag" aria-hidden="true"></span>
            <span className="tf-boot-control-skeleton tf-boot-control-skeleton--locale"></span>
          </span>
          <span className="tf-boot-action-chip tf-boot-action-chip--login">
            <span className="tf-boot-control-skeleton tf-boot-control-skeleton--login"></span>
          </span>
          <span className="tf-boot-action-button">
            <span className="tf-boot-control-skeleton tf-boot-control-skeleton--cta"></span>
          </span>
          <span className="tf-boot-action-burger" aria-hidden="true">
            <svg className="tf-boot-action-burger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          </span>
        </div>
      </div>
    </header>
    {variant === 'trip' ? (
      <main className="tf-boot-main">
        <section className="tf-boot-page tf-boot-page--trip tf-boot-page--trip-react">
          <div className="tf-boot-trip-status" />
          <div className="tf-boot-trip-summary">
            <div className="tf-boot-trip-summary-copy">
              <div className="tf-boot-line tf-boot-line--headline" style={{ width: 'min(420px,72%)' }} />
              <div className="tf-boot-line tf-boot-line--body-md" style={{ width: 'min(300px,56%)' }} />
            </div>
            <div className="tf-boot-trip-toolbar" aria-hidden="true">
              <span className="tf-boot-trip-toolbar-pill" />
              <span className="tf-boot-trip-toolbar-pill" />
              <span className="tf-boot-trip-toolbar-pill" />
            </div>
          </div>
          <div className="tf-boot-trip-layout">
            <section className="tf-boot-trip-canvas" aria-hidden="true">
              <div className="tf-boot-trip-grid">
                {TRIP_DAYS.map((day) => (
                  <div key={day} className="tf-boot-trip-day" />
                ))}
              </div>
              <div className="tf-boot-trip-body">
                {TRIP_BLOCKS.map((block) => (
                  <div
                    key={block}
                    className={`tf-boot-trip-block${block === 1 ? ' tf-boot-trip-block--thin' : ''}`}
                  />
                ))}
              </div>
            </section>
            <aside className="tf-boot-trip-sidebar" aria-hidden="true">
              <div className="tf-boot-trip-side-card tf-boot-trip-side-card--map" />
              <div className="tf-boot-metrics">
                <div className="tf-boot-metric" />
                <div className="tf-boot-metric" />
              </div>
            </aside>
          </div>
        </section>
      </main>
    ) : null}
  </div>
);
