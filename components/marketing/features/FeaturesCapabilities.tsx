import React from 'react';
import { MapTrifold, ShareNetwork, Sparkle } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { FeatureSpotlightCard } from './FeatureSpotlightCard';

export interface FeatureCapabilityItem {
    id: 'draft' | 'shape' | 'share';
    title: string;
    description: string;
}

interface CapabilityVisual {
    icon: Icon;
    /** A real generated trip map, not a mock of the product UI. */
    image: string;
}

const capabilityVisuals: Record<FeatureCapabilityItem['id'], CapabilityVisual> = {
    draft: { icon: Sparkle, image: '/images/trip-maps/southeast-asia-backpacking.png' },
    shape: { icon: MapTrifold, image: '/images/trip-maps/portugal-coast.png' },
    share: { icon: ShareNetwork, image: '/images/trip-maps/japan-spring.png' },
};

export const FeaturesCapabilities: React.FC<{ items: FeatureCapabilityItem[] }> = ({ items }) => (
    <div className="tf-stagger-entry grid gap-5 md:grid-cols-3">
        {items.map((item) => {
            const visual = capabilityVisuals[item.id];
            const IconComponent = visual?.icon ?? Sparkle;

            return (
                <FeatureSpotlightCard key={item.id} className="group animate-scroll-fade-up h-full">
                    <div className="relative z-10 flex h-full flex-col">
                        <div className="relative h-44 overflow-hidden border-b border-border/70">
                            {/* The trip maps are drawn on a light basemap. Inverting and rotating
                                the hue back turns them into a dark basemap in dark mode while the
                                route keeps roughly its own colour. */}
                            <img
                                src={visual?.image}
                                alt=""
                                aria-hidden="true"
                                width={1280}
                                height={576}
                                loading="lazy"
                                decoding="async"
                                className="size-full scale-[1.35] object-cover transition-transform duration-700 ease-out group-hover:scale-[1.42] dark:[filter:invert(0.9)_hue-rotate(180deg)_saturate(1.25)]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-card/10" />
                            <div className="absolute bottom-4 start-5 flex size-10 items-center justify-center rounded-xl border border-border bg-card/90 text-accent-700 backdrop-blur-sm dark:text-accent-200">
                                <IconComponent size={18} weight="duotone" />
                            </div>
                        </div>

                        <div className="flex flex-1 flex-col gap-2 px-6 pb-7 pt-6">
                            <h3 className="text-balance text-xl font-semibold tracking-tight text-foreground">
                                {item.title}
                            </h3>
                            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
                                {item.description}
                            </p>
                        </div>
                    </div>
                </FeatureSpotlightCard>
            );
        })}
    </div>
);
