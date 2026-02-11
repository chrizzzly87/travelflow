import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkle, ShareNetwork, LinkSimple, RocketLaunch } from '@phosphor-icons/react';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { PlaneWindowAnimation } from './PlaneWindowAnimation';

/** Animated hand-drawn zigzag underline SVG */
const ZigzagUnderline: React.FC = () => (
    <svg
        className="pointer-events-none absolute -bottom-[10%] left-0 w-full"
        viewBox="0 0 200 14"
        fill="none"
        preserveAspectRatio="none"
        style={{ height: '0.18em' }}
    >
        <path
            d="M 2 8 L 18 3 L 36 10 L 54 2 L 71 9 L 88 3 L 106 10 L 123 2 L 140 9 L 157 3 L 174 10 L 191 4 L 198 7"
            stroke="var(--tf-accent-400)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="hand-drawn-zigzag"
            style={{ filter: 'url(#zigzag-roughen)' }}
        />
        <defs>
            <filter id="zigzag-roughen" x="-5%" y="-20%" width="110%" height="140%">
                <feTurbulence type="turbulence" baseFrequency="0.035" numOctaves="3" seed="7" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" xChannelSelector="R" yChannelSelector="G" />
            </filter>
        </defs>
    </svg>
);

export const HeroSection: React.FC = () => {
    const handleCtaClick = (ctaName: string) => {
        trackEvent(`home__hero_cta--${ctaName}`);
    };

    const heroCtaDebugAttributes = (ctaName: string) =>
        getAnalyticsDebugAttributes(`home__hero_cta--${ctaName}`);

    return (
        <section className="relative pt-8 pb-16 md:pt-16 md:pb-24">
            {/* Decorative gradient blobs */}
            <div className="pointer-events-none absolute -right-32 -top-20 h-[420px] w-[420px] rounded-full bg-accent-300/40 blur-[100px]" />
            <div className="pointer-events-none absolute -bottom-32 -left-20 h-[380px] w-[380px] rounded-full bg-accent-200/50 blur-[100px]" />

            <div className="relative flex items-center gap-8 lg:gap-12">
            <div className="max-w-3xl flex-1">
                {/* Badge pill — stagger 0 */}
                <div className="animate-hero-stagger" style={{ '--stagger': '0ms' } as React.CSSProperties}>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-700">
                        <Sparkle size={14} weight="duotone" />
                        AI-Powered Trip Planning
                    </span>
                </div>

                {/* Heading — stagger 80ms */}
                <div className="animate-hero-stagger" style={{ '--stagger': '80ms' } as React.CSSProperties}>
                    <h1 className="mt-6 text-5xl font-black tracking-tight text-slate-900 md:text-7xl" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                        Your next adventure, planned{' '}
                        <span className="relative inline-block">
                            in seconds
                            <ZigzagUnderline />
                        </span>
                    </h1>
                </div>

                {/* Subheading — stagger 160ms */}
                <div className="animate-hero-stagger" style={{ '--stagger': '160ms' } as React.CSSProperties}>
                    <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 md:text-xl">
                        Tell us where you want to go and when — our AI builds a complete, day-by-day itinerary with optimized routes, curated activities, and real booking links. Adjust everything on a visual timeline and map, then share with your travel crew in one click.
                    </p>
                </div>

                {/* CTAs — stagger 240ms */}
                <div className="mt-10 flex flex-wrap items-center gap-4 animate-hero-stagger" style={{ '--stagger': '240ms' } as React.CSSProperties}>
                    <Link
                        to="/create-trip"
                        onClick={() => handleCtaClick('start_planning')}
                        className="group relative rounded-2xl bg-accent-600 px-7 py-3.5 text-base font-bold text-white shadow-lg shadow-accent-200 transition-all hover:bg-accent-700 hover:shadow-xl hover:shadow-accent-300 hover:scale-[1.02] active:scale-[0.98]"
                        {...heroCtaDebugAttributes('start_planning')}
                    >
                        Start Planning
                    </Link>
                    <a
                        href="#examples"
                        onClick={() => handleCtaClick('see_examples')}
                        className="rounded-2xl border border-slate-300 bg-white px-7 py-3.5 text-base font-bold text-slate-700 transition-all hover:border-slate-400 hover:text-slate-900 hover:shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                        {...heroCtaDebugAttributes('see_examples')}
                    >
                        See Example Trips
                    </a>
                </div>

                {/* Floating feature pills — stagger 360ms, with gentle float */}
                <div className="mt-8 flex flex-wrap gap-2.5 animate-hero-stagger" style={{ '--stagger': '360ms' } as React.CSSProperties}>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm animate-float" style={{ '--float-delay': '0ms' } as React.CSSProperties}>
                        <RocketLaunch size={14} weight="duotone" className="text-accent-500" />
                        AI-generated itineraries
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm animate-float" style={{ '--float-delay': '600ms' } as React.CSSProperties}>
                        <ShareNetwork size={14} weight="duotone" className="text-accent-500" />
                        Share & collaborate
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm animate-float" style={{ '--float-delay': '1200ms' } as React.CSSProperties}>
                        <LinkSimple size={14} weight="duotone" className="text-accent-500" />
                        Booking links
                    </span>
                </div>
            </div>

            {/* Plane window animation — visible on lg+ */}
            <div className="hidden lg:block w-[280px] xl:w-[320px] shrink-0 animate-hero-stagger" style={{ '--stagger': '400ms' } as React.CSSProperties}>
                <PlaneWindowAnimation />
            </div>
            </div>
        </section>
    );
};
