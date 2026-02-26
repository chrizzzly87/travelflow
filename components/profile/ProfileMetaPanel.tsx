import React from 'react';

interface ProfileMetaPanelLabels {
  bio: string;
  bioFallback: string;
  location: string;
  distance: string;
  countries: string;
  countriesEmpty: string;
  scratchMapTitle: string;
  scratchMapDescription: string;
}

interface ProfileMetaPanelProps {
  bio: string;
  location: string;
  distanceLabel: string;
  countries: string[];
  labels: ProfileMetaPanelLabels;
}

export const ProfileMetaPanel: React.FC<ProfileMetaPanelProps> = ({
  bio,
  location,
  distanceLabel,
  countries,
  labels,
}) => {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="space-y-3">
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{labels.bio}</p>
            <p className="mt-1 text-sm leading-6 text-slate-700">{bio || labels.bioFallback}</p>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{labels.location}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{location}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{labels.distance}</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{distanceLabel}</p>
            </div>
          </section>

          <section>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{labels.countries}</p>
            {countries.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {countries.map((country) => (
                  <span
                    key={`country-${country}`}
                    className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    {country}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-500">{labels.countriesEmpty}</p>
            )}
          </section>
        </div>
      </article>

      <article className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage: [
              'radial-gradient(circle at 22% 24%, rgba(79,70,229,0.18), transparent 36%)',
              'radial-gradient(circle at 78% 16%, rgba(14,165,233,0.18), transparent 32%)',
              'radial-gradient(circle at 64% 74%, rgba(16,185,129,0.16), transparent 38%)',
              'linear-gradient(115deg, rgba(248,250,252,1) 0%, rgba(239,246,255,1) 45%, rgba(248,250,252,1) 100%)',
            ].join(', '),
          }}
        />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{labels.scratchMapTitle}</p>
          <div className="mt-3 rounded-xl border border-white/80 bg-white/70 px-3 py-3 backdrop-blur">
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 28 }, (_, index) => (
                <span
                  key={`scratch-dot-${index}`}
                  className={`h-2 w-2 rounded-full ${index % 5 === 0 ? 'bg-accent-500/65' : 'bg-slate-300/70'}`}
                />
              ))}
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{labels.scratchMapDescription}</p>
        </div>
      </article>
    </div>
  );
};
