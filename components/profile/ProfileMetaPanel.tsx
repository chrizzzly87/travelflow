import React from 'react';
import { MapPin, Mountains } from '@phosphor-icons/react';
import { FlagIcon } from '../flags/FlagIcon';
import type { VisitedCountry } from './profileCountryUtils';
import type { ProfileStampProgress } from './profileStamps';
import { ProfilePassportBook } from './ProfilePassportBook';

interface ProfileMetaPanelLabels {
  bio: string;
  bioFallback: string;
  location: string;
  distance: string;
  countries: string;
  countriesEmpty: string;
  stampsTitle: string;
  stampsDescription: string;
  stampsOpen: string;
}

interface ProfileMetaPanelProps {
  bio: string;
  location: string;
  distanceLabel: string;
  countries: VisitedCountry[];
  stamps: ProfileStampProgress[];
  passportCountryCode?: string;
  onOpenPassport?: () => void;
  labels: ProfileMetaPanelLabels;
}

export const ProfileMetaPanel: React.FC<ProfileMetaPanelProps> = ({
  bio,
  location,
  distanceLabel,
  countries,
  stamps,
  passportCountryCode,
  onOpenPassport,
  labels,
}) => {
  const handleOpenPassport = React.useCallback(() => {
    onOpenPassport?.();
  }, [onOpenPassport]);

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.62fr)]">
      <div className="space-y-6">
        <section>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{labels.bio}</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">{bio || labels.bioFallback}</p>
        </section>

        <section className="grid gap-4 border-y border-slate-200 py-4 sm:grid-cols-2">
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

      <ProfilePassportBook
        title={labels.stampsTitle}
        description={labels.stampsDescription}
        openLabel={labels.stampsOpen}
        stamps={stamps}
        onOpen={handleOpenPassport}
        countryCode={passportCountryCode}
      />
    </section>
  );
};
