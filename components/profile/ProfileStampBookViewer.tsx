import React from 'react';
import { CaretLeft, CaretRight, LockSimple } from '@phosphor-icons/react';
import { ProfileStampCard } from './ProfileStampCard';
import type { ProfileStampGroup, ProfileStampProgress } from './profileStamps';

interface ProfileStampBookViewerLabels {
  pageIndicator: string;
  previousPage: string;
  nextPage: string;
  emptySlot: string;
}

interface ProfileStampBookViewerProps {
  stamps: ProfileStampProgress[];
  locale?: string;
  labels: ProfileStampBookViewerLabels;
  resolveGroupLabel: (group: ProfileStampGroup) => string;
  onPageChange?: (page: number) => void;
}

interface StampBookPage {
  group: ProfileStampGroup;
  groupLabel: string;
  slots: Array<ProfileStampProgress | null>;
}

type TurnDirection = 'next' | 'prev';
type TurnState = {
  from: number;
  to: number;
  direction: TurnDirection;
};

const GROUP_ORDER: ProfileStampGroup[] = ['trips', 'exploration', 'curation', 'social', 'momentum'];
const PAGE_SLOT_COUNT = 6;
const TURN_DURATION_MS = 520;
const TURN_SWAP_DELAY_MS = 220;

const sortGroupStamps = (stamps: ProfileStampProgress[]): ProfileStampProgress[] => {
  return [...stamps].sort((a, b) => {
    if (a.achieved !== b.achieved) return a.achieved ? -1 : 1;
    if ((a.achievedAt || 0) !== (b.achievedAt || 0)) return (b.achievedAt || 0) - (a.achievedAt || 0);
    return a.targetValue - b.targetValue;
  });
};

const toPageSlots = (groupStamps: ProfileStampProgress[]): Array<ProfileStampProgress | null> => {
  const slots: Array<ProfileStampProgress | null> = sortGroupStamps(groupStamps).slice(0, PAGE_SLOT_COUNT);
  while (slots.length < PAGE_SLOT_COUNT) slots.push(null);
  return slots;
};

const buildPages = (
  stamps: ProfileStampProgress[],
  resolveGroupLabel: (group: ProfileStampGroup) => string
): StampBookPage[] => {
  const pages = GROUP_ORDER.map((group) => {
    const groupStamps = stamps.filter((stamp) => stamp.definition.group === group);
    return {
      group,
      groupLabel: resolveGroupLabel(group),
      slots: toPageSlots(groupStamps),
    };
  });
  return pages.length > 0 ? pages : [{
    group: 'trips',
    groupLabel: resolveGroupLabel('trips'),
    slots: toPageSlots([]),
  }];
};

const StampPlaceholder: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex min-h-[170px] items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-3 text-slate-400">
    <LockSimple size={14} weight="duotone" />
    <span className="text-xs font-semibold">{label}</span>
  </div>
);

const StampBookSpread: React.FC<{
  page: StampBookPage;
  locale: string;
  emptySlotLabel: string;
}> = ({ page, locale, emptySlotLabel }) => {
  const leftSlots = page.slots.slice(0, 3);
  const rightSlots = page.slots.slice(3, 6);

  return (
    <section className="stamp-book-spread">
      <article className="stamp-book-page stamp-book-page--left">
        <div className="stamp-book-page-grid">
          {leftSlots.map((stamp, index) => stamp ? (
            <ProfileStampCard
              key={`page-left-${stamp.definition.id}-${index}`}
              stamp={stamp}
              locale={locale}
            />
          ) : (
            <StampPlaceholder
              key={`page-left-empty-${index}`}
              label={emptySlotLabel}
            />
          ))}
        </div>
      </article>

      <article className="stamp-book-page stamp-book-page--right">
        <div className="stamp-book-page-grid">
          {rightSlots.map((stamp, index) => stamp ? (
            <ProfileStampCard
              key={`page-right-${stamp.definition.id}-${index}`}
              stamp={stamp}
              locale={locale}
            />
          ) : (
            <StampPlaceholder
              key={`page-right-empty-${index}`}
              label={emptySlotLabel}
            />
          ))}
        </div>
      </article>
    </section>
  );
};

export const ProfileStampBookViewer: React.FC<ProfileStampBookViewerProps> = ({
  stamps,
  locale = 'en',
  labels,
  resolveGroupLabel,
  onPageChange,
}) => {
  const pages = React.useMemo(
    () => buildPages(stamps, resolveGroupLabel),
    [resolveGroupLabel, stamps]
  );
  const [activePage, setActivePage] = React.useState(0);
  const [turnState, setTurnState] = React.useState<TurnState | null>(null);
  const [bookOpened, setBookOpened] = React.useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
  const turnTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const swapTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updatePreference);
      return () => mediaQuery.removeEventListener('change', updatePreference);
    }
    mediaQuery.addListener(updatePreference);
    return () => mediaQuery.removeListener(updatePreference);
  }, []);

  React.useEffect(() => {
    if (prefersReducedMotion) {
      setBookOpened(true);
      return;
    }
    const raf = requestAnimationFrame(() => {
      setBookOpened(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [prefersReducedMotion]);

  React.useEffect(() => {
    setActivePage((current) => Math.min(current, pages.length - 1));
  }, [pages.length]);

  React.useEffect(() => {
    return () => {
      if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
      if (swapTimeoutRef.current) clearTimeout(swapTimeoutRef.current);
    };
  }, []);

  const startTurn = (direction: TurnDirection) => {
    if (turnState) return;
    const step = direction === 'next' ? 1 : -1;
    const nextPage = Math.min(Math.max(activePage + step, 0), pages.length - 1);
    if (nextPage === activePage) return;

    if (prefersReducedMotion) {
      setActivePage(nextPage);
      onPageChange?.(nextPage + 1);
      return;
    }

    setTurnState({
      from: activePage,
      to: nextPage,
      direction,
    });

    if (swapTimeoutRef.current) clearTimeout(swapTimeoutRef.current);
    if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);

    swapTimeoutRef.current = setTimeout(() => {
      setActivePage(nextPage);
      onPageChange?.(nextPage + 1);
    }, TURN_SWAP_DELAY_MS);

    turnTimeoutRef.current = setTimeout(() => {
      setTurnState(null);
    }, TURN_DURATION_MS);
  };

  const currentPage = pages[activePage];
  const pendingPage = turnState ? pages[turnState.to] : null;
  const canGoPrev = activePage > 0;
  const canGoNext = activePage < pages.length - 1;
  const pageIndicator = labels.pageIndicator
    .replace('{page}', String(activePage + 1))
    .replace('{total}', String(pages.length));

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{currentPage.groupLabel}</p>
        <p className="text-xs font-semibold text-slate-500 tabular-nums">{pageIndicator}</p>
      </div>

      <div className="stamp-book-stage">
        <div className={`stamp-book-sheet ${bookOpened ? 'stamp-book-sheet--opened' : 'stamp-book-sheet--opening'}`}>
          {!turnState ? (
            <StampBookSpread
              page={currentPage}
              locale={locale}
              emptySlotLabel={labels.emptySlot}
            />
          ) : (
            <>
              <div className={`stamp-book-turn-layer stamp-book-turn-layer--current stamp-book-turn-layer--${turnState.direction}-current`}>
                <StampBookSpread
                  page={pages[turnState.from]}
                  locale={locale}
                  emptySlotLabel={labels.emptySlot}
                />
              </div>
              {pendingPage ? (
                <div className={`stamp-book-turn-layer stamp-book-turn-layer--next stamp-book-turn-layer--${turnState.direction}-next`}>
                  <StampBookSpread
                    page={pendingPage}
                    locale={locale}
                    emptySlotLabel={labels.emptySlot}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => startTurn('prev')}
          disabled={!canGoPrev}
          className="stamp-book-hit-area stamp-book-hit-area--prev"
          aria-label={labels.previousPage}
        />
        <button
          type="button"
          onClick={() => startTurn('next')}
          disabled={!canGoNext}
          className="stamp-book-hit-area stamp-book-hit-area--next"
          aria-label={labels.nextPage}
        />
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => startTurn('prev')}
          disabled={!canGoPrev}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <CaretLeft size={14} weight="bold" />
          {labels.previousPage}
        </button>
        <button
          type="button"
          onClick={() => startTurn('next')}
          disabled={!canGoNext}
          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {labels.nextPage}
          <CaretRight size={14} weight="bold" />
        </button>
      </div>
    </section>
  );
};

