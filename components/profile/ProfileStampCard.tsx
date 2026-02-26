import React from 'react';
import { LockSimple, SealCheck } from '@phosphor-icons/react';
import type { ProfileStampProgress } from './profileStamps';

interface ProfileStampCardProps {
  stamp: ProfileStampProgress;
  selected?: boolean;
  onSelect?: (stamp: ProfileStampProgress) => void;
  onHover?: (stamp: ProfileStampProgress) => void;
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
}) => {
  const [visualState, setVisualState] = React.useState<StampVisualState>(INITIAL_VISUAL_STATE);

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
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

  return (
    <button
      type="button"
      onPointerMove={handlePointerMove}
      onPointerLeave={resetVisualState}
      onBlur={resetVisualState}
      onMouseEnter={() => onHover?.(stamp)}
      onFocus={() => onHover?.(stamp)}
      onClick={() => onSelect?.(stamp)}
      className={[
        'profile-stamp-card group relative overflow-hidden rounded-xl border bg-white text-left',
        selected ? 'border-accent-300 shadow-md shadow-accent-100/60' : 'border-slate-200',
      ].join(' ')}
      style={{
        '--stamp-tilt-x': `${visualState.tiltX}deg`,
        '--stamp-tilt-y': `${visualState.tiltY}deg`,
        '--stamp-shine-x': `${visualState.shineX}%`,
        '--stamp-shine-y': `${visualState.shineY}%`,
        '--stamp-shine-opacity': visualState.shineOpacity,
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
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500">
            {stamp.achieved ? <SealCheck size={13} weight="duotone" className="text-emerald-600" /> : <LockSimple size={13} weight="duotone" />}
            {stamp.achieved ? 'Unlocked' : `${Math.floor(stamp.currentValue)}/${stamp.targetValue}`}
          </span>
          <span className="text-[11px] font-semibold text-slate-500">
            {stamp.definition.rarityPercent}% rarity
          </span>
        </div>
      </div>
    </button>
  );
};
