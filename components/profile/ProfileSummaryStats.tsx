import React from 'react';
import { ProfileStatCountUp } from './ProfileStatCountUp';

export interface ProfileSummaryStat {
  id: string;
  label: string;
  value: string | number;
  accent?: boolean;
}

interface ProfileSummaryStatsProps {
  stats: ProfileSummaryStat[];
  locale?: string;
}

export const ProfileSummaryStats: React.FC<ProfileSummaryStatsProps> = ({
  stats,
  locale = 'en',
}) => {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <article
          key={stat.id}
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-right"
        >
          <p
            className={stat.accent
              ? 'text-3xl font-black tracking-tight text-accent-700 tabular-nums [font-variant-numeric:tabular-nums]'
              : 'text-3xl font-black tracking-tight text-slate-900 tabular-nums [font-variant-numeric:tabular-nums]'}
          >
            <ProfileStatCountUp value={stat.value} locale={locale} />
          </p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{stat.label}</p>
        </article>
      ))}
    </div>
  );
};
