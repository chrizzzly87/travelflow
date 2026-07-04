import React from 'react';
import { AirplaneTilt } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';

const BOARD_ROW_KEYS = ['tokyo', 'lisbon', 'reykjavik', 'bali'] as const;

const STATUS_TONES: Record<(typeof BOARD_ROW_KEYS)[number], string> = {
    tokyo: 'bg-amber-400/15 text-amber-300 ring-amber-400/30',
    lisbon: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30',
    reykjavik: 'bg-sky-400/15 text-sky-300 ring-sky-400/30',
    bali: 'bg-rose-400/15 text-rose-300 ring-rose-400/30',
};

interface ScrubbedHeadlineProps {
    text: string;
}

// Splits the headline into words so each word brightens in sequence as the
// band scrolls through the viewport (pure CSS scroll-timeline, no JS).
const ScrubbedHeadline: React.FC<ScrubbedHeadlineProps> = ({ text }) => (
    <>
        {text.split(' ').map((word, index) => (
            <React.Fragment key={`${word}-${index}`}>
                <span className="tf-promo-word" style={{ '--wi': index } as React.CSSProperties}>
                    {word}
                </span>{' '}
            </React.Fragment>
        ))}
    </>
);

export const NightFlightSection: React.FC = () => {
    const { t } = useTranslation('home');

    return (
        <section className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden bg-slate-950 text-white">
            <div className="tf-stars" aria-hidden="true" />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-40 start-1/4 size-96 rounded-full bg-accent-600/25 blur-[120px]"
            />
            <div className="relative mx-auto w-full max-w-7xl px-5 py-20 md:px-8 md:py-28">
                <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
                    <div>
                        <h2 className="text-balance text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
                            <ScrubbedHeadline text={t('nightFlight.headline')} />
                        </h2>
                        <p className="animate-scroll-fade-in mt-6 max-w-xl text-pretty text-lg text-slate-400 md:text-xl">
                            {t('nightFlight.subline')}
                        </p>
                    </div>

                    <div className="animate-scroll-fade-up rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-sm md:p-7">
                        <div className="flex items-center justify-between gap-3">
                            <span className="font-mono text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
                                {t('nightFlight.board.title')}
                            </span>
                            <AirplaneTilt size={18} weight="duotone" className="text-amber-300" aria-hidden="true" />
                        </div>
                        <ul className="mt-5 space-y-4">
                            {BOARD_ROW_KEYS.map((rowKey, index) => (
                                <li
                                    key={rowKey}
                                    className="animate-scroll-fade-up tf-stagger-range"
                                    style={{ '--wi': index } as React.CSSProperties}
                                >
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="font-mono text-sm font-semibold uppercase tracking-widest">
                                            {t(`nightFlight.board.rows.${rowKey}.destination`)}
                                        </span>
                                        <span
                                            className={`shrink-0 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest ring-1 ${STATUS_TONES[rowKey]}`}
                                        >
                                            {t(`nightFlight.board.rows.${rowKey}.status`)}
                                        </span>
                                    </div>
                                    <p className="mt-1 border-b border-dashed border-white/10 pb-3 text-xs text-slate-400">
                                        {t(`nightFlight.board.rows.${rowKey}.note`)}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Scroll-drawn route across the bottom of the band */}
                <svg
                    aria-hidden="true"
                    className="mt-16 hidden w-full md:block"
                    viewBox="0 0 1200 200"
                    fill="none"
                >
                    <path
                        className="tf-promo-route"
                        d="M20 150 C 220 40, 420 190, 620 110 S 1020 30, 1180 96"
                        stroke="rgb(255 255 255 / 0.12)"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                    <path
                        className="tf-promo-route-progress"
                        d="M20 150 C 220 40, 420 190, 620 110 S 1020 30, 1180 96"
                        stroke="var(--tf-accent-400)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        pathLength="100"
                    />
                    {[
                        { cx: 20, cy: 150 },
                        { cx: 620, cy: 110 },
                        { cx: 1180, cy: 96 },
                    ].map((point) => (
                        <circle
                            key={`${point.cx}-${point.cy}`}
                            cx={point.cx}
                            cy={point.cy}
                            r="5"
                            fill="var(--tf-accent-400)"
                            opacity="0.9"
                        />
                    ))}
                    <g className="tf-promo-route-plane">
                        <path
                            d="M0 -7 L14 0 L0 7 L3.5 0 Z"
                            fill="#fbbf24"
                        />
                    </g>
                </svg>
            </div>
        </section>
    );
};
