import React from 'react';
import { ChatTeardropText, UserPlus } from '@phosphor-icons/react';
import { ProfileMetaPanel } from './ProfileMetaPanel';
import type { VisitedCountry } from './profileCountryUtils';
import { ProfileSummaryStat, ProfileSummaryStats } from './ProfileSummaryStats';

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
  bio,
  location,
  distanceLabel,
  countries,
  stats,
  labels,
}) => {
  return (
    <section className="grid gap-8 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <article className="relative border border-slate-200 bg-white px-5 pb-5 pt-12 text-center">
        <span className="absolute left-1/2 top-0 inline-flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white bg-accent-100 text-2xl font-black text-accent-800 shadow-md">
          {initials}
        </span>
        <h2 className="text-3xl font-black tracking-tight text-slate-900">{displayName}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          {labels.usernamePrefix}
          {username || 'traveler'}
        </p>

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
