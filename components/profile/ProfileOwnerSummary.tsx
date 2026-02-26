import React from 'react';
import { GlobeHemisphereWest, PencilSimpleLine, ShareNetwork } from '@phosphor-icons/react';
import { ProfileMetaPanel } from './ProfileMetaPanel';
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
  location: string;
  distance: string;
  countries: string;
  countriesEmpty: string;
  stampsTitle: string;
  stampsDescription: string;
  stampsOpen: string;
  stampsEmpty: string;
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
  stats: ProfileSummaryStat[];
  labels: ProfileOwnerSummaryLabels;
  onEditProfile: () => void;
  onViewPublicProfile: () => void;
  onShareProfile: () => void;
  onOpenStamps: () => void;
  canViewPublicProfile: boolean;
  canShareProfile: boolean;
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
  stats,
  labels,
  onEditProfile,
  onViewPublicProfile,
  onShareProfile,
  onOpenStamps,
  canViewPublicProfile,
  canShareProfile,
}) => {
  const orbitPathId = React.useId();
  return (
    <section className="grid gap-8 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <article className="relative border border-slate-200 bg-white px-5 pb-5 pt-12 text-center">
        <div className="absolute inset-x-0 top-0 -translate-y-1/2">
          <div className={`relative mx-auto h-24 w-24 ${status.ringClassName}`}>
            <span className="absolute inset-0 inline-flex items-center justify-center rounded-full border-4 border-white bg-accent-100 text-2xl font-black text-accent-800 shadow-md ring-2 ring-current">
              {initials}
            </span>
            <svg
              viewBox="0 0 120 120"
              className="profile-avatar-orbit pointer-events-none absolute -inset-4 h-[calc(100%+2rem)] w-[calc(100%+2rem)]"
              aria-hidden="true"
            >
              <defs>
                <path id={orbitPathId} d="M 60,60 m -47,0 a47,47 0 1,1 94,0 a47,47 0 1,1 -94,0" />
              </defs>
              <text className="fill-current text-[8px] font-semibold uppercase tracking-[0.2em]">
                <textPath href={`#${orbitPathId}`} startOffset="50%" textAnchor="middle">
                  {`${status.orbitLabel} • ${status.orbitLabel} • ${status.orbitLabel}`}
                </textPath>
              </text>
            </svg>
          </div>
        </div>
        <h2 className="text-3xl font-black tracking-tight text-slate-900">{displayName}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          {labels.usernamePrefix}
          {username || 'traveler'}
        </p>
        <p className={`mt-2 text-xs font-semibold uppercase tracking-[0.16em] ${status.ringClassName}`}>{status.label}</p>
        <p className="mt-1 text-xs text-slate-500">
          {labels.memberSinceLabel}: <span className="font-semibold text-slate-700">{memberSince}</span>
        </p>

        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={onEditProfile}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <PencilSimpleLine size={15} weight="duotone" />
            {labels.editProfile}
          </button>
          <button
            type="button"
            onClick={onViewPublicProfile}
            disabled={!canViewPublicProfile}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GlobeHemisphereWest size={15} weight="duotone" />
            {labels.viewPublicProfile}
          </button>
          <button
            type="button"
            onClick={onShareProfile}
            disabled={!canShareProfile}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ShareNetwork size={15} weight="duotone" />
            {labels.shareProfile}
          </button>
        </div>
      </article>

      <div className="space-y-6">
        <ProfileSummaryStats stats={stats} />
        <ProfileMetaPanel
          bio={bio}
          location={location}
          distanceLabel={distanceLabel}
          countries={countries}
          stamps={stamps}
          onOpenStamps={onOpenStamps}
          labels={{
            bio: labels.bio,
            bioFallback: labels.bioFallback,
            location: labels.location,
            distance: labels.distance,
            countries: labels.countries,
            countriesEmpty: labels.countriesEmpty,
            stampsTitle: labels.stampsTitle,
            stampsDescription: labels.stampsDescription,
            stampsOpen: labels.stampsOpen,
            stampsEmpty: labels.stampsEmpty,
          }}
        />
      </div>
    </section>
  );
};
