import React from 'react';
import { GlobeHemisphereWest } from '@phosphor-icons/react';
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
      d="M22 15a4.5 4.5 0 1 0 0 .1Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path d="M4.5 23.5h27" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export const ProfilePassportBook: React.FC<ProfilePassportBookProps> = ({
  title,
  openLabel,
  stamps,
  countryCode,
  onOpen,
  testId,
}) => {
  const theme = getPassportCoverTheme(countryCode);
  const showcasedCountLabel = stamps.length > 0
    ? `${stamps.length} stamp${stamps.length === 1 ? '' : 's'}`
    : 'No stamps yet';
  const rootClassName = [
    'profile-passport-cover group relative isolate mx-auto aspect-[4/5] w-full max-w-[208px]',
    onOpen ? 'profile-passport-cover--interactive cursor-pointer' : '',
  ].join(' ').trim();

  const clipStyle: React.CSSProperties = {
    borderColor: theme.borderHex,
    color: theme.textHex,
    backgroundColor: theme.coverHex,
  };

  const content = (
    <div className={rootClassName} data-testid={testId}>
      <div className="profile-passport-stack">
        <div className="profile-passport-page-stack" aria-hidden="true">
          {Array.from({ length: 6 }).map((_, index) => {
            // Lift only the two top pages on hover so the cover still stays dominant.
            const hoverLift = index === 5 ? -20 : index === 4 ? -10 : 0;
            return (
              <span
                key={`passport-fake-page-${index}`}
                className="profile-passport-fake-page"
                style={{
                  '--passport-page-index': index,
                  '--passport-page-hover-lift': `${hoverLift}px`,
                } as React.CSSProperties}
              />
            );
          })}
        </div>

        <div className="profile-passport-cover-tilt">
          <div className="profile-passport-cover-clip" style={clipStyle}>
            <span className="profile-passport-cover-noise pointer-events-none absolute inset-0" aria-hidden="true" />
            <span className="profile-passport-cover-shimmer pointer-events-none absolute inset-0" aria-hidden="true" />

            <div className="profile-passport-cover-face relative z-[1] h-full">
              <span
                className="pointer-events-none absolute inset-y-0 start-0 w-10"
                style={{ backgroundColor: theme.spineHex }}
                aria-hidden="true"
              />
              <span className="profile-passport-cover-fiber pointer-events-none absolute inset-0" aria-hidden="true" />
              <span className="profile-passport-cover-edge pointer-events-none absolute inset-y-0 end-0 w-[3px]" aria-hidden="true" />

              <div className="relative flex h-full flex-col items-center justify-center gap-6 px-8 py-7 text-center" style={{ backgroundColor: theme.spineHex }}>
                <p className="sr-only">{title}</p>
                <div className="flex items-center justify-center gap-4 text-[#f1d17d]">
                  <GlobeHemisphereWest size={56} weight="duotone" />
                </div>
                <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-[#f8e5b4]">Travel Passport</p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                  {showcasedCountLabel}
                </p>
                <EPassportGlyph className="h-7 w-8 text-[#f1d17d]" />
              </div>
            </div>
          </div>
        </div>
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
