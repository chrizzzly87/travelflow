import React from 'react';
import { LockSimple, SealCheck } from '@phosphor-icons/react';
import type { ProfileStampProgress } from './profileStamps';

interface ProfileStampCardProps {
  stamp: ProfileStampProgress;
  selected?: boolean;
  onSelect?: (stamp: ProfileStampProgress) => void;
  onHover?: (stamp: ProfileStampProgress) => void;
  locale?: string;
  unlockedOnLabel?: string;
}

type StampVisualState = {
  tiltX: number;
  tiltY: number;
  shineX: number;
  shineY: number;
  shineOpacity: number;
};

const INITIAL_VISUAL_STATE: StampVisualState = {
  tiltX: 0,
  tiltY: 0,
  shineX: 50,
  shineY: 50,
  shineOpacity: 0.2,
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

export const ProfileStampCard: React.FC<ProfileStampCardProps> = ({
  stamp,
  selected = false,
  onSelect,
  onHover,
  locale = 'en',
  unlockedOnLabel = 'Unlocked',
}) => {
  const [visualState, setVisualState] = React.useState<StampVisualState>(INITIAL_VISUAL_STATE);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const [isTapExpanded, setIsTapExpanded] = React.useState(false);

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

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (prefersReducedMotion) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;

    const relativeX = clamp((event.clientX - bounds.left) / bounds.width, 0, 1);
    const relativeY = clamp((event.clientY - bounds.top) / bounds.height, 0, 1);
    const tiltX = (0.5 - relativeY) * 10;
    const tiltY = (relativeX - 0.5) * 12;

    setVisualState({
      tiltX,
      tiltY,
      shineX: Math.round(relativeX * 100),
      shineY: Math.round(relativeY * 100),
      shineOpacity: 0.65,
    });
  };

  const resetVisualState = () => {
    setVisualState(INITIAL_VISUAL_STATE);
  };

  const detailsVisible = selected || isHovered || isFocused || isTapExpanded;

  const unlockedAtLabel = stamp.achievedAt
    ? new Date(stamp.achievedAt).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    : null;

  return (
    <button
      type="button"
      onPointerMove={handlePointerMove}
      onPointerEnter={() => {
        setIsHovered(true);
        onHover?.(stamp);
      }}
      onPointerLeave={() => {
        setIsHovered(false);
        resetVisualState();
      }}
      onBlur={resetVisualState}
      onFocus={() => {
        setIsFocused(true);
        onHover?.(stamp);
      }}
      onBlurCapture={() => {
        setIsFocused(false);
        setIsTapExpanded(false);
      }}
      onClick={() => {
        if (onSelect) {
          onSelect(stamp);
          return;
        }
        setIsTapExpanded((current) => !current);
      }}
      className={[
        'profile-stamp-card group relative overflow-hidden rounded-xl border bg-white text-left',
        selected ? 'border-accent-300 shadow-md shadow-accent-100/60' : 'border-slate-200',
      ].join(' ')}
      style={{
        '--stamp-tilt-x': `${prefersReducedMotion ? 0 : visualState.tiltX}deg`,
        '--stamp-tilt-y': `${prefersReducedMotion ? 0 : visualState.tiltY}deg`,
        '--stamp-shine-x': `${visualState.shineX}%`,
        '--stamp-shine-y': `${visualState.shineY}%`,
        '--stamp-shine-opacity': prefersReducedMotion ? 0.2 : visualState.shineOpacity,
      } as React.CSSProperties}
      aria-pressed={selected}
    >
      <div className={`relative aspect-square overflow-hidden ${stamp.achieved ? '' : 'grayscale opacity-70'}`}>
        <img
          src={stamp.definition.assetPath}
          alt={stamp.definition.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <span className="pointer-events-none absolute inset-0 bg-slate-950/5" />
      </div>

      <div className="space-y-1 border-t border-slate-100 px-3 py-2.5">
        <p className="line-clamp-1 text-sm font-semibold text-slate-900">{stamp.definition.title}</p>
        <p className="line-clamp-2 text-xs text-slate-500">{stamp.definition.subtitle}</p>
      </div>

      <div
        className={[
          'pointer-events-none absolute inset-x-0 bottom-0 border-t border-slate-200 bg-white/96 p-2.5 backdrop-blur-sm transition-all duration-200',
          detailsVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        ].join(' ')}
        aria-hidden={!detailsVisible}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
            {stamp.achieved ? <SealCheck size={13} weight="duotone" className="text-emerald-600" /> : <LockSimple size={13} weight="duotone" />}
            {stamp.achieved ? 'Unlocked' : `${Math.floor(stamp.currentValue)}/${stamp.targetValue}`}
          </span>
          <span className="text-[11px] font-semibold text-slate-600">
            {stamp.definition.rarityPercent}% rarity
          </span>
        </div>
        {unlockedAtLabel && (
          <p className="mt-1 text-[11px] font-medium text-slate-600">
            {unlockedOnLabel}: {unlockedAtLabel}
          </p>
        )}
      </div>
    </button>
  );
};
