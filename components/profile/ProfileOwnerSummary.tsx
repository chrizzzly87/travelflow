import React from 'react';
import {
  GlobeHemisphereWest,
  MapPin,
  Mountains,
  PencilSimpleLine,
  ShareNetwork,
} from '@phosphor-icons/react';
import { ProfileMetaPanel } from './ProfileMetaPanel';
import { ProfileAvatarOrbitText } from './ProfileAvatarOrbitText';
import type { VisitedCountry } from './profileCountryUtils';
import { ProfileSummaryStat, ProfileSummaryStats } from './ProfileSummaryStats';
import type { ProfileStatus } from './profileStatus';
import type { ProfileStampProgress } from './profileStamps';

interface ProfileOwnerSummaryLabels {
  editProfile: string;
  viewPublicProfile: string;
  shareProfile: string;
  memberSinceLabel: string;
  usernamePrefix: string;
  bio: string;
  bioFallback: string;
  countries: string;
  countriesEmpty: string;
  stampsTitle: string;
  stampsDescription: string;
  stampsOpen: string;
}

interface ProfileOwnerSummaryProps {
  displayName: string;
  username: string;
  initials: string;
  status: ProfileStatus;
  memberSince: string;
  bio: string;
  location: string;
  distanceLabel: string;
  countries: VisitedCountry[];
  stamps: ProfileStampProgress[];
  passportCountryCode?: string;
  stats: ProfileSummaryStat[];
  labels: ProfileOwnerSummaryLabels;
  editProfileHref: string;
  viewPublicProfileHref: string;
  onEditProfileClick?: () => void;
  onViewPublicProfileClick?: () => void;
  onShareProfile: () => void;
  onOpenPassport?: (rect: DOMRect) => void;
  canShareProfile: boolean;
  locale?: string;
  showAvatarOrbitText?: boolean;
  className?: string;
  isPassportOpen?: boolean;
}

export const ProfileOwnerSummary: React.FC<ProfileOwnerSummaryProps> = ({
  displayName,
  username,
  initials,
  status,
  memberSince,
  bio,
  location,
  distanceLabel,
  countries,
  stamps,
  passportCountryCode,
  stats,
  labels,
  editProfileHref,
  viewPublicProfileHref,
  onEditProfileClick,
  onViewPublicProfileClick,
  onShareProfile,
  onOpenPassport,
  canShareProfile,
  locale = 'en',
  showAvatarOrbitText = false,
  className,
  isPassportOpen = false,
}) => {
  const resolvedBio = bio.trim();
  const fallbackBio = labels.bioFallback.trim();

  return (
    <section className={`grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] ${className}`} data-passport-open={isPassportOpen}>
      <article className="relative flex h-full min-h-[540px] flex-col rounded-2xl border border-border bg-card px-6 pb-6 pt-16 text-center shadow-sm">
        <div className="absolute inset-x-0 top-0 -translate-y-1/2">
          <div className={`relative mx-auto size-24 ${status.ringClassName}`}>
            <span className="absolute inset-0 inline-flex items-center justify-center rounded-full border-4 border-white bg-accent-100 text-2xl font-semibold text-accent-800 shadow-md ring-2 ring-current dark:bg-accent-400/12 dark:text-accent-200">
              {initials}
            </span>
            {showAvatarOrbitText && (
              <ProfileAvatarOrbitText label={status.orbitLabel} />
            )}
          </div>
        </div>
        <h2 className="mt-6 text-3xl font-semibold tracking-tight text-foreground">{displayName}</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">
          {labels.usernamePrefix}
          {username || 'traveler'}
        </p>
        <p className={`mt-2 text-xs font-semibold uppercase tracking-[0.16em] ${status.ringClassName}`}>{status.label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {labels.memberSinceLabel}: <span className="font-semibold text-foreground">{memberSince}</span>
        </p>

        <div className="mt-4 space-y-3 text-left">
          {(resolvedBio || fallbackBio) ? (
            <p className="text-sm leading-6 text-foreground">{resolvedBio || fallbackBio}</p>
          ) : null}
          <div className="flex flex-col gap-2">
            <p className="flex w-full items-center gap-2 text-sm font-semibold text-foreground">
              <MapPin size={15} weight="duotone" className="text-accent-600 dark:text-accent-300" />
              <span>{location}</span>
            </p>
            <p className="flex w-full items-center gap-2 text-sm font-semibold text-foreground">
              <Mountains size={15} weight="duotone" className="text-accent-600 dark:text-accent-300" />
              <span>{distanceLabel}</span>
            </p>
          </div>
        </div>

        <div className="mt-auto grid gap-2 pt-4">
          <a
            href={editProfileHref}
            onClick={onEditProfileClick}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-border hover:bg-secondary"
          >
            <PencilSimpleLine size={15} weight="duotone" />
            {labels.editProfile}
          </a>
          <a
            href={viewPublicProfileHref}
            onClick={onViewPublicProfileClick}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-border hover:bg-secondary"
          >
            <GlobeHemisphereWest size={15} weight="duotone" />
            {labels.viewPublicProfile}
          </a>
          <button
            type="button"
            onClick={onShareProfile}
            disabled={!canShareProfile}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition-all duration-150 hover:border-border hover:bg-secondary active:scale-[0.985] active:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ShareNetwork size={15} weight="duotone" />
            {labels.shareProfile}
          </button>
        </div>
      </article>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
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
