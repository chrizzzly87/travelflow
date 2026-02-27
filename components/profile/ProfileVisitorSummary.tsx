import React from 'react';
import {
  ChatTeardropText,
  MapPin,
  Mountains,
  PencilSimpleLine,
  UserPlus,
} from '@phosphor-icons/react';
import { ProfileMetaPanel } from './ProfileMetaPanel';
import { ProfileAvatarOrbitText } from './ProfileAvatarOrbitText';
import type { VisitedCountry } from './profileCountryUtils';
import { ProfileSummaryStat, ProfileSummaryStats } from './ProfileSummaryStats';
import type { ProfileStatus } from './profileStatus';
import type { ProfileStampProgress } from './profileStamps';

interface ProfileVisitorSummaryLabels {
  follow: string;
  message: string;
  editProfile: string;
  usernamePrefix: string;
  bio: string;
  bioFallback: string;
  countries: string;
  countriesEmpty: string;
  stampsTitle: string;
  stampsDescription: string;
  stampsOpen: string;
}

interface ProfileVisitorSummaryProps {
  displayName: string;
  username: string;
  initials: string;
  status: ProfileStatus;
  bio: string;
  location: string;
  distanceLabel: string;
  countries: VisitedCountry[];
  stamps: ProfileStampProgress[];
  passportCountryCode?: string;
  stats: ProfileSummaryStat[];
  labels: ProfileVisitorSummaryLabels;
  locale?: string;
  onOpenPassport?: () => void;
  isOwnProfile?: boolean;
  onEditProfile?: () => void;
  editProfileHref?: string;
  visibilityBadgeLabel?: string | null;
  showAvatarOrbitText?: boolean;
  showDetails?: boolean;
  hideRightPanel?: boolean;
  compactCard?: boolean;
}

export const ProfileVisitorSummary: React.FC<ProfileVisitorSummaryProps> = ({
  displayName,
  username,
  initials,
  status,
  bio,
  location,
  distanceLabel,
  countries,
  stamps,
  passportCountryCode,
  stats,
  labels,
  locale = 'en',
  onOpenPassport,
  isOwnProfile = false,
  onEditProfile,
  editProfileHref,
  visibilityBadgeLabel = null,
  showAvatarOrbitText = false,
  showDetails = true,
  hideRightPanel = false,
  compactCard = false,
}) => {
  const profileIdentityCard = (
    <article className={`relative flex h-full flex-col rounded-2xl border border-slate-200 bg-white px-6 pb-6 pt-16 text-center shadow-sm ${compactCard ? 'min-h-[360px]' : 'min-h-[480px]'}`}>
      <div className="absolute inset-x-0 top-0 -translate-y-1/2">
        <div className={`relative mx-auto h-24 w-24 ${status.ringClassName}`}>
          <span className="absolute inset-0 inline-flex items-center justify-center rounded-full border-4 border-white bg-accent-100 text-2xl font-black text-accent-800 shadow-md ring-2 ring-current">
            {initials}
          </span>
          {showAvatarOrbitText && (
            <ProfileAvatarOrbitText label={status.orbitLabel} />
          )}
        </div>
      </div>
      <h2 className="mt-6 text-3xl font-black tracking-tight text-slate-900">{displayName}</h2>
      <p className="mt-1 text-sm font-semibold text-slate-600">
        {labels.usernamePrefix}
        {username || 'traveler'}
      </p>
      <p className={`mt-2 text-xs font-semibold uppercase tracking-[0.16em] ${status.ringClassName}`}>{status.label}</p>
      {visibilityBadgeLabel ? (
        <p className="mt-2">
          <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">
            {visibilityBadgeLabel}
          </span>
        </p>
      ) : null}

      {showDetails ? (
        <div className="mt-4 space-y-3 text-left">
          <p className="text-sm leading-6 text-slate-700">{bio || labels.bioFallback}</p>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <MapPin size={15} weight="duotone" className="text-accent-600" />
            {location}
          </p>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Mountains size={15} weight="duotone" className="text-accent-600" />
            {distanceLabel}
          </p>
        </div>
      ) : null}

      <div className="mt-auto grid gap-2 pt-4">
        {isOwnProfile && onEditProfile ? (
          editProfileHref ? (
            <a
              href={editProfileHref}
              onClick={onEditProfile}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              <PencilSimpleLine size={15} weight="duotone" />
              {labels.editProfile}
            </a>
          ) : (
            <button
              type="button"
              onClick={onEditProfile}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              <PencilSimpleLine size={15} weight="duotone" />
              {labels.editProfile}
            </button>
          )
        ) : (
          <>
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white opacity-75"
            >
              <UserPlus size={15} weight="duotone" />
              {labels.follow}
            </button>
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 opacity-75"
            >
              <ChatTeardropText size={15} weight="duotone" />
              {labels.message}
            </button>
          </>
        )}
      </div>
    </article>
  );

  if (hideRightPanel) {
    return (
      <section className="w-full max-w-md">
        {profileIdentityCard}
      </section>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      {profileIdentityCard}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <ProfileSummaryStats stats={stats} locale={locale} />
        <div className="mt-6">
          <ProfileMetaPanel
            countries={countries}
            stamps={stamps}
            passportCountryCode={passportCountryCode}
            onOpenPassport={onOpenPassport}
            labels={{
              countries: labels.countries,
              countriesEmpty: labels.countriesEmpty,
              stampsTitle: labels.stampsTitle,
              stampsDescription: labels.stampsDescription,
              stampsOpen: labels.stampsOpen,
            }}
          />
        </div>
      </div>
    </section>
  );
};
