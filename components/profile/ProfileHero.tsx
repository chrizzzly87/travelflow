import React from 'react';
import { Sparkle, SpinnerGap } from '@phosphor-icons/react';

interface ProfileHeroProps {
  isLoading: boolean;
  displayName: string;
  email: string;
  initials: string;
  tier: string;
  role: string;
  preferredLanguage?: string | null;
  greetingText: string;
  greetingLanguage: string;
  greetingContext: string;
  title: string;
  subtitle: string;
  accountLabel: string;
  loadingLabel: string;
  labels: {
    tier: string;
    role: string;
    language: string;
  };
}

export const ProfileHero: React.FC<ProfileHeroProps> = ({
  isLoading,
  displayName,
  email,
  initials,
  tier,
  role,
  preferredLanguage,
  greetingText,
  greetingLanguage,
  greetingContext,
  title,
  subtitle,
  accountLabel,
  loadingLabel,
  labels,
}) => {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#f8fafc_0%,#eef2ff_45%,#f8fafc_100%)] p-6 md:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(79,70,229,0.12),_transparent_52%)]" />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-700">{accountLabel}</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{subtitle}</p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <article className="rounded-2xl border border-white/70 bg-white/70 p-4 backdrop-blur">
            {isLoading ? (
              <div className="inline-flex items-center gap-2 text-sm text-slate-500">
                <SpinnerGap size={16} className="animate-spin" />
                {loadingLabel}
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-100 text-lg font-black text-accent-800">
                  {initials}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-black tracking-tight text-slate-900">{displayName}</h2>
                  <p className="mt-1 truncate text-sm text-slate-600">{email}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-700">
                      {labels.tier}: {tier}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-700">
                      {labels.role}: {role}
                    </span>
                    {preferredLanguage && (
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-700">
                        {labels.language}: {preferredLanguage.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-accent-100 bg-white/55 p-4 backdrop-blur">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent-700">
              <Sparkle size={14} weight="duotone" />
              {greetingLanguage}
            </p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900">{greetingText}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-700">{greetingContext}</p>
          </article>
        </div>
      </div>
    </section>
  );
};
