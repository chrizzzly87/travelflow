import React from 'react';
import { ChatTeardropText, UserPlus } from '@phosphor-icons/react';
import { ProfileMetaPanel } from './ProfileMetaPanel';
import { ProfileAvatarOrbitText } from './ProfileAvatarOrbitText';
import type { VisitedCountry } from './profileCountryUtils';
import { ProfileSummaryStat, ProfileSummaryStats } from './ProfileSummaryStats';
import type { ProfileStatus } from './profileStatus';
import type { ProfileStampProgress } from './profileStamps';

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
  stampsTitle: string;
  stampsDescription: string;
  stampsOpen: string;
  stampsEmpty: string;
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
  stats: ProfileSummaryStat[];
  labels: ProfileVisitorSummaryLabels;
  showAvatarOrbitText?: boolean;
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
  stats,
  labels,
  showAvatarOrbitText = false,
}) => {
  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <article className="relative rounded-2xl border border-slate-200 bg-white px-6 pb-6 pt-16 text-center shadow-sm">
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

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <ProfileSummaryStats stats={stats} />
        <div className="mt-6">
          <ProfileMetaPanel
            bio={bio}
            location={location}
            distanceLabel={distanceLabel}
            countries={countries}
            stamps={stamps}
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
      </div>
    </section>
  );
};
