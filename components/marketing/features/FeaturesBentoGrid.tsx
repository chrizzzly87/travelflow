import React, { useEffect, useRef, useState } from 'react';
import { AirplaneTakeoff, LinkSimple, MapTrifold, Printer, ShareNetwork, Sparkle } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { Card, CardContent } from '../../ui/card';
import { cn } from '../../../lib/utils';
import { FeaturesAirportBentoVisual } from './FeaturesAirportBentoVisual';

const AIRPORT_BENTO_VISIBLE_AREA_RATIO = 0.72;

export interface FeatureBentoItem {
    id: 'itinerary' | 'airport' | 'timeline' | 'inspiration' | 'sharing' | 'relive';
    eyebrow: string;
    title: string;
    description: string;
    detail: string;
}

interface BentoVisualProps {
    item: FeatureBentoItem;
}

interface FeatureCardShellProps {
    IconComponent?: Icon;
    index: number;
    item: FeatureBentoItem;
    children: React.ReactNode;
    hideEyebrow?: boolean;
}

const layoutClasses: Record<FeatureBentoItem['id'], string> = {
    itinerary: 'md:col-span-3',
    airport: 'md:col-span-6',
    timeline: 'md:col-span-3',
    inspiration: 'md:col-span-2',
    sharing: 'md:col-span-2',
    relive: 'md:col-span-2',
};

const iconMap: Record<FeatureBentoItem['id'], Icon> = {
    itinerary: Sparkle,
    airport: AirplaneTakeoff,
    timeline: MapTrifold,
    inspiration: LinkSimple,
    sharing: ShareNetwork,
    relive: Printer,
};

const ItineraryVisual: React.FC<BentoVisualProps> = ({ item }) => (
    <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-wrap gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-slate-500">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Lisbon</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Porto</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Bilbao</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1">Bordeaux</span>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
            <div className="rounded-[14px] border border-slate-200 bg-white p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Draft route
                </div>
                <div className="mt-4 flex items-center gap-3 text-sm font-medium text-slate-700">
                    <span>Coast cities</span>
                    <span className="h-px flex-1 bg-slate-200" />
                    <span>Train-friendly</span>
                    <span className="h-px flex-1 bg-slate-200" />
                    <span>Late sunsets</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[12px] bg-slate-50 p-3">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Trip rhythm</p>
                        <p className="mt-2 text-lg font-bold text-slate-950">Slow mornings, packed evenings</p>
                    </div>
                    <div className="rounded-[12px] border border-accent-200 bg-accent-50 p-3 text-accent-800">
                        <p className="text-xs uppercase tracking-[0.18em] text-accent-700">Ready in</p>
                        <p className="mt-2 text-3xl font-black">26s</p>
                    </div>
                </div>
            </div>
            <div className="rounded-[14px] border border-slate-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Why it lands</p>
                <p className="mt-3 text-lg font-bold text-slate-950">{item.detail}</p>
                <div className="mt-4 grid gap-2 text-sm text-slate-700">
                    <span className="rounded-full bg-slate-50 px-3 py-2">AI route draft</span>
                    <span className="rounded-full bg-slate-50 px-3 py-2">Activity context</span>
                    <span className="rounded-full bg-slate-50 px-3 py-2">Booking-ready notes</span>
                </div>
            </div>
        </div>
    </div>
);

const TimelineVisual: React.FC<BentoVisualProps> = ({ item }) => (
    <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <span>Route edits</span>
            <span>{item.detail}</span>
        </div>
        <div className="mt-5 grid gap-3">
            {['Day 03', 'Day 05', 'Day 08'].map((day, index) => (
                <div key={day} className="flex items-start gap-3 rounded-[12px] border border-slate-200 bg-white p-3 shadow-sm">
                    <div className={cn(
                        'mt-1 size-3 rounded-full',
                        day === 'Day 03' ? 'bg-accent-500' : day === 'Day 05' ? 'bg-slate-400' : 'bg-slate-300',
                    )}
                    />
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{day}</p>
                        <p className="mt-1 text-sm font-medium text-slate-700">
                            {index === 0 ? 'Stretch beach time in Porto' : index === 1 ? 'Swap train for ferry' : 'Pull dinner closer to the hotel'}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const InspirationVisual: React.FC<BentoVisualProps> = ({ item }) => (
    <div className="overflow-hidden rounded-[16px] border border-slate-200 bg-white">
        <div className="relative h-48 overflow-hidden">
            <img
                src="/images/inspirations/cherry-blossom-trail-480.webp"
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                loading="lazy"
            />
            <div className="absolute inset-x-4 bottom-4 rounded-[12px] border border-slate-200 bg-white/96 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-700">{item.detail}</p>
                <p className="mt-2 text-lg font-bold text-slate-950">Fork a route that already feels believable</p>
            </div>
        </div>
    </div>
);

const SharingVisual: React.FC<BentoVisualProps> = ({ item }) => (
    <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <span>Crew loop</span>
            <span>{item.detail}</span>
        </div>
        <div className="mt-5 flex -space-x-2">
            {['M', 'J', 'A', 'L'].map((letter, index) => (
                <div
                    key={letter}
                    className={cn(
                        'flex size-11 items-center justify-center rounded-full border-2 border-white text-sm font-bold text-white shadow-sm',
                        index === 0 ? 'bg-accent-600' : index === 1 ? 'bg-slate-500' : index === 2 ? 'bg-slate-400' : 'bg-slate-300',
                    )}
                >
                    {letter}
                </div>
            ))}
        </div>
        <div className="mt-5 grid gap-3">
            <div className="rounded-[12px] border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm">
                “Can we keep one slower day here?”
            </div>
            <div className="rounded-[12px] border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm">
                “This route finally makes sense.”
            </div>
        </div>
    </div>
);

const ReliveVisual: React.FC<BentoVisualProps> = ({ item }) => (
    <div className="rounded-[16px] border border-slate-200 bg-slate-50 p-5">
        <div className="grid gap-3">
            <div className="rounded-[14px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Final handoff</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{item.detail}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Print view
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Notes intact
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        Links attached
                    </span>
                </div>
            </div>
            <div className="rounded-[14px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                A shareable plan for the trip and a cleaner memory of how it came together.
            </div>
        </div>
    </div>
);

const BentoVisual: React.FC<BentoVisualProps> = ({ item }) => {
    switch (item.id) {
        case 'itinerary':
            return <ItineraryVisual item={item} />;
        case 'timeline':
            return <TimelineVisual item={item} />;
        case 'inspiration':
            return <InspirationVisual item={item} />;
        case 'sharing':
            return <SharingVisual item={item} />;
        case 'relive':
            return <ReliveVisual item={item} />;
        default:
            return null;
    }
};

const FeatureCardShell: React.FC<FeatureCardShellProps> = ({ IconComponent, index, item, children, hideEyebrow = false }) => (
    <Card
        className="group h-full animate-scroll-fade-up overflow-hidden rounded-[18px] border-slate-200 bg-white py-0 shadow-sm shadow-slate-200/60 transition-all hover:-translate-y-1 hover:shadow-md hover:shadow-slate-200/80"
        style={{ animationDelay: `${index * 90}ms` }}
    >
        <CardContent className="flex h-full flex-col gap-6 px-6 pb-6 pt-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    {!hideEyebrow && item.eyebrow ? (
                        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-accent-700">
                            {item.eyebrow}
                        </p>
                    ) : null}
                    <h3 className={cn('text-2xl font-black tracking-tight text-slate-950', hideEyebrow ? '' : 'mt-2')}>
                        {item.title}
                    </h3>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
                        {item.description}
                    </p>
                </div>
                {IconComponent ? (
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-accent-700 shadow-sm">
                        <IconComponent size={20} weight="regular" />
                    </div>
                ) : null}
            </div>
            <div className="mt-auto">{children}</div>
        </CardContent>
    </Card>
);

const AirportBentoCard: React.FC<{ index: number; item: FeatureBentoItem }> = ({
    index,
    item,
}) => {
    const cardRef = useRef<HTMLDivElement | null>(null);
    const [isAirportVisualActive, setIsAirportVisualActive] = useState(false);

    useEffect(() => {
        if (isAirportVisualActive) return;

        const node = cardRef.current;
        if (!node || typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
            setIsAirportVisualActive(true);
            return;
        }

        const activate = () => {
            setIsAirportVisualActive(true);
        };

        const isMostlyVisible = () => {
            const rect = node.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) {
                return false;
            }
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
            const visibleHeight = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));
            const visibleWidth = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
            const visibleArea = visibleHeight * visibleWidth;
            const totalArea = Math.max(rect.width * rect.height, 1);
            const fullyVisible = rect.top >= 0
                && rect.left >= 0
                && rect.bottom <= viewportHeight
                && rect.right <= viewportWidth;

            return fullyVisible || (visibleArea / totalArea) >= AIRPORT_BENTO_VISIBLE_AREA_RATIO;
        };

        const observer = new window.IntersectionObserver((entries) => {
            const isVisibleEnough = entries.some((entry) => (
                entry.isIntersecting && entry.intersectionRatio >= AIRPORT_BENTO_VISIBLE_AREA_RATIO
            ));
            if (!isVisibleEnough && !isMostlyVisible()) return;
            activate();
            observer.disconnect();
        }, {
            threshold: [0, AIRPORT_BENTO_VISIBLE_AREA_RATIO, 1],
        });

        const handleViewportChange = () => {
            if (!isMostlyVisible()) return;
            activate();
            observer.disconnect();
            window.removeEventListener('scroll', handleViewportChange);
            window.removeEventListener('resize', handleViewportChange);
        };

        observer.observe(node);
        window.addEventListener('scroll', handleViewportChange, { passive: true });
        window.addEventListener('resize', handleViewportChange);
        handleViewportChange();

        return () => {
            observer.disconnect();
            window.removeEventListener('scroll', handleViewportChange);
            window.removeEventListener('resize', handleViewportChange);
        };
    }, [isAirportVisualActive]);

    return (
        <div
            ref={cardRef}
            className={layoutClasses[item.id]}
            data-testid="features-airport-card"
        >
            <Card
                className="group h-full animate-scroll-fade-up overflow-hidden rounded-[18px] border-slate-200 bg-white py-0 shadow-sm shadow-slate-200/60 transition-all hover:-translate-y-1 hover:shadow-md hover:shadow-slate-200/80"
                style={{ animationDelay: `${index * 90}ms` }}
            >
                <CardContent className="grid gap-6 px-5 py-5 sm:px-6 sm:py-6 lg:grid-cols-[minmax(0,1fr)_minmax(420px,auto)] lg:items-center lg:gap-12 xl:grid-cols-[minmax(0,0.95fr)_minmax(500px,auto)]">
                    <div className="min-w-0">
                        <h3 className="text-2xl font-black tracking-tight text-slate-950">
                            {item.title}
                        </h3>
                        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-base">
                            {item.description}
                        </p>
                    </div>

                    <div className="min-w-0">
                        <FeaturesAirportBentoVisual isActive={isAirportVisualActive} />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export const FeaturesBentoGrid: React.FC<{ items: FeatureBentoItem[] }> = ({ items }) => {
    return (
        <div className="grid gap-5 md:grid-cols-6 md:auto-rows-[minmax(220px,auto)]">
            {items.map((item, index) => {
                const IconComponent = iconMap[item.id];

                if (item.id === 'airport') {
                    return (
                        <AirportBentoCard
                            key={item.id}
                            index={index}
                            item={item}
                        />
                    );
                }

                return (
                    <div key={item.id} className={layoutClasses[item.id]}>
                        <FeatureCardShell IconComponent={IconComponent} index={index} item={item}>
                            <BentoVisual item={item} />
                        </FeatureCardShell>
                    </div>
                );
            })}
        </div>
    );
};
