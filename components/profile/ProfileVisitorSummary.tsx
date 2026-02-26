import React from 'react';
import { ChatTeardropText, UserPlus } from '@phosphor-icons/react';
import { ProfileMetaPanel } from './ProfileMetaPanel';
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
  countries: string[];
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
    <section className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-100 text-xl font-black text-accent-800">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl font-black tracking-tight text-slate-900">{displayName}</h2>
            <p className="mt-0.5 text-sm font-semibold text-slate-600">
              {labels.usernamePrefix}
              {username || 'traveler'}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white opacity-75"
          >
            <UserPlus size={15} />
            {labels.follow}
          </button>
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 opacity-75"
          >
            <ChatTeardropText size={15} />
            {labels.message}
          </button>
        </div>

        <p className="mt-3 text-xs font-medium text-slate-500">{labels.comingSoon}</p>
      </article>

      <div className="space-y-4">
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
