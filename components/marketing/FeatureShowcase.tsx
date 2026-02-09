import React from 'react';
import {
    Sparkle,
    MapTrifold,
    SlidersHorizontal,
    UsersThree,
    ShareNetwork,
    LinkSimple,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';

interface Feature {
    icon: Icon;
    title: string;
    description: string;
}

const features: Feature[] = [
    {
        icon: Sparkle,
        title: 'AI Trip Creation',
        description:
            'Describe your dream trip in plain language. Our AI builds a complete, day-by-day itinerary with smart city sequencing, activity suggestions, and estimated travel times — all in under 30 seconds.',
    },
    {
        icon: MapTrifold,
        title: 'Interactive Map Styles',
        description:
            'Switch between satellite, terrain, and minimalist map layers. See your route come alive with animated path lines, city markers, and dynamic zoom that follows your scroll position.',
    },
    {
        icon: SlidersHorizontal,
        title: 'Easy Itinerary Adjustments',
        description:
            'Drag cities to reorder, stretch durations, or add spontaneous stops — all on a visual timeline. Changes cascade automatically so dates and connections always stay in sync.',
    },
    {
        icon: UsersThree,
        title: 'Community Examples',
        description:
            'Browse itineraries from fellow travelers to discover hidden gems and proven routes. Fork any community trip as a starting point for your own adventure.',
    },
    {
        icon: ShareNetwork,
        title: 'Share & Collaborate',
        description:
            'Generate a shareable link in one click. Co-travelers see the full map, timeline, and activity list — no account required. Updates sync instantly for everyone viewing the trip.',
    },
    {
        icon: LinkSimple,
        title: 'Activity Booking Links',
        description:
            'Each AI-suggested activity links directly to booking platforms. Reserve tours, restaurants, and transport without leaving your itinerary — keeping everything in one place.',
    },
];

export const FeatureShowcase: React.FC = () => {
    return (
        <section className="py-16 md:py-24">
            <div className="animate-scroll-blur-in">
                <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                    Everything you need to plan, share, and go
                </h2>
                <p className="mt-3 max-w-xl text-base text-slate-600">
                    From first spark of inspiration to boarding pass — TravelFlow handles the entire journey.
                </p>
            </div>

            <div className="mt-14 space-y-16 md:space-y-20">
                {features.map((feature, index) => {
                    const IconComponent = feature.icon;
                    const isEven = index % 2 === 0;
                    // Alternate slide direction to match the visual side
                    const slideClass = isEven
                        ? 'animate-scroll-slide-left'
                        : 'animate-scroll-slide-right';

                    return (
                        <div
                            key={feature.title}
                            className={`${slideClass} flex flex-col gap-6 md:flex-row md:items-center md:gap-12 ${
                                !isEven ? 'md:flex-row-reverse' : ''
                            }`}
                        >
                            {/* Icon container */}
                            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-accent-50 text-accent-600 shadow-sm ring-1 ring-accent-100 transition-transform duration-300 hover:scale-110 hover:shadow-md md:h-24 md:w-24">
                                <IconComponent size={40} weight="duotone" />
                            </div>

                            {/* Text */}
                            <div className="max-w-lg">
                                <h3 className="text-xl font-bold text-slate-900">
                                    {feature.title}
                                </h3>
                                <p className="mt-2 text-base leading-relaxed text-slate-600">
                                    {feature.description}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
};
