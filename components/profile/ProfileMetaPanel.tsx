import React from 'react';
import { FlagIcon } from '../flags/FlagIcon';
import type { VisitedCountry } from './profileCountryUtils';
import type { ProfileStampProgress } from './profileStamps';
import { ProfilePassportBook } from './ProfilePassportBook';
import { PASSPORT_FEATURE_ENABLED } from '../../services/passportService';

interface ProfileMetaPanelLabels {
  countries: string;
  countriesEmpty: string;
  stampsTitle: string;
  stampsDescription: string;
  stampsOpen: string;
}

interface ProfileMetaPanelProps {
  countries: VisitedCountry[];
  stamps: ProfileStampProgress[];
  passportCountryCode?: string;
  onOpenPassport?: (rect: DOMRect) => void;
  labels: ProfileMetaPanelLabels;
}

export const ProfileMetaPanel: React.FC<ProfileMetaPanelProps> = ({
  countries,
  stamps,
  passportCountryCode,
  onOpenPassport,
  labels,
}) => {
  const handleOpenPassport = React.useCallback((rect: DOMRect) => {
    onOpenPassport?.(rect);
  }, [onOpenPassport]);

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.62fr)]">
      <section>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{labels.countries}</p>
        {countries.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {countries.map((country) => (
              <span
                key={`country-${country.name}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground"
              >
                <FlagIcon code={country.code} size="xs" fallback={null} />
                <span>{country.name}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">{labels.countriesEmpty}</p>
        )}
      </section>

      {PASSPORT_FEATURE_ENABLED ? (
        <section className="space-y-2">
          <header className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{labels.stampsTitle}</p>
            {labels.stampsDescription ? (
              <p className="text-sm text-muted-foreground">{labels.stampsDescription}</p>
            ) : null}
          </header>
          <ProfilePassportBook
            title={labels.stampsTitle}
            openLabel={labels.stampsOpen}
            stamps={stamps}
            onOpen={handleOpenPassport}
            countryCode={passportCountryCode}
          />
        </section>
      ) : null}
    </section>
  );
};
