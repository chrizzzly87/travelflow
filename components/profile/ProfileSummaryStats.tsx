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
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <article key={stat.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className={stat.accent ? 'text-3xl font-black tracking-tight text-accent-700' : 'text-3xl font-black tracking-tight text-slate-900'}>
            {stat.value}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
        </article>
      ))}
    </div>
  );
};
