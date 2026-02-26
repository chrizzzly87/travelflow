import React from 'react';
import { SealCheck } from '@phosphor-icons/react';
import { getPassportCoverTheme } from '../../services/passportService';
import type { PassportStickerPosition, ProfileStampProgress } from './profileStamps';
import {
  PROFILE_PASSPORT_CANVAS_HEIGHT,
  PROFILE_PASSPORT_CANVAS_WIDTH,
  PROFILE_PASSPORT_STICKER_HEIGHT,
  PROFILE_PASSPORT_STICKER_WIDTH,
  getDefaultPassportStickerPosition,
} from './profileStamps';

interface ProfilePassportBookProps {
  title: string;
  description?: string;
  openLabel: string;
  emptyLabel: string;
  stamps: ProfileStampProgress[];
  countryCode?: string | null;
  stickerPositions?: Record<string, PassportStickerPosition>;
  onOpen?: () => void;
  testId?: string;
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const resolvePosition = (
  stampId: string,
  index: number,
  positions?: Record<string, PassportStickerPosition>
): PassportStickerPosition => {
  const saved = positions?.[stampId];
  const fallback = getDefaultPassportStickerPosition(index);
  if (!saved) return fallback;
  return {
    x: clamp(saved.x, 8, PROFILE_PASSPORT_CANVAS_WIDTH - PROFILE_PASSPORT_STICKER_WIDTH),
    y: clamp(saved.y, 8, PROFILE_PASSPORT_CANVAS_HEIGHT - PROFILE_PASSPORT_STICKER_HEIGHT),
  };
};

export const ProfilePassportBook: React.FC<ProfilePassportBookProps> = ({
  title,
  description,
  openLabel,
  emptyLabel,
  stamps,
  countryCode,
  stickerPositions,
  onOpen,
  testId,
}) => {
  const theme = getPassportCoverTheme(countryCode);
  const content = (
    <div className="mt-3">
      <div
        className="profile-passport-cover relative overflow-hidden rounded-2xl border"
        style={{
          backgroundColor: theme.coverHex,
          borderColor: theme.borderHex,
          color: theme.textHex,
        }}
      >
        <div
          className="absolute inset-y-0 start-0 w-9"
          style={{ backgroundColor: theme.spineHex }}
          aria-hidden="true"
        />
        <div className="relative px-5 pb-5 pt-5">
          <div className="ps-8">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.mutedTextHex }}>
                {title}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.mutedTextHex }}>
                {stamps.length}/3
              </p>
            </div>
            <div className="relative mt-3 h-[300px] overflow-hidden rounded-xl border border-white/10 bg-black/20">
              {stamps.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm" style={{ color: theme.mutedTextHex }}>
                  {emptyLabel}
                </div>
              ) : (
                stamps.map((stamp, index) => {
                  const position = resolvePosition(stamp.definition.id, index, stickerPositions);
                  return (
                    <div
                      key={`passport-preview-${stamp.definition.id}`}
                      className="profile-passport-sticker absolute w-[98px] rounded-lg border border-white/25 bg-slate-100/95 p-1.5 text-left text-[10px] shadow-lg"
                      style={{
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        transform: `rotate(${index % 2 === 0 ? '-6deg' : '5deg'})`,
                      }}
                    >
                      <img
                        src={stamp.definition.assetPath}
                        alt={stamp.definition.title}
                        className="h-[72px] w-full rounded object-cover"
                        loading="lazy"
                      />
                      <span className="mt-1 block truncate font-semibold text-slate-700">{stamp.definition.title}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pointer-events-none absolute end-5 top-14">
            <span
              className="inline-flex h-12 w-12 items-center justify-center rounded-full border text-xs font-black"
              style={{
                borderColor: `${theme.emblemHex}66`,
                color: theme.emblemHex,
              }}
            >
              TF
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <article className="border border-slate-200 bg-white px-4 py-4" data-testid={testId}>
      <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        <SealCheck size={14} weight="duotone" className="text-accent-600" />
        {title}
      </p>
      {description ? (
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      ) : null}

      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="block w-full text-left"
          aria-label={openLabel}
        >
          {content}
        </button>
      ) : content}

      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-accent-700 transition-colors hover:text-accent-900"
        >
          {openLabel}
        </button>
      ) : null}
    </article>
  );
};
