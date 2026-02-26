import React from 'react';
import { Link } from 'react-router-dom';
import { FlagIcon } from '../flags/FlagIcon';

interface ProfileHeroProps {
  greeting: string;
  name: string;
  transliteration: string;
  ipa: string;
  context: string;
  ctaIntroLabel: string;
  ctaLinkLabel: string;
  ctaHref: string;
  inspirationCountryCode?: string | null;
  onCtaClick?: () => void;
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
  greeting,
  name,
  transliteration,
  ipa,
  context,
  ctaIntroLabel,
  ctaLinkLabel,
  ctaHref,
  inspirationCountryCode,
  onCtaClick,
  analyticsAttributes,
}) => {
  const greetingGlyphs = React.useMemo(() => splitToGraphemes(greeting), [greeting]);

  return (
    <section className="py-8 md:py-12">
      <div className="mx-auto max-w-5xl text-center">
        <h1 className="text-balance text-5xl font-black tracking-tight text-slate-900 sm:text-6xl md:text-7xl">
          <span className="text-accent-700">
            {greetingGlyphs.map((character, index) => (
              <span
                key={`hero-glyph-${index}-${character}`}
                className="profile-greeting-letter inline-block whitespace-pre"
                style={{ animationDelay: `${index * 24}ms` }}
              >
                {character === ' ' ? '\u00A0' : character}
              </span>
            ))}
          </span>
          <span>{`, ${name}`}</span>
        </h1>

        <p className="mt-5 text-base leading-7 text-slate-600 md:text-lg">
          <span className="font-semibold text-slate-900">{transliteration}</span>
          {' '}
          <span className="font-medium text-slate-700">/{ipa}/</span>
          {' '}
          <span>{context}</span>
        </p>

        <p className="mt-3 inline-flex flex-wrap items-center justify-center gap-1.5 text-sm text-slate-600">
          <span>{ctaIntroLabel}</span>
          <Link
            to={ctaHref}
            onClick={onCtaClick}
            className="inline-flex items-center gap-1 text-sm font-semibold text-accent-600 transition-colors hover:text-accent-800"
            {...(analyticsAttributes || {})}
          >
            <FlagIcon code={inspirationCountryCode} size="sm" fallback={null} />
            {ctaLinkLabel}
          </Link>
        </p>
      </div>
    </section>
  );
};
