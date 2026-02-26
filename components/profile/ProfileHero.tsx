import React from 'react';
import { Link } from 'react-router-dom';

interface ProfileHeroProps {
  headline: string;
  transliteration: string;
  phonetic: string;
  context: string;
  ctaLabel: string;
  ctaHref: string;
  onCtaClick?: () => void;
  isLoading?: boolean;
  loadingLabel?: string;
  analyticsAttributes?: Record<string, string>;
}

const splitToGraphemes = (value: string): string[] => {
  if (typeof Intl !== 'undefined' && typeof (Intl as { Segmenter?: unknown }).Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(value), (segment) => segment.segment);
  }
  return Array.from(value);
};

export const ProfileHero: React.FC<ProfileHeroProps> = ({
  headline,
  transliteration,
  phonetic,
  context,
  ctaLabel,
  ctaHref,
  onCtaClick,
  isLoading = false,
  loadingLabel,
  analyticsAttributes,
}) => {
  const glyphs = React.useMemo(() => splitToGraphemes(headline), [headline]);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-accent-50/50 to-slate-50 px-5 py-7 md:px-8 md:py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(79,70,229,0.16),transparent_56%)]" />

      <div className="relative">
        {isLoading ? (
          <p className="text-sm font-semibold text-slate-500">{loadingLabel || 'Loading profile...'}</p>
        ) : (
          <h1 className="text-balance text-5xl font-black tracking-tight text-accent-700 sm:text-6xl md:text-7xl">
            {glyphs.map((character, index) => (
              <span
                key={`hero-glyph-${index}-${character}`}
                className="profile-greeting-letter inline-block whitespace-pre"
                style={{ animationDelay: `${index * 26}ms` }}
              >
                {character === ' ' ? '\u00A0' : character}
              </span>
            ))}
          </h1>
        )}

        <p className="mt-4 max-w-4xl text-base leading-7 text-slate-600 md:text-lg">
          <span className="font-semibold text-slate-900">{transliteration}</span>
          {' '}
          <span className="font-medium text-slate-500">({phonetic})</span>
          {' '}
          <span className="text-slate-600">{context}</span>
        </p>

        <div className="mt-4">
          <Link
            to={ctaHref}
            onClick={onCtaClick}
            className="inline-flex items-center rounded-full border border-accent-200 bg-white px-4 py-2 text-sm font-semibold text-accent-700 transition-colors hover:border-accent-300 hover:bg-accent-50"
            {...(analyticsAttributes || {})}
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
};
