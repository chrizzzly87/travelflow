import React, { useLayoutEffect } from 'react';

import {
  readDocumentTimeMs,
  readShellEpochMs,
  registerShellMounted,
  registerShellUnmounted,
} from '../../services/appBootstrapShellEpoch';
import type { TripRouteShellPreviewDay } from '../../services/tripRouteShellPreview';

type AppBootstrapShellVariant = 'marketing' | 'trip';
type AppBootstrapShellChromeMode = 'skeleton' | 'ghost';
type AppBootstrapShellSurfaceMode = 'default' | 'neutral';
type AppBootstrapShellPlannerLayout = 'horizontal' | 'vertical';

interface AppBootstrapShellProps {
  variant?: AppBootstrapShellVariant;
  testId?: string;
  shellState?: string;
  handoffReady?: boolean;
  chromeMode?: AppBootstrapShellChromeMode;
  surfaceMode?: AppBootstrapShellSurfaceMode;
  /** Mirrors the planner orientation the traveller last used. */
  plannerLayout?: AppBootstrapShellPlannerLayout;
  /** Width of the timeline pane in the horizontal layout, in pixels. */
  sidebarWidth?: number;
  /** Height of the timeline pane in the vertical layout, in pixels. */
  timelineHeight?: number;
  /** Real trip dates for the phone day strip, when this device already knows them. */
  previewDays?: TripRouteShellPreviewDay[] | null;
}

/** One day column in the timeline ruler, in pixels, at the default zoom. */
const TIMELINE_DAY_WIDTH = 48;

/** Enough columns to run past the widest pane the skeleton is shown in. */
const TIMELINE_DAYS = Array.from({ length: 26 }, (_, index) => index);

/** Stay lengths in days, so the city row reads as a real itinerary. */
const TIMELINE_CITY_SPANS = [3, 2, 4, 3, 3, 2];

/** Day bubbles to draw when the dates are not known yet. */
const SHEET_PLACEHOLDER_DAYS = Array.from({ length: 8 }, (_, index) => index);

/** Rows in the sheet's day panel, as fractions of its width. */
const SHEET_CONTENT_ROWS = [
  { title: '62%', meta: '38%' },
  { title: '48%', meta: '54%' },
  { title: '70%', meta: '32%' },
];

/**
 * The phone planner is a bottom sheet over the map, not the desktop split, so
 * the placeholder carries both and lets the stylesheet choose. Rendering both
 * avoids measuring the viewport in JS, which would either block the first paint
 * or show the wrong one for a frame.
 */
const TripPlannerSheetSkeleton: React.FC<{
  previewDays?: TripRouteShellPreviewDay[] | null;
}> = ({ previewDays }) => (
  <section className="tf-boot-sheet" aria-hidden="true">
    <span className="tf-boot-sheet-grip" />
    <div className="tf-boot-sheet-head">
      <span className="tf-boot-sheet-segmented">
        <span className="tf-bone tf-boot-sheet-segment tf-boot-sheet-segment--active" />
        <span className="tf-bone tf-boot-sheet-segment" style={{ '--tf-bone-phase': 1 } as React.CSSProperties} />
      </span>
      <span className="tf-bone tf-boot-sheet-toggle" style={{ '--tf-bone-phase': 2 } as React.CSSProperties} />
    </div>
    <div className="tf-boot-sheet-strip">
      {previewDays && previewDays.length > 0
        ? previewDays.map((day, index) => (
          <span key={`day-${index}`} className="tf-boot-sheet-day">
            <span className="tf-boot-sheet-day-month">{day.isMonthStart ? day.monthLabel : ''}</span>
            <span className="tf-boot-sheet-day-bubble tf-boot-sheet-day-bubble--dated">
              <span className="tf-boot-sheet-day-weekday">{day.weekdayLabel}</span>
              <span className="tf-boot-sheet-day-number">{day.dayOfMonthLabel}</span>
            </span>
            <span className="tf-boot-sheet-day-foot" />
          </span>
        ))
        : SHEET_PLACEHOLDER_DAYS.map((index) => (
          <span key={`day-${index}`} className="tf-boot-sheet-day">
            <span className="tf-boot-sheet-day-month" />
            <span
              className="tf-bone tf-boot-sheet-day-bubble"
              style={{ '--tf-bone-phase': index } as React.CSSProperties}
            />
            <span className="tf-boot-sheet-day-foot" />
          </span>
        ))}
    </div>
    <div className="tf-boot-sheet-content">
      {SHEET_CONTENT_ROWS.map((row, index) => (
        <span key={`row-${index}`} className="tf-boot-sheet-row">
          <span
            className="tf-bone tf-boot-sheet-row-icon"
            style={{ '--tf-bone-phase': index } as React.CSSProperties}
          />
          <span className="tf-boot-sheet-row-copy">
            <span
              className="tf-bone tf-boot-sheet-row-line"
              style={{ width: row.title, '--tf-bone-phase': index } as React.CSSProperties}
            />
            <span
              className="tf-bone tf-boot-sheet-row-line tf-boot-sheet-row-line--meta"
              style={{ width: row.meta, '--tf-bone-phase': index + 1 } as React.CSSProperties}
            />
          </span>
        </span>
      ))}
    </div>
  </section>
);

const TripPlannerSkeleton: React.FC<{
  plannerLayout: AppBootstrapShellPlannerLayout;
  sidebarWidth?: number;
  timelineHeight?: number;
  previewDays?: TripRouteShellPreviewDay[] | null;
}> = ({ plannerLayout, sidebarWidth, timelineHeight, previewDays }) => {
  const plannerStyle = {
    ...(typeof sidebarWidth === 'number' ? { '--tf-boot-sidebar-width': `${sidebarWidth}px` } : {}),
    ...(typeof timelineHeight === 'number' ? { '--tf-boot-timeline-height': `${timelineHeight}px` } : {}),
  } as React.CSSProperties;

  return (
    <main className="tf-boot-planner" data-tf-boot-layout={plannerLayout} style={plannerStyle}>
      <section className="tf-boot-planner-timeline">
        <div className="tf-boot-tl-track">
          <div className="tf-boot-tl-months">
            <div className="tf-boot-tl-month" style={{ width: 12 * TIMELINE_DAY_WIDTH }}><span /></div>
            <div className="tf-boot-tl-month" style={{ width: 14 * TIMELINE_DAY_WIDTH }}><span /></div>
          </div>
          <div className="tf-boot-tl-days">
            {TIMELINE_DAYS.map((day) => (
              <span key={day} className="tf-boot-tl-day"><span /></span>
            ))}
          </div>
          <div className="tf-boot-tl-body">
            <div className="tf-bone tf-boot-tl-label tf-boot-tl-label--cities" />
            <div className="tf-boot-tl-cities">
              {TIMELINE_CITY_SPANS.map((span, index) => (
                <span
                  key={`city-${index}`}
                  className="tf-bone tf-boot-tl-city"
                  style={{
                    width: span * TIMELINE_DAY_WIDTH - 2,
                    '--tf-bone-phase': index,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="tf-boot-tl-controls">
          <span className="tf-boot-tl-control-group">
            <span className="tf-bone tf-boot-tl-control tf-boot-tl-control--accent" />
            <span className="tf-bone tf-boot-tl-control" style={{ '--tf-bone-phase': 1 } as React.CSSProperties} />
          </span>
          <span className="tf-boot-tl-control-group">
            <span className="tf-bone tf-boot-tl-control" style={{ '--tf-bone-phase': 2 } as React.CSSProperties} />
            <span className="tf-bone tf-boot-tl-control-readout" />
            <span className="tf-bone tf-boot-tl-control" style={{ '--tf-bone-phase': 3 } as React.CSSProperties} />
          </span>
          <span className="tf-boot-tl-control-group">
            <span
              className="tf-bone tf-boot-tl-control tf-boot-tl-control--accent"
              style={{ '--tf-bone-phase': 4 } as React.CSSProperties}
            />
            <span className="tf-bone tf-boot-tl-control" style={{ '--tf-bone-phase': 5 } as React.CSSProperties} />
          </span>
        </div>
      </section>
      <div className="tf-boot-planner-grip" />
      <section className="tf-boot-planner-map">
        <div className="tf-boot-map-controls">
          <span className="tf-boot-map-control" />
          <span className="tf-boot-map-control" />
          <span className="tf-boot-map-control" />
          <span className="tf-boot-map-control tf-boot-map-control--accent" />
        </div>
      </section>
      <TripPlannerSheetSkeleton previewDays={previewDays} />
    </main>
  );
};

export const AppBootstrapShell: React.FC<AppBootstrapShellProps> = ({
  variant = 'marketing',
  testId,
  shellState,
  handoffReady = false,
  chromeMode = 'skeleton',
  surfaceMode = 'default',
  plannerLayout = 'horizontal',
  sidebarWidth,
  timelineHeight,
  previewDays,
}) => {
  // Read before the effect registers this mount: on the first shell of an
  // episode the epoch is 0, on the remounts that follow it is however long the
  // placeholder has already been on screen. See services/appBootstrapShellEpoch.
  const epochMs = Math.round(readShellEpochMs());
  // The sweep is a loop, so anchoring it to document time keeps every shell —
  // including the static one in index.html — in the same phase. Only the
  // entrance fade needs the per-episode clock.
  const documentTimeMs = Math.round(readDocumentTimeMs());

  useLayoutEffect(() => {
    registerShellMounted();
    return registerShellUnmounted;
  }, []);

  return (
  <div
    className="tf-boot-shell"
    data-testid={testId}
    data-shell-variant={variant}
    data-shell-state={shellState}
    data-tf-chrome-mode={chromeMode}
    data-tf-surface-mode={surfaceMode}
    data-tf-handoff-ready={handoffReady ? 'true' : undefined}
    style={{
      '--tf-boot-epoch': `${epochMs}ms`,
      '--tf-boot-sweep-epoch': `${documentTimeMs}ms`,
    } as React.CSSProperties}
    aria-hidden="true"
  >
    {variant === 'trip' ? (
      <header className="tf-boot-trip-header tf-boot-header--trip">
        <div className="tf-boot-trip-header-inner">
          <div className="tf-boot-trip-header-start">
            <div className="tf-boot-trip-brand">
              <span className="tf-boot-logo-frame">
                <img className="tf-boot-logo-image" src="/brand-plane.svg" alt="" />
              </span>
              <span className="tf-boot-wordmark">TravelFlow</span>
            </div>
            <div className="tf-boot-trip-divider" aria-hidden="true" />
            <div className="tf-boot-trip-copy" aria-hidden="true">
              <div className="tf-bone tf-boot-line tf-boot-line--trip-title" />
              <div
                className="tf-bone tf-boot-line tf-boot-line--trip-meta"
                style={{ '--tf-bone-phase': 1 } as React.CSSProperties}
              />
            </div>
          </div>
          <div className="tf-boot-trip-header-actions" aria-hidden="true">
            <span
              className="tf-bone tf-boot-trip-action-pill"
              style={{ '--tf-bone-phase': 2 } as React.CSSProperties}
            />
            <span
              className="tf-bone tf-boot-trip-action-primary"
              style={{ '--tf-bone-phase': 3 } as React.CSSProperties}
            />
          </div>
        </div>
      </header>
    ) : (
      <header className="tf-boot-header tf-boot-header--marketing">
        <div className="tf-boot-header-inner">
          <div className="tf-boot-brand">
            <span className="tf-boot-logo-frame">
              <img className="tf-boot-logo-image" src="/brand-plane.svg" alt="" />
            </span>
            <span className="tf-boot-wordmark">TravelFlow</span>
          </div>
          <nav className="tf-boot-nav" aria-hidden="true">
            {chromeMode === 'skeleton' ? (
              <>
                <span className="tf-boot-nav-link"><span className="tf-bone tf-boot-nav-skeleton tf-boot-nav-skeleton--features"></span></span>
                <span className="tf-boot-nav-link"><span className="tf-bone tf-boot-nav-skeleton tf-boot-nav-skeleton--inspirations"></span></span>
                <span className="tf-boot-nav-link"><span className="tf-bone tf-boot-nav-skeleton tf-boot-nav-skeleton--updates"></span></span>
                <span className="tf-boot-nav-link"><span className="tf-bone tf-boot-nav-skeleton tf-boot-nav-skeleton--blog"></span></span>
                <span className="tf-boot-nav-link"><span className="tf-bone tf-boot-nav-skeleton tf-boot-nav-skeleton--pricing"></span></span>
              </>
            ) : chromeMode === 'ghost' ? (
              <>
                <span className="tf-boot-nav-link tf-boot-nav-link--ghost"><span className="tf-boot-nav-ghost tf-boot-nav-ghost--features"></span></span>
                <span className="tf-boot-nav-link tf-boot-nav-link--ghost"><span className="tf-boot-nav-ghost tf-boot-nav-ghost--inspirations"></span></span>
                <span className="tf-boot-nav-link tf-boot-nav-link--ghost"><span className="tf-boot-nav-ghost tf-boot-nav-ghost--updates"></span></span>
                <span className="tf-boot-nav-link tf-boot-nav-link--ghost"><span className="tf-boot-nav-ghost tf-boot-nav-ghost--blog"></span></span>
                <span className="tf-boot-nav-link tf-boot-nav-link--ghost"><span className="tf-boot-nav-ghost tf-boot-nav-ghost--pricing"></span></span>
              </>
            ) : null}
          </nav>
          <div className="tf-boot-actions">
            {chromeMode === 'skeleton' ? (
              <>
                <span className="tf-boot-action-chip tf-boot-action-chip--locale">
                  <span className="tf-bone tf-boot-control-flag" aria-hidden="true"></span>
                  <span className="tf-bone tf-boot-control-skeleton tf-boot-control-skeleton--locale"></span>
                </span>
                <span className="tf-boot-action-chip tf-boot-action-chip--login">
                  <span className="tf-bone tf-boot-control-skeleton tf-boot-control-skeleton--login"></span>
                </span>
                <span className="tf-boot-action-button">
                  <span className="tf-bone tf-boot-control-skeleton tf-boot-control-skeleton--cta"></span>
                </span>
              </>
            ) : chromeMode === 'ghost' ? (
              <>
                <span className="tf-boot-action-chip tf-boot-action-chip--locale tf-boot-action-chip--ghost" />
                <span className="tf-boot-action-chip tf-boot-action-chip--login tf-boot-action-chip--ghost" />
                <span className="tf-boot-action-button tf-boot-action-button--ghost" />
              </>
            ) : null}
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
    )}
    {variant === 'trip' ? (
      <TripPlannerSkeleton
        plannerLayout={plannerLayout}
        sidebarWidth={sidebarWidth}
        timelineHeight={timelineHeight}
        previewDays={previewDays}
      />
    ) : null}
  </div>
  );
};
