import React from 'react';
import { GlobeHemisphereWest, SealCheck } from '@phosphor-icons/react';
import { getPassportCoverTheme } from '../../services/passportService';
import type { ProfileStampProgress } from './profileStamps';

interface ProfilePassportBookProps {
  title: string;
  description?: string;
  openLabel: string;
  stamps: ProfileStampProgress[];
  countryCode?: string | null;
  onOpen?: () => void;
  testId?: string;
}

const EPassportGlyph: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 36 30" className={className} aria-hidden="true">
    <path
      d="M4 6.5h28v17H4z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M18 13.5a4.5 4.5 0 1 0 0 .1Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path d="M4.5 23.5h27" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const ProfilePassportBook: React.FC<ProfilePassportBookProps> = ({
  title,
  description,
  openLabel,
  stamps,
  countryCode,
  onOpen,
  testId,
}) => {
  const theme = getPassportCoverTheme(countryCode);
  const rootClassName = [
    'profile-passport-cover group relative isolate overflow-hidden rounded-2xl border',
    onOpen ? 'profile-passport-cover--interactive cursor-pointer' : '',
  ].join(' ').trim();

  const coverStyle: React.CSSProperties = {
    borderColor: theme.borderHex,
    color: theme.textHex,
    backgroundColor: theme.coverHex,
    backgroundImage: [
      'radial-gradient(circle at 16% 14%, rgba(255,255,255,0.16), transparent 34%)',
      'radial-gradient(circle at 82% 84%, rgba(255,255,255,0.09), transparent 42%)',
      'linear-gradient(158deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 42%)',
      'linear-gradient(120deg, rgba(12,19,35,0.42) 0%, rgba(12,19,35,0.1) 65%, rgba(12,19,35,0.44) 100%)',
    ].join(', '),
  };

  const content = (
    <div className={rootClassName} style={coverStyle} data-testid={testId}>
      <span
        className="pointer-events-none absolute inset-y-0 start-0 w-10"
        style={{ backgroundColor: theme.spineHex }}
        aria-hidden="true"
      />
      <span className="profile-passport-cover-grain pointer-events-none absolute inset-0" aria-hidden="true" />
      <span className="profile-passport-cover-holo pointer-events-none absolute inset-0" aria-hidden="true" />
      <span className="profile-passport-cover-flap pointer-events-none absolute inset-y-2 end-0 w-7" aria-hidden="true" />

      <div className="relative z-[1] px-6 pb-6 pt-6">
        <div className="ps-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: theme.mutedTextHex }}>
            {title}
          </p>
          {description ? (
            <p className="mt-2 text-sm leading-6" style={{ color: theme.mutedTextHex }}>
              {description}
            </p>
          ) : null}
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-white/85">Travel Passport</p>
          <div className="mt-3 flex items-center gap-3 text-[#f3df9f]">
            <GlobeHemisphereWest size={24} weight="duotone" className="drop-shadow-[0_0_14px_rgba(246,209,120,0.42)]" />
            <EPassportGlyph className="h-6 w-7 drop-shadow-[0_0_14px_rgba(246,209,120,0.42)]" />
          </div>
          <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: theme.mutedTextHex }}>
            {stamps.length > 0 ? `${stamps.length} stamp${stamps.length === 1 ? '' : 's'} showcased` : 'No stamps showcased yet'}
          </p>
        </div>

        <span className="pointer-events-none absolute end-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#f2de9d]/45 text-[#f2de9d] shadow-[0_0_24px_rgba(242,222,157,0.34)]">
          <SealCheck size={18} weight="duotone" />
        </span>
      </div>
    </div>
  );

  if (!onOpen) return content;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full text-left"
      aria-label={openLabel}
    >
      {content}
    </button>
  );
};
