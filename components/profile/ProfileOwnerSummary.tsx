import React from 'react';
import { PencilSimpleLine, GlobeHemisphereWest } from '@phosphor-icons/react';
import { ProfileMetaPanel } from './ProfileMetaPanel';
import { ProfileSummaryStat, ProfileSummaryStats } from './ProfileSummaryStats';

interface ProfileOwnerSummaryLabels {
  editProfile: string;
  viewPublicProfile: string;
  memberSinceLabel: string;
  usernamePrefix: string;
  roleLabel: string;
  bio: string;
  bioFallback: string;
  location: string;
  distance: string;
  countries: string;
  countriesEmpty: string;
  scratchMapTitle: string;
  scratchMapDescription: string;
}

interface ProfileOwnerSummaryProps {
  displayName: string;
  username: string;
  initials: string;
  role: string;
  memberSince: string;
  bio: string;
  location: string;
  distanceLabel: string;
  countries: string[];
  stats: ProfileSummaryStat[];
  labels: ProfileOwnerSummaryLabels;
  onEditProfile: () => void;
  onViewPublicProfile: () => void;
  canViewPublicProfile: boolean;
}

export const ProfileOwnerSummary: React.FC<ProfileOwnerSummaryProps> = ({
  displayName,
  username,
  initials,
  role,
  memberSince,
  bio,
  location,
  distanceLabel,
  countries,
  stats,
  labels,
  onEditProfile,
  onViewPublicProfile,
  canViewPublicProfile,
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
            <p className="mt-2 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
              {labels.roleLabel}: {role}
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{labels.memberSinceLabel}</p>
        <p className="mt-1 text-sm font-semibold text-slate-800">{memberSince}</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          <button
            type="button"
            onClick={onEditProfile}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <PencilSimpleLine size={15} />
            {labels.editProfile}
          </button>
          <button
            type="button"
            onClick={onViewPublicProfile}
            disabled={!canViewPublicProfile}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GlobeHemisphereWest size={15} />
            {labels.viewPublicProfile}
          </button>
        </div>
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
