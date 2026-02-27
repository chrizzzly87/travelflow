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
  compact?: boolean;
  disableInitialOpenAnimation?: boolean;
}

interface StampBookSide {
  id: string;
  group: ProfileStampGroup | 'empty';
  groupLabel: string;
  slots: Array<ProfileStampProgress | null>;
}

interface StampBookSpreadPage {
  id: string;
  left: StampBookSide;
  right: StampBookSide;
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

const buildEmptySide = (id: string): StampBookSide => ({
  id,
  group: 'empty',
  groupLabel: '',
  slots: toPageSlots([]),
});

const buildSpreads = (
  stamps: ProfileStampProgress[],
  resolveGroupLabel: (group: ProfileStampGroup) => string
): StampBookSpreadPage[] => {
  const sides: StampBookSide[] = GROUP_ORDER.map((group) => {
    const groupStamps = stamps.filter((stamp) => stamp.definition.group === group);
    return {
      id: `group-${group}`,
      group,
      groupLabel: resolveGroupLabel(group),
      slots: toPageSlots(groupStamps),
    };
  });

  if (sides.length === 0) {
    sides.push(buildEmptySide('group-empty'));
  }

  const spreads: StampBookSpreadPage[] = [];
  for (let index = 0; index < sides.length; index += 2) {
    const left = sides[index] || buildEmptySide(`left-empty-${index}`);
    const right = sides[index + 1] || buildEmptySide(`right-empty-${index}`);
    spreads.push({
      id: `spread-${index / 2}`,
      left,
      right,
    });
  }

  return spreads;
};

const StampPlaceholder: React.FC<{ compact?: boolean }> = ({ compact = false }) => (
  <div
    className={[
      'flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-slate-400',
      compact ? 'p-3 gap-1.5' : '',
    ].join(' ')}
  >
    <LockSimple size={24} weight="duotone" className="text-slate-300" />
    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 opacity-80">Hidden</span>
    <span className="text-[10px] leading-relaxed text-slate-400 opacity-60">Keep traveling to discover more</span>
  </div>
);

const StampBookSideView: React.FC<{
  side: StampBookSide;
  locale: string;
  emptySlotLabel: string;
  compact?: boolean;
  position?: 'left' | 'right';
}> = ({ side, locale, emptySlotLabel, compact = false, position }) => (
  <article className={`stamp-book-page ${position ? `stamp-book-page--${position}` : ''}`}>
    {side.groupLabel ? (
      <header className="mb-2 border-b border-slate-200/80 pb-1 pt-1 text-center">
        <p className="text-xl font-bold tracking-tight text-slate-700">{side.groupLabel}</p>
      </header>
    ) : null}
    <div className="stamp-book-page-grid">
      {side.slots.map((stamp, slotIndex) => {
        const slotKey = `${side.id}-slot-${slotIndex}`;
        if (stamp) {
          return (
            <ProfileStampCard
              key={`${slotKey}-${stamp.definition.id}`}
              stamp={stamp}
              locale={locale}
              compact={compact}
            />
          );
        }
        return (
          <StampPlaceholder
            key={`${slotKey}-placeholder`}
            compact={compact}
          />
        );
      })}
    </div>
  </article>
);

export const ProfileStampBookViewer: React.FC<ProfileStampBookViewerProps> = ({
  stamps,
  locale = 'en',
  labels,
  resolveGroupLabel,
  onPageChange,
  compact = false,
  disableInitialOpenAnimation = false,
}) => {
  const spreads = React.useMemo(
    () => buildSpreads(stamps, resolveGroupLabel),
    [resolveGroupLabel, stamps]
  );
  const [activeSpread, setActiveSpread] = React.useState(0);
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
    if (disableInitialOpenAnimation || prefersReducedMotion) {
      setBookOpened(true);
      return;
    }
    const raf = requestAnimationFrame(() => {
      setBookOpened(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [disableInitialOpenAnimation, prefersReducedMotion]);

  React.useEffect(() => {
    setActiveSpread((current) => Math.min(current, spreads.length - 1));
  }, [spreads.length]);

  React.useEffect(() => {
    return () => {
      if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
      if (swapTimeoutRef.current) clearTimeout(swapTimeoutRef.current);
    };
  }, []);

  const startTurn = (direction: TurnDirection) => {
    if (turnState) return;
    const step = direction === 'next' ? 1 : -1;
    const nextSpread = Math.min(Math.max(activeSpread + step, 0), spreads.length - 1);
    if (nextSpread === activeSpread) return;

    if (prefersReducedMotion) {
      setActiveSpread(nextSpread);
      onPageChange?.(nextSpread + 1);
      return;
    }

    setTurnState({
      from: activeSpread,
      to: nextSpread,
      direction,
    });

    if (swapTimeoutRef.current) clearTimeout(swapTimeoutRef.current);
    if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);

    swapTimeoutRef.current = setTimeout(() => {
      setActiveSpread(nextSpread);
      onPageChange?.(nextSpread + 1);
    }, TURN_SWAP_DELAY_MS);

    turnTimeoutRef.current = setTimeout(() => {
      setTurnState(null);
    }, TURN_DURATION_MS);
  };

  const currentSpread = spreads[activeSpread];
  const pendingSpread = turnState ? spreads[turnState.to] : null;
  const canGoPrev = activeSpread > 0;
  const canGoNext = activeSpread < spreads.length - 1;
  const pageIndicator = labels.pageIndicator
    .replace('{page}', String(activeSpread + 1))
    .replace('{total}', String(spreads.length));

  const currentSpreadLabel = [currentSpread.left.groupLabel, currentSpread.right.groupLabel]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className={compact ? 'stamp-book stamp-book--compact space-y-3' : 'stamp-book space-y-3'}>
      <div className="stamp-book-stage">
        <div className={`stamp-book-sheet ${bookOpened ? 'stamp-book-sheet--opened' : 'stamp-book-sheet--opening'}`}>
          {!turnState ? (
            <div className="stamp-book-spread stamp-book-spread--base">
              <StampBookSideView
                position="left"
                side={currentSpread.left}
                locale={locale}
                emptySlotLabel={labels.emptySlot}
                compact={compact}
              />
              <StampBookSideView
                position="right"
                side={currentSpread.right}
                locale={locale}
                emptySlotLabel={labels.emptySlot}
                compact={compact}
              />
            </div>
          ) : (
            <>
              {/* Base Layer: Static pages underneath */}
              <div className="stamp-book-spread stamp-book-spread--base">
                <StampBookSideView
                  position="left"
                  side={turnState.direction === 'next' ? spreads[turnState.from].left : spreads[turnState.to].left}
                  locale={locale}
                  emptySlotLabel={labels.emptySlot}
                  compact={compact}
                />
                <StampBookSideView
                  position="right"
                  side={turnState.direction === 'next' ? spreads[turnState.to].right : spreads[turnState.from].right}
                  locale={locale}
                  emptySlotLabel={labels.emptySlot}
                  compact={compact}
                />
              </div>

              {/* Flipper: The turning page */}
              <div className={`stamp-book-flipper stamp-book-flipper--${turnState.direction}`}>
                <div className="stamp-book-flipper-face stamp-book-flipper-face--front">
                  <StampBookSideView
                    position={turnState.direction === 'next' ? "right" : "left"}
                    side={turnState.direction === 'next' ? spreads[turnState.from].right : spreads[turnState.from].left}
                    locale={locale}
                    emptySlotLabel={labels.emptySlot}
                    compact={compact}
                  />
                </div>
                <div className="stamp-book-flipper-face stamp-book-flipper-face--back">
                  <StampBookSideView
                    position={turnState.direction === 'next' ? "left" : "right"}
                    side={turnState.direction === 'next' ? spreads[turnState.to].left : spreads[turnState.to].right}
                    locale={locale}
                    emptySlotLabel={labels.emptySlot}
                    compact={compact}
                  />
                </div>
              </div>
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
