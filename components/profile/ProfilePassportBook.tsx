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
  draggableStickers?: boolean;
  onStickerMoveEnd?: (positions: Record<string, PassportStickerPosition>, movedStampId: string) => void;
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
  draggableStickers = false,
  onStickerMoveEnd,
  onOpen,
  testId,
}) => {
  const theme = getPassportCoverTheme(countryCode);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
  const [localStickerPositions, setLocalStickerPositions] = React.useState<Record<string, PassportStickerPosition>>({});
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const dragStateRef = React.useRef<{
    stampId: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const stickerPositionsRef = React.useRef<Record<string, PassportStickerPosition>>({});

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
    setLocalStickerPositions((current) => {
      const next: Record<string, PassportStickerPosition> = {};
      stamps.forEach((stamp, index) => {
        next[stamp.definition.id] = resolvePosition(
          stamp.definition.id,
          index,
          stickerPositions || current
        );
      });
      stickerPositionsRef.current = next;
      return next;
    });
  }, [stamps, stickerPositions]);

  const handleStickerPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    stampId: string
  ) => {
    if (!draggableStickers || !canvasRef.current) return;
    const stickerRect = event.currentTarget.getBoundingClientRect();
    dragStateRef.current = {
      stampId,
      offsetX: event.clientX - stickerRect.left,
      offsetY: event.clientY - stickerRect.top,
    };
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
  };

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggableStickers || !canvasRef.current) return;
    const dragState = dragStateRef.current;
    if (!dragState) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const nextX = clamp(event.clientX - canvasRect.left - dragState.offsetX, 8, canvasRect.width - PROFILE_PASSPORT_STICKER_WIDTH - 2);
    const nextY = clamp(event.clientY - canvasRect.top - dragState.offsetY, 8, canvasRect.height - PROFILE_PASSPORT_STICKER_HEIGHT - 2);
    setLocalStickerPositions((current) => {
      const next = {
        ...current,
        [dragState.stampId]: { x: nextX, y: nextY },
      };
      stickerPositionsRef.current = next;
      return next;
    });
  };

  const handleCanvasPointerUp = () => {
    if (!draggableStickers) return;
    const dragState = dragStateRef.current;
    if (!dragState) return;
    dragStateRef.current = null;
    onStickerMoveEnd?.(stickerPositionsRef.current, dragState.stampId);
  };

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
            <div
              ref={canvasRef}
              className="relative mt-3 h-[300px] overflow-hidden rounded-xl border border-white/10 bg-black/20"
              onPointerMove={draggableStickers ? handleCanvasPointerMove : undefined}
              onPointerUp={draggableStickers ? handleCanvasPointerUp : undefined}
              onPointerLeave={draggableStickers ? handleCanvasPointerUp : undefined}
            >
              {stamps.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm" style={{ color: theme.mutedTextHex }}>
                  {emptyLabel}
                </div>
              ) : (
                stamps.map((stamp, index) => {
                  const position = localStickerPositions[stamp.definition.id]
                    || resolvePosition(stamp.definition.id, index, stickerPositions);
                  const rotation = prefersReducedMotion ? 0 : (index % 2 === 0 ? -6 : 5);
                  const commonClassName = [
                    'profile-passport-sticker absolute w-[98px] rounded-lg border border-white/25 bg-slate-100/95 p-1.5 text-left text-[10px] shadow-lg',
                    draggableStickers ? 'cursor-grab transition-transform active:cursor-grabbing' : '',
                  ].join(' ');
                  const commonStyle: React.CSSProperties = {
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    transform: `rotate(${rotation}deg)`,
                  };

                  if (draggableStickers) {
                    return (
                      <button
                        key={`passport-preview-${stamp.definition.id}`}
                        type="button"
                        data-stamp-id={`book-${stamp.definition.id}`}
                        onPointerDown={(event) => handleStickerPointerDown(event, stamp.definition.id)}
                        className={commonClassName}
                        style={commonStyle}
                        aria-label={stamp.definition.title}
                      >
                        <img
                          src={stamp.definition.assetPath}
                          alt={stamp.definition.title}
                          className="h-[72px] w-full rounded object-cover"
                          loading="lazy"
                        />
                        <span className="mt-1 block truncate font-semibold text-slate-700">{stamp.definition.title}</span>
                      </button>
                    );
                  }

                  return (
                    <div
                      key={`passport-preview-${stamp.definition.id}`}
                      className={commonClassName}
                      style={commonStyle}
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
              <SealCheck size={18} weight="duotone" />
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

      {onOpen && !draggableStickers ? (
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
