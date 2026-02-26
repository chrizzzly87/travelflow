import React from 'react';
import { SealCheck, Sparkle } from '@phosphor-icons/react';
import type { ProfileStampProgress } from './profileStamps';

interface ProfileStampsPreviewProps {
  title: string;
  description: string;
  openLabel: string;
  emptyLabel: string;
  stamps: ProfileStampProgress[];
  onOpen?: () => void;
}

export const ProfileStampsPreview: React.FC<ProfileStampsPreviewProps> = ({
  title,
  description,
  openLabel,
  emptyLabel,
  stamps,
  onOpen,
}) => {
  return (
    <article className="border border-slate-200 bg-white px-4 py-4">
      <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        <SealCheck size={14} weight="duotone" className="text-accent-600" />
        {title}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>

      {stamps.length > 0 ? (
        <div className="mt-4 grid gap-2">
          {stamps.map((stamp) => (
            <div
              key={stamp.definition.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2"
            >
              <img
                src={stamp.definition.assetPath}
                alt={stamp.definition.title}
                className="h-12 w-12 rounded-md object-cover"
                loading="lazy"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{stamp.definition.title}</p>
                <p className="truncate text-xs text-slate-500">{stamp.definition.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{emptyLabel}</p>
      )}

      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent-600 transition-colors hover:text-accent-800"
        >
          <Sparkle size={15} weight="duotone" />
          {openLabel}
        </button>
      ) : null}
    </article>
  );
};
