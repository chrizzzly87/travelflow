import React from 'react';
import { Link } from 'react-router-dom';
import { exampleTripCards } from '../../data/exampleTripCards';
import { buildExampleTemplateMapPreviewUrl } from '../../data/exampleTripTemplates';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { ExampleTripCard } from './ExampleTripCard';

// Deterministic rotation per card index — alternating slight tilts
const ROTATIONS = [-2, 1.5, -1, 2, -1.5, 1, -2.5, 1.8];

export const ExampleTripsCarousel: React.FC = () => {
    // Duplicate the cards array so the marquee loops seamlessly
    const doubledCards = [...exampleTripCards, ...exampleTripCards];

    const handleCardClick = (templateId: string) => {
        trackEvent('home__carousel_card', { template: templateId });
    };

    return (
        <section id="examples" className="py-16 md:py-24">
            {/* Heading stays within parent max-w via normal flow */}
            <div className="animate-scroll-blur-in">
                <h2 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                    Trips built with TravelFlow
                </h2>
                <p className="mt-3 max-w-xl text-base text-slate-600">
                    Browse real itineraries created by our community — from week-long island getaways to cross-country road trips.
                </p>
            </div>

            {/* Full-width breakout container */}
            <div className="relative mt-12 -mx-5 md:-mx-8 lg:mx-[calc(-50vw+50%)] overflow-hidden">
                {/* Fade edges */}
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-slate-50 to-transparent md:w-24" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-slate-50 to-transparent md:w-24" />

                {/* Marquee track — pauses on hover */}
                <div className="group py-6">
                    <div
                        className="flex w-max gap-6 animate-marquee group-hover:[animation-play-state:paused]"
                        style={{ '--marquee-duration': '60s' } as React.CSSProperties}
                    >
                        {doubledCards.map((card, index) => {
                            const rotation = ROTATIONS[index % ROTATIONS.length];
                            const mapPreviewUrl = card.templateId
                                ? buildExampleTemplateMapPreviewUrl(card.templateId)
                                : null;
                            const examplePath = card.templateId
                                ? `/example/${encodeURIComponent(card.templateId)}`
                                : null;

                            if (!examplePath) {
                                return (
                                    <div
                                        key={`${card.id}-${index}`}
                                        className="block w-[300px] md:w-[340px] flex-shrink-0 text-left"
                                        style={{ transform: `rotate(${rotation}deg)` }}
                                    >
                                        <ExampleTripCard card={card} mapPreviewUrl={mapPreviewUrl} />
                                    </div>
                                );
                            }

                            return (
                                <Link
                                    key={`${card.id}-${index}`}
                                    to={examplePath}
                                    onClick={() => handleCardClick(card.templateId!)}
                                    data-prefetch-href={examplePath}
                                    className="block w-[300px] md:w-[340px] flex-shrink-0 transition-transform duration-300 hover:!rotate-0 hover:scale-105 text-left cursor-pointer"
                                    style={{ transform: `rotate(${rotation}deg)` }}
                                    {...(card.templateId
                                        ? getAnalyticsDebugAttributes('home__carousel_card', { template: card.templateId })
                                        : {})}
                                >
                                    <ExampleTripCard card={card} mapPreviewUrl={mapPreviewUrl} />
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
};
