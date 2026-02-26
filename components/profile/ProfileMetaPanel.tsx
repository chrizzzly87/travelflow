import React from 'react';
import { GlobeHemisphereWest, MapPin, Mountains } from '@phosphor-icons/react';
import { FlagIcon } from '../flags/FlagIcon';
import type { VisitedCountry } from './profileCountryUtils';

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
  countries: VisitedCountry[];
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
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
      <div className="space-y-5">
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{labels.bio}</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{bio || labels.bioFallback}</p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{labels.location}</p>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
              <MapPin size={15} weight="duotone" className="text-accent-600" />
              {location}
            </p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{labels.distance}</p>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Mountains size={15} weight="duotone" className="text-accent-600" />
              {distanceLabel}
            </p>
          </div>
        </section>

        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{labels.countries}</p>
          {countries.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {countries.map((country) => (
                <span
                  key={`country-${country.name}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  <FlagIcon code={country.code} size="xs" fallback={null} />
                  <span>{country.name}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-500">{labels.countriesEmpty}</p>
          )}
        </section>
      </div>

      <article className="border border-slate-200 bg-white px-4 py-4">
        <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          <GlobeHemisphereWest size={14} weight="duotone" className="text-accent-600" />
          {labels.scratchMapTitle}
        </p>
        <div className="mt-3 rounded-lg border border-slate-200 px-3 py-3">
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 28 }, (_, index) => (
              <span
                key={`scratch-dot-${index}`}
                className={`h-2 w-2 rounded-full ${index % 5 === 0 ? 'bg-accent-500/70' : 'bg-slate-300/80'}`}
              />
            ))}
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{labels.scratchMapDescription}</p>
      </article>
    </section>
  );
};
