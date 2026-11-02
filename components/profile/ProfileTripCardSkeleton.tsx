import React from 'react';

interface ProfileTripCardSkeletonProps {
  pulse?: boolean;
}

export const ProfileTripCardSkeleton: React.FC<ProfileTripCardSkeletonProps> = ({
  pulse = true,
}) => {
  return (
    <article className={`overflow-hidden rounded-xl border border-border bg-card ${pulse ? 'animate-pulse' : ''}`}>
      <div className="h-40 bg-secondary" />
      <div className="space-y-3 p-4">
        <div className="h-7 w-3/4 rounded bg-slate-200" />
        <div className="h-4 w-2/3 rounded bg-secondary" />
        <div className="h-4 w-1/2 rounded bg-secondary" />
        <div className="flex gap-2">
          <span className="h-6 w-16 rounded-full bg-secondary" />
          <span className="h-6 w-20 rounded-full bg-secondary" />
          <span className="h-6 w-12 rounded-full bg-secondary" />
        </div>
      </div>
      <div className="border-t border-border px-4 py-3">
        <div className="h-9 w-24 rounded bg-slate-200" />
      </div>
    </article>
  );
};
