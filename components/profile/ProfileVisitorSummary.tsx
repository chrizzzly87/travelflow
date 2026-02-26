import React from 'react';
import { ChatTeardropText, UserPlus } from '@phosphor-icons/react';
import { ProfileMetaPanel } from './ProfileMetaPanel';
import type { VisitedCountry } from './profileCountryUtils';
import { ProfileSummaryStat, ProfileSummaryStats } from './ProfileSummaryStats';
import type { ProfileStatus } from './profileStatus';

interface ProfileVisitorSummaryLabels {
  follow: string;
  message: string;
  comingSoon: string;
  usernamePrefix: string;
  bio: string;
  bioFallback: string;
  location: string;
  distance: string;
  countries: string;
  countriesEmpty: string;
  scratchMapTitle: string;
  scratchMapDescription: string;
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
  stats: ProfileSummaryStat[];
  labels: ProfileVisitorSummaryLabels;
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
  stats,
  labels,
}) => {
  const orbitPathId = React.useId();
  return (
    <section className="grid gap-8 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <article className="relative border border-slate-200 bg-white px-5 pb-5 pt-12 text-center">
        <div className="absolute inset-x-0 top-0 -translate-y-1/2">
          <span className={`mx-auto inline-flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-accent-100 text-2xl font-black text-accent-800 shadow-md ring-2 ring-current ${status.ringClassName}`}>
            {initials}
          </span>
          <svg
            viewBox="0 0 120 120"
            className={`pointer-events-none absolute inset-x-0 top-1/2 mx-auto h-32 w-32 -translate-y-1/2 profile-avatar-orbit ${status.ringClassName}`}
            aria-hidden="true"
          >
            <defs>
              <path id={orbitPathId} d="M 60,60 m -46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" />
            </defs>
            <text className="fill-current text-[8px] font-semibold uppercase tracking-[0.2em]">
              <textPath href={`#${orbitPathId}`} startOffset="50%" textAnchor="middle">
                {`${status.orbitLabel} • ${status.orbitLabel} • ${status.orbitLabel}`}
              </textPath>
            </text>
          </svg>
        </div>
        <h2 className="text-3xl font-black tracking-tight text-slate-900">{displayName}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          {labels.usernamePrefix}
          {username || 'traveler'}
        </p>
        <p className={`mt-2 text-xs font-semibold uppercase tracking-[0.16em] ${status.ringClassName}`}>{status.label}</p>

        <div className="mt-4 grid gap-2">
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
        </div>

        <p className="mt-3 text-xs font-medium text-slate-500">{labels.comingSoon}</p>
      </article>

      <div className="space-y-6">
        <ProfileSummaryStats stats={stats} />
        <ProfileMetaPanel
          bio={bio}
          location={location}
          distanceLabel={distanceLabel}
          countries={countries}
          labels={{
            bio: labels.bio,
            bioFallback: labels.bioFallback,
            location: labels.location,
            distance: labels.distance,
            countries: labels.countries,
            countriesEmpty: labels.countriesEmpty,
            scratchMapTitle: labels.scratchMapTitle,
            scratchMapDescription: labels.scratchMapDescription,
          }}
        />
      </div>
    </section>
  );
};
