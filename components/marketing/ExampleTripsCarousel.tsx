import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { exampleTripCards } from '../../data/exampleTripCards';
import { buildExampleTemplateMapPreviewUrl, TRIP_FACTORIES } from '../../data/exampleTripTemplates';
import { trackEvent } from '../../services/analyticsService';
import { ExampleTripCard } from './ExampleTripCard';

// Deterministic rotation per card index — alternating slight tilts
const ROTATIONS = [-2, 1.5, -1, 2, -1.5, 1, -2.5, 1.8];

export const ExampleTripsCarousel: React.FC = () => {
    const navigate = useNavigate();
    // Duplicate the cards array so the marquee loops seamlessly
    const doubledCards = [...exampleTripCards, ...exampleTripCards];

    const handleCardClick = useCallback((templateId: string) => {
        const factory = TRIP_FACTORIES[templateId];
        if (!factory) return;
        trackEvent('home__carousel_card', { template: templateId });
        navigate(`/example/${encodeURIComponent(templateId)}`);
    }, [navigate]);

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
                            return (
                                <button
                                    key={`${card.id}-${index}`}
                                    type="button"
                                    onClick={() => card.templateId && handleCardClick(card.templateId)}
                                    className="block w-[300px] md:w-[340px] flex-shrink-0 transition-transform duration-300 hover:!rotate-0 hover:scale-105 text-left cursor-pointer"
                                    style={{ transform: `rotate(${rotation}deg)` }}
                                >
                                    <ExampleTripCard card={card} mapPreviewUrl={mapPreviewUrl} />
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
};
