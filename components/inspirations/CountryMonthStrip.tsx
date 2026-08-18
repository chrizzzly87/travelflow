import React from 'react';
import type { CountrySeasonBand } from '../../services/countryExplorerService';

interface CountryMonthStripProps {
  /** 12 curated bands, index 0 = January. */
  seasonBands: CountrySeasonBand[];
  /** Highlighted month (1-12), or `null`. */
  selectedMonth?: number | null;
  /** Full sentence naming the ideal months — the strip is decorative without it. */
  label: string;
}

/**
 * Twelve-segment "best months" preview.
 *
 * Not colour-only: the bar height also encodes the band (full = ideal, half = shoulder,
 * sliver = less ideal), and the whole strip exposes a single `role="img"` label naming the ideal
 * months, so screen readers get the meaning without walking 12 nodes.
 *
 * Direction: the segments sit in a plain flex row with no physical margins, so the month axis
 * mirrors with the document direction — which is the correct reading order for RTL locales.
 *
 * Rendered ~52x, so it stays as 12 static spans with no per-segment listeners or state.
 */
const FILL_CLASS: Record<CountrySeasonBand, string> = {
  ideal: 'h-full bg-emerald-500',
  shoulder: 'h-1/2 bg-amber-400',
  avoid: 'h-1/5 bg-slate-300',
};

const CountryMonthStripComponent: React.FC<CountryMonthStripProps> = ({
  seasonBands,
  selectedMonth = null,
  label,
}) => (
  <div className="flex h-6 items-end gap-[3px]" role="img" aria-label={label}>
    {seasonBands.map((band, index) => {
      const month = index + 1;
      const isSelected = selectedMonth === month;
      return (
        <span
          key={month}
          aria-hidden="true"
          className={[
            'flex h-full flex-1 items-end rounded-[3px] bg-slate-100',
            isSelected ? 'outline outline-2 outline-offset-1 outline-accent-500' : '',
          ].join(' ').trim()}
        >
          <span className={`w-full rounded-[3px] ${FILL_CLASS[band]}`} />
        </span>
      );
    })}
  </div>
);

export const CountryMonthStrip = React.memo(CountryMonthStripComponent);
CountryMonthStrip.displayName = 'CountryMonthStrip';
