import React from 'react';
import { MapTrifold, ShareNetwork, Sparkle } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { FeatureSpotlightCard } from './FeatureSpotlightCard';
import { cn } from '../../../lib/utils';

export interface FeatureCapabilityItem {
    id: 'draft' | 'shape' | 'share';
    eyebrow: string;
    title: string;
    description: string;
}

/**
 * Every visual here is an artifact the product actually produces — two real
 * generated route maps and a real share card — and each one carries the motion of
 * its own verb, so the three cards no longer illustrate the same thing three
 * times. The map treatment differs too: a sparse first route for "drafted", a
 * dense many-legged one for "shaped".
 */
const capabilityVisuals: Record<FeatureCapabilityItem['id'], {
    icon: Icon;
    image: string;
    alt: 'map' | 'share';
    motion: string;
}> = {
    draft: {
        icon: Sparkle,
        // A simple first route: two anchors and a handful of legs.
        image: '/images/trip-maps/routes/portugal-lisbon-to-porto.png',
        alt: 'map',
        motion: 'tf-capability-draw',
    },
    shape: {
        icon: MapTrifold,
        // The same idea after it has been worked on: more stops, more legs.
        image: '/images/trip-maps/routes/cambodia-mekong-and-north.png',
        alt: 'map',
        motion: 'tf-capability-handle',
    },
    share: {
        icon: ShareNetwork,
        // A real generated share card, pinned to a stable path: the OG originals
        // are content-hashed and renamed whenever `og:site:build` reruns.
        image: '/images/marketing/features-share-preview.png',
        alt: 'share',
        motion: 'tf-capability-settle',
    },
};

export const FeaturesCapabilities: React.FC<{ items: FeatureCapabilityItem[] }> = ({ items }) => (
    <div className="tf-stagger-entry grid gap-5 md:grid-cols-3">
        {items.map((item) => {
            const visual = capabilityVisuals[item.id];
            const IconComponent = visual?.icon ?? Sparkle;
            const isShareCard = visual?.alt === 'share';

            return (
                <FeatureSpotlightCard key={item.id} className="group animate-scroll-fade-up h-full">
                    <div className="relative z-10 flex h-full flex-col">
                        <div
                            className={cn(
                                'relative h-44 overflow-hidden border-b border-border/70',
                                isShareCard ? 'bg-accent-50 dark:bg-accent-950/40' : 'bg-secondary',
                            )}
                        >
                            <img
                                src={visual?.image}
                                alt=""
                                aria-hidden="true"
                                width={1280}
                                height={576}
                                loading="lazy"
                                decoding="async"
                                className={cn(
                                    visual?.motion,
                                    isShareCard
                                        // Inset and tilted, the way a link preview sits in a chat.
                                        ? 'absolute inset-x-8 top-7 w-[calc(100%-4rem)] rounded-lg border border-border/70 shadow-lg shadow-slate-900/10 dark:shadow-black/40'
                                        // Route maps are drawn on a light basemap; invert for dark.
                                        : 'size-full object-cover dark:[filter:invert(0.9)_hue-rotate(180deg)_saturate(1.25)]',
                                )}
                            />
                            {!isShareCard ? (
                                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-transparent" />
                            ) : null}
                            <div className="absolute bottom-4 start-5 z-10 flex size-10 items-center justify-center rounded-xl border border-border bg-card/90 text-accent-700 backdrop-blur-sm dark:text-accent-200">
                                <IconComponent size={18} weight="duotone" />
                            </div>
                        </div>

                        <div className="flex flex-1 flex-col gap-2 px-6 pb-7 pt-6">
                            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-accent-700 dark:text-accent-300">
                                {item.eyebrow}
                            </p>
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
