import React from 'react';
import { GlobeHemisphereWest, PencilSimpleLine, ShareNetwork } from '@phosphor-icons/react';
import { ProfileMetaPanel } from './ProfileMetaPanel';
import type { VisitedCountry } from './profileCountryUtils';
import { ProfileSummaryStat, ProfileSummaryStats } from './ProfileSummaryStats';

interface ProfileOwnerSummaryLabels {
  editProfile: string;
  viewPublicProfile: string;
  shareProfile: string;
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
  countries: VisitedCountry[];
  stats: ProfileSummaryStat[];
  labels: ProfileOwnerSummaryLabels;
  onEditProfile: () => void;
  onViewPublicProfile: () => void;
  onShareProfile: () => void;
  canViewPublicProfile: boolean;
  canShareProfile: boolean;
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
  onShareProfile,
  canViewPublicProfile,
  canShareProfile,
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
        <p className="mt-2 text-xs text-slate-500">
          {labels.roleLabel}: <span className="font-semibold text-slate-700">{role}</span>
        </p>
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
