import React from 'react';

export interface ProfileSummaryStat {
  id: string;
  label: string;
  value: string | number;
  accent?: boolean;
}

interface ProfileSummaryStatsProps {
  stats: ProfileSummaryStat[];
}

export const ProfileSummaryStats: React.FC<ProfileSummaryStatsProps> = ({ stats }) => {
  return (
    <div className="grid gap-0 border-y border-slate-200 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <article
          key={stat.id}
          className="border-b border-slate-200 px-4 py-4 sm:border-b-0 sm:border-r last:border-r-0 xl:border-r"
        >
          <p className={stat.accent ? 'text-3xl font-black tracking-tight text-accent-700' : 'text-3xl font-black tracking-tight text-slate-900'}>
            {stat.value}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
        </article>
      ))}
    </div>
  );
};
