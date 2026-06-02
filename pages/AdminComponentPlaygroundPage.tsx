import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Clipboard, Eye, MapPin, Pin, RotateCcw, Star, Tag, Trophy } from 'lucide-react';
import { AdminShell } from '../components/admin/AdminShell';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Slider } from '../components/ui/slider';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { showAppToast } from '../components/ui/appToast';
import { cn } from '../lib/utils';
import { trackEvent } from '../services/analyticsService';

type GlobePaletteId = 'lavender' | 'coastal' | 'ember';
type CtaAudienceId = 'planner' | 'profile' | 'launch';
type ExampleTripTemplateId = 'japan' | 'portugal' | 'iceland';
type BlogCardCategoryId = 'product' | 'travel' | 'engineering';
type ProfileTripStatusId = 'active' | 'expired' | 'generationFailed';
type StampRarityId = 'common' | 'rare' | 'legendary';
type FeatureCardVariantId = 'planner' | 'maps' | 'profile';
type AdminSurfaceStateId = 'healthy' | 'attention' | 'blocked';
type CalendarCardScopeId = 'single' | 'series' | 'festival';

interface GlobePlaygroundSettings {
    palette: GlobePaletteId;
    scale: number;
    rotationSpeed: number;
    mapBrightness: number;
    arcHeight: number;
    markerElevation: number;
    theta: number;
    animated: boolean;
}

interface CtaPlaygroundSettings {
    audience: CtaAudienceId;
    showSecondaryAction: boolean;
}

interface ExampleTripCardSettings {
    template: ExampleTripTemplateId;
    showCreator: boolean;
    showMiniCalendar: boolean;
}

interface BlogCardSettings {
    category: BlogCardCategoryId;
    language: 'en' | 'de';
    featured: boolean;
    readingMinutes: number;
}

interface ProfileTripCardSettings {
    status: ProfileTripStatusId;
    showActions: boolean;
    isFavorite: boolean;
    isPinned: boolean;
    isPublic: boolean;
}

interface StampCardSettings {
    rarity: StampRarityId;
    achieved: boolean;
    selected: boolean;
}

interface FeatureCardSettings {
    variant: FeatureCardVariantId;
    showMetric: boolean;
    showMedia: boolean;
}

interface AdminSurfaceSettings {
    state: AdminSurfaceStateId;
    showMetadata: boolean;
    showAction: boolean;
}

interface CalendarCardSettings {
    scope: CalendarCardScopeId;
    showDescription: boolean;
    eventCount: number;
}

interface SliderControlProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    suffix?: string;
    onChange: (value: number) => void;
}

const GLOBE_DEFAULTS: GlobePlaygroundSettings = {
    palette: 'lavender',
    scale: 0.94,
    rotationSpeed: 1.35,
    mapBrightness: 6.1,
    arcHeight: 0.78,
    markerElevation: 0.025,
    theta: 0.16,
    animated: true,
};

const CTA_DEFAULTS: CtaPlaygroundSettings = {
    audience: 'planner',
    showSecondaryAction: true,
};

const EXAMPLE_TRIP_CARD_DEFAULTS: ExampleTripCardSettings = {
    template: 'japan',
    showCreator: true,
    showMiniCalendar: true,
};

const BLOG_CARD_DEFAULTS: BlogCardSettings = {
    category: 'product',
    language: 'en',
    featured: true,
    readingMinutes: 6,
};

const PROFILE_TRIP_CARD_DEFAULTS: ProfileTripCardSettings = {
    status: 'active',
    showActions: true,
    isFavorite: true,
    isPinned: false,
    isPublic: true,
};

const STAMP_CARD_DEFAULTS: StampCardSettings = {
    rarity: 'rare',
    achieved: true,
    selected: true,
};

const FEATURE_CARD_DEFAULTS: FeatureCardSettings = {
    variant: 'planner',
    showMetric: true,
    showMedia: true,
};

const ADMIN_SURFACE_DEFAULTS: AdminSurfaceSettings = {
    state: 'healthy',
    showMetadata: true,
    showAction: true,
};

const CALENDAR_CARD_DEFAULTS: CalendarCardSettings = {
    scope: 'series',
    showDescription: true,
    eventCount: 3,
};

const GLOBE_PALETTES: Record<GlobePaletteId, {
    label: string;
    baseColor: [number, number, number];
    markerColor: [number, number, number];
    arcColor: [number, number, number];
    glowColor: [number, number, number];
    accentClass: string;
}> = {
    lavender: {
        label: 'Lavender route',
        baseColor: [0.975, 0.978, 0.986],
        markerColor: [0.38, 0.31, 0.9],
        arcColor: [0.38, 0.31, 0.9],
        glowColor: [0.995, 0.995, 0.995],
        accentClass: 'border-violet-200 bg-violet-50 text-violet-800',
    },
    coastal: {
        label: 'Coastal teal',
        baseColor: [0.92, 0.98, 0.98],
        markerColor: [0.04, 0.54, 0.62],
        arcColor: [0.04, 0.54, 0.62],
        glowColor: [0.9, 0.99, 1],
        accentClass: 'border-cyan-200 bg-cyan-50 text-cyan-800',
    },
    ember: {
        label: 'Warm route',
        baseColor: [0.99, 0.96, 0.9],
        markerColor: [0.92, 0.36, 0.15],
        arcColor: [0.92, 0.36, 0.15],
        glowColor: [1, 0.96, 0.9],
        accentClass: 'border-orange-200 bg-orange-50 text-orange-800',
    },
};

const CTA_AUDIENCE_COPY: Record<CtaAudienceId, { label: string; eyebrow: string; body: string; primary: string; secondary: string; className: string }> = {
    planner: {
        label: 'Planner',
        eyebrow: 'Trip planner',
        body: 'Convert the current inspiration into a practical route with dates, stops, and transport notes.',
        primary: 'Start planning',
        secondary: 'See examples',
        className: 'border-slate-200 bg-white text-slate-950',
    },
    profile: {
        label: 'Profile',
        eyebrow: 'Public profile',
        body: 'Invite travelers to browse saved routes, stamps, and public travel highlights.',
        primary: 'Open profile',
        secondary: 'Edit visibility',
        className: 'border-indigo-200 bg-indigo-50 text-indigo-950',
    },
    launch: {
        label: 'Launch',
        eyebrow: 'Release moment',
        body: 'Use a sharper announcement CTA for product updates, early access, or new feature launches.',
        primary: 'Read update',
        secondary: 'Share link',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    },
};

const EXAMPLE_TRIP_TEMPLATES: Record<ExampleTripTemplateId, { label: string; title: string; countries: string; days: string; route: string[]; colorClass: string }> = {
    japan: {
        label: 'Japan rail loop',
        title: 'Japan Rail First-Timer',
        countries: 'Japan',
        days: '12 days',
        route: ['Tokyo', 'Kyoto', 'Osaka'],
        colorClass: 'from-rose-100 via-slate-100 to-sky-100',
    },
    portugal: {
        label: 'Portugal coast',
        title: 'Portugal Coast & Wine',
        countries: 'Portugal',
        days: '8 days',
        route: ['Lisbon', 'Porto', 'Douro'],
        colorClass: 'from-emerald-100 via-cyan-100 to-amber-100',
    },
    iceland: {
        label: 'Iceland ring road',
        title: 'Iceland Ring Road',
        countries: 'Iceland',
        days: '10 days',
        route: ['Reykjavik', 'Vik', 'Akureyri'],
        colorClass: 'from-slate-200 via-blue-100 to-cyan-100',
    },
};

const BLOG_CARD_CATEGORIES: Record<BlogCardCategoryId, { label: string; title: string; category: string; excerpt: string; imageClass: string }> = {
    product: {
        label: 'Product update',
        title: 'Smarter route previews for shared trips',
        category: 'Product',
        excerpt: 'A closer look at route cards, map previews, and the small states that help shared plans feel legible.',
        imageClass: 'from-indigo-200 via-sky-100 to-white',
    },
    travel: {
        label: 'Travel guide',
        title: 'How to choose a slower city sequence',
        category: 'Travel guide',
        excerpt: 'A practical guide to pacing multi-city routes without losing the thrill of discovery.',
        imageClass: 'from-emerald-200 via-teal-100 to-white',
    },
    engineering: {
        label: 'Engineering',
        title: 'Making map previews resilient',
        category: 'Engineering',
        excerpt: 'What we learned while making route previews reliable across loading, fallback, and offline states.',
        imageClass: 'from-slate-300 via-violet-100 to-white',
    },
};

const PROFILE_STATUS_COPY: Record<ProfileTripStatusId, { label: string; badge: string; className: string }> = {
    active: { label: 'Active', badge: 'Ready', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
    expired: { label: 'Expired', badge: 'Expired', className: 'border-amber-200 bg-amber-50 text-amber-800' },
    generationFailed: { label: 'Generation failed', badge: 'Needs review', className: 'border-rose-200 bg-rose-50 text-rose-800' },
};

const STAMP_RARITY_COPY: Record<StampRarityId, { label: string; percent: string; className: string }> = {
    common: { label: 'Common', percent: '42%', className: 'bg-slate-100 text-slate-700' },
    rare: { label: 'Rare', percent: '12%', className: 'bg-indigo-100 text-indigo-700' },
    legendary: { label: 'Legendary', percent: '2%', className: 'bg-amber-100 text-amber-800' },
};

const FEATURE_CARD_COPY: Record<FeatureCardVariantId, { label: string; title: string; body: string; metric: string; icon: React.ReactNode; className: string }> = {
    planner: {
        label: 'Planner',
        title: 'Route-first planning',
        body: 'Turn rough ideas into sequenced cities, nights, and transport choices.',
        metric: '3.2k plans',
        icon: <MapPin data-icon="inline-start" />,
        className: 'border-indigo-200 bg-indigo-50',
    },
    maps: {
        label: 'Maps',
        title: 'Map-aware previews',
        body: 'Keep visual route context close to every saved or shared trip.',
        metric: '98% rendered',
        icon: <Eye data-icon="inline-start" />,
        className: 'border-cyan-200 bg-cyan-50',
    },
    profile: {
        label: 'Profiles',
        title: 'Public travel identity',
        body: 'Showcase trips, stamps, and recent travel work from one profile surface.',
        metric: '12 stamps',
        icon: <Trophy data-icon="inline-start" />,
        className: 'border-emerald-200 bg-emerald-50',
    },
};

const ADMIN_SURFACE_COPY: Record<AdminSurfaceStateId, { label: string; title: string; body: string; badgeClassName: string }> = {
    healthy: {
        label: 'Healthy',
        title: 'Worker queue',
        body: 'Generation workers are claiming jobs and completing within the expected window.',
        badgeClassName: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    },
    attention: {
        label: 'Needs attention',
        title: 'Billing sync',
        body: 'Webhook delivery is delayed and may require a reconciliation pass.',
        badgeClassName: 'border-amber-200 bg-amber-50 text-amber-800',
    },
    blocked: {
        label: 'Blocked',
        title: 'Airport import',
        body: 'The current upstream sync failed and is waiting for an admin retry.',
        badgeClassName: 'border-rose-200 bg-rose-50 text-rose-800',
    },
};

const CALENDAR_SCOPE_COPY: Record<CalendarCardScopeId, { label: string; title: string; body: string }> = {
    single: {
        label: 'Single event',
        title: 'Add the launch reminder',
        body: 'One calendar item for a single trip planning milestone.',
    },
    series: {
        label: 'Series',
        title: 'Add the festival window',
        body: 'A compact calendar card for multiple related travel dates.',
    },
    festival: {
        label: 'Festival',
        title: 'Add cherry blossom dates',
        body: 'A guide-card calendar CTA for seasonal inspiration posts.',
    },
};

const formatNumber = (value: number): string => {
    if (Math.abs(value) >= 10) return value.toFixed(0);
    return value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
};

const formatSettingsSnippet = (name: string, settings: Record<string, unknown>): string => (
    `export const ${name} = ${JSON.stringify(settings, null, 2)} as const;`
);

const useNoIndexMeta = (): void => {
    useEffect(() => {
        const selector = 'meta[name="robots"]';
        const existing = document.head.querySelector<HTMLMetaElement>(selector);
        const previousContent = existing?.getAttribute('content') ?? null;
        const node = existing ?? document.createElement('meta');
        node.setAttribute('name', 'robots');
        node.setAttribute('content', 'noindex,nofollow,noarchive');
        if (!existing) document.head.appendChild(node);

        return () => {
            if (previousContent === null) {
                node.remove();
                return;
            }
            node.setAttribute('content', previousContent);
        };
    }, []);
};

const SliderControl: React.FC<SliderControlProps> = ({
    label,
    value,
    min,
    max,
    step,
    suffix = '',
    onChange,
}) => (
    <label className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <span className="flex items-center justify-between gap-3 text-xs font-semibold uppercase text-slate-500">
            <span>{label}</span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                {formatNumber(value)}{suffix}
            </span>
        </span>
        <Slider
            aria-label={label}
            value={[value]}
            min={min}
            max={max}
            step={step}
            onValueChange={(nextValue) => onChange(nextValue[0] ?? value)}
        />
    </label>
);

const CopySettingsButton: React.FC<{
    label: string;
    variableName: string;
    settings: Record<string, unknown>;
}> = ({ label, variableName, settings }) => {
    const handleCopy = useCallback(async () => {
        const snippet = formatSettingsSnippet(variableName, settings);
        await navigator.clipboard.writeText(snippet);
        showAppToast({
            tone: 'success',
            title: 'Settings copied',
            description: `${label} settings are ready to paste into code.`,
        });
    }, [label, settings, variableName]);

    return (
        <button
            type="button"
            onClick={() => {
                void handleCopy();
            }}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
            <Clipboard data-icon="inline-start" />
            {label}
        </button>
    );
};

const PlaygroundControls: React.FC<{
    children: React.ReactNode;
    copyButton: React.ReactNode;
    onReset: () => void;
}> = ({ children, copyButton, onReset }) => (
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">Settings</h3>
            <button
                type="button"
                onClick={onReset}
                className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
                <RotateCcw data-icon="inline-start" />
                Reset
            </button>
        </div>
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,11rem),1fr))]">{children}</div>
        {copyButton}
    </div>
);

const CobeGlobePreview: React.FC<{ settings: GlobePlaygroundSettings }> = ({ settings }) => {
    const previewRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const settingsRef = useRef(settings);
    const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        settingsRef.current = settings;
    }, [settings]);

    useEffect(() => {
        const preview = previewRef.current;
        if (!preview) return;

        const updateSize = () => {
            const rect = preview.getBoundingClientRect();
            const width = Math.floor(rect.width);
            const height = Math.floor(rect.height);
            if (width <= 0 || height <= 0) return;
            setPreviewSize((current) => (
                current.width === width && current.height === height ? current : { width, height }
            ));
        };

        updateSize();
        const observer = new ResizeObserver(updateSize);
        observer.observe(preview);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (previewSize.width <= 0 || previewSize.height <= 0) return;

        let isCancelled = false;
        let animationFrameId = 0;
        let globe: { update?: (state: Record<string, unknown>) => void; destroy?: () => void } | null = null;
        let phi = 0;

        const initialize = async () => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            try {
                const cobeModule = await import('cobe');
                if (isCancelled) return;

                const palette = GLOBE_PALETTES[settingsRef.current.palette];
                globe = cobeModule.default(canvas, {
                    devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
                    width: previewSize.width,
                    height: previewSize.height,
                    phi,
                    theta: settingsRef.current.theta,
                    dark: 0,
                    diffuse: 1.3,
                    mapSamples: 16000,
                    mapBrightness: settingsRef.current.mapBrightness,
                    mapBaseBrightness: 0.06,
                    baseColor: palette.baseColor,
                    markerColor: palette.markerColor,
                    glowColor: palette.glowColor,
                    arcColor: palette.arcColor,
                    arcWidth: 0.36,
                    arcHeight: settingsRef.current.arcHeight,
                    markerElevation: settingsRef.current.markerElevation,
                    scale: settingsRef.current.scale,
                    opacity: 1,
                    markers: [
                        { location: [53.5511, 9.9937], size: 0.034 },
                        { location: [48.8566, 2.3522], size: 0.026 },
                        { location: [35.6762, 139.6503], size: 0.022 },
                        { location: [-33.9249, 18.4241], size: 0.021 },
                    ],
                    arcs: [
                        { from: [53.5511, 9.9937], to: [48.8566, 2.3522] },
                        { from: [48.8566, 2.3522], to: [35.6762, 139.6503] },
                        { from: [35.6762, 139.6503], to: [-33.9249, 18.4241] },
                    ],
                });

                const animate = () => {
                    const current = settingsRef.current;
                    const currentPalette = GLOBE_PALETTES[current.palette];
                    if (current.animated) {
                        phi += current.rotationSpeed * 0.001;
                    }
                    globe?.update?.({
                        phi,
                        theta: current.theta,
                        mapBrightness: current.mapBrightness,
                        scale: current.scale,
                        arcHeight: current.arcHeight,
                        markerElevation: current.markerElevation,
                        baseColor: currentPalette.baseColor,
                        markerColor: currentPalette.markerColor,
                        glowColor: currentPalette.glowColor,
                        arcColor: currentPalette.arcColor,
                    });
                    animationFrameId = window.requestAnimationFrame(animate);
                };

                animate();
            } catch {
                // The surrounding controls remain useful even if WebGL is unavailable.
            }
        };

        void initialize();

        return () => {
            isCancelled = true;
            window.cancelAnimationFrame(animationFrameId);
            globe?.destroy?.();
        };
    }, [previewSize.height, previewSize.width]);

    const palette = GLOBE_PALETTES[settings.palette];

    return (
        <div
            ref={previewRef}
            className="relative isolate flex aspect-video w-full min-w-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-950"
        >
            <canvas
                ref={canvasRef}
                width={previewSize.width}
                height={previewSize.height}
                className="h-full w-full"
                aria-hidden="true"
            />
            <div className="pointer-events-none absolute inset-x-5 top-5 flex items-center justify-between gap-3">
                <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold', palette.accentClass)}>
                    {palette.label}
                </span>
                <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                    COBE preview
                </span>
            </div>
        </div>
    );
};

const PlaygroundBlock: React.FC<{
    title: string;
    description: string;
    preview: React.ReactNode;
    controls: React.ReactNode;
}> = ({ title, description, preview, controls }) => (
    <Card className="w-full rounded-xl border-slate-200 bg-white">
        <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="grid items-start gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="min-w-0">{preview}</div>
            {controls}
        </CardContent>
    </Card>
);

const ExampleTripCardPreview: React.FC<{ settings: ExampleTripCardSettings }> = ({ settings }) => {
    const template = EXAMPLE_TRIP_TEMPLATES[settings.template];

    return (
        <article className="max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={cn('relative h-40 bg-gradient-to-br', template.colorClass)}>
                <svg className="absolute inset-0 size-full text-slate-500/35" viewBox="0 0 320 160" fill="none" preserveAspectRatio="none">
                    <path d="M42 112 C86 34 137 78 167 55 C205 26 234 92 286 48" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="8 8" />
                </svg>
                {template.route.map((city, index) => (
                    <span
                        key={city}
                        className="absolute size-3 rounded-full border-2 border-white bg-accent-600 shadow-sm"
                        style={{
                            insetInlineStart: `${18 + index * 31}%`,
                            top: `${62 - index * 16}%`,
                        }}
                    />
                ))}
            </div>
            <div className="space-y-3 p-4">
                <div>
                    <h3 className="text-base font-semibold text-slate-950">{template.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{template.countries} · {template.days}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {template.route.map((city) => (
                        <span key={city} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {city}
                        </span>
                    ))}
                </div>
                {settings.showMiniCalendar ? (
                    <div className="grid grid-cols-3 gap-1.5">
                        {template.route.map((city, index) => (
                            <span key={`${city}-lane`} className="rounded-lg bg-slate-100 px-2 py-1.5 text-center text-xs font-semibold text-slate-600">
                                Day {index * 3 + 1}
                            </span>
                        ))}
                    </div>
                ) : null}
                {settings.showCreator ? (
                    <p className="text-xs font-medium text-slate-500">Created by @travelflow</p>
                ) : null}
            </div>
        </article>
    );
};

const BlogPostCardPreview: React.FC<{ settings: BlogCardSettings }> = ({ settings }) => {
    const category = BLOG_CARD_CATEGORIES[settings.category];

    return (
        <article className="group max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className={cn('h-40 bg-gradient-to-br', category.imageClass)} />
            <div className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                        <Tag data-icon="inline-start" />
                        {category.category}
                    </span>
                    <span>{settings.readingMinutes} min read</span>
                    <span>{settings.language.toUpperCase()}</span>
                </div>
                <h3 className="text-lg font-semibold leading-tight text-slate-950">{category.title}</h3>
                <p className="text-sm leading-6 text-slate-600">{category.excerpt}</p>
                {settings.featured ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-700">
                        <Star data-icon="inline-start" />
                        Featured article
                    </span>
                ) : null}
            </div>
        </article>
    );
};

const ProfileTripCardPreview: React.FC<{ settings: ProfileTripCardSettings }> = ({ settings }) => {
    const status = PROFILE_STATUS_COPY[settings.status];

    return (
        <article className="max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className={cn('relative aspect-[16/9] bg-gradient-to-br', settings.status === 'generationFailed' ? 'from-rose-100 to-slate-100' : settings.status === 'expired' ? 'from-amber-100 to-slate-100' : 'from-cyan-100 to-indigo-100')}>
                <div className="absolute inset-x-5 top-5 flex items-center justify-between gap-2">
                    <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', status.className)}>{status.badge}</span>
                    {!settings.isPublic ? <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-700">Hidden</span> : null}
                </div>
            </div>
            <div className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-base font-semibold text-slate-950">Kyoto Rail Plan</h3>
                        <p className="mt-1 text-sm text-slate-600">9 days · 4 cities · Rail first</p>
                    </div>
                    {settings.isPinned ? <Pin className="size-4 text-accent-600" aria-hidden="true" /> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                    {['Tokyo', 'Kyoto', 'Osaka'].map((city) => (
                        <span key={city} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">{city}</span>
                    ))}
                </div>
                {settings.showActions ? (
                    <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                        <button type="button" className="inline-flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600">
                            <Eye className="size-4" aria-hidden="true" />
                        </button>
                        <button type="button" className={cn('inline-flex size-8 items-center justify-center rounded-lg border border-slate-200', settings.isFavorite ? 'text-amber-600' : 'text-slate-600')}>
                            <Star className="size-4" aria-hidden="true" />
                        </button>
                    </div>
                ) : null}
            </div>
        </article>
    );
};

const StampCardPreview: React.FC<{ settings: StampCardSettings }> = ({ settings }) => {
    const rarity = STAMP_RARITY_COPY[settings.rarity];

    return (
        <button
            type="button"
            aria-pressed={settings.selected}
            className={cn(
                'flex aspect-square max-w-56 flex-col overflow-hidden rounded-xl border bg-white p-3 text-left shadow-sm transition',
                settings.selected ? 'border-accent-300 shadow-accent-100' : 'border-slate-200',
                settings.achieved ? '' : 'opacity-80 saturate-50',
            )}
        >
            <div className="flex flex-1 items-center justify-center rounded-lg bg-slate-50">
                <div className={cn('flex size-24 items-center justify-center rounded-full', rarity.className)}>
                    <Trophy className="size-10" aria-hidden="true" />
                </div>
            </div>
            <div className="mt-3 text-center">
                <p className="text-xs font-bold text-slate-800">Urban Explorer</p>
                <p className="text-[10px] font-medium text-slate-500">{rarity.percent} rarity · {settings.achieved ? 'Unlocked' : 'Locked'}</p>
            </div>
        </button>
    );
};

const FeatureCardPreview: React.FC<{ settings: FeatureCardSettings }> = ({ settings }) => {
    const feature = FEATURE_CARD_COPY[settings.variant];

    return (
        <article className={cn('max-w-md rounded-2xl border p-5', feature.className)}>
            <div className="flex items-start justify-between gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-white/80 text-accent-700">
                    {feature.icon}
                </span>
                {settings.showMetric ? <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-700">{feature.metric}</span> : null}
            </div>
            <h3 className="mt-5 text-lg font-semibold text-slate-950">{feature.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{feature.body}</p>
            {settings.showMedia ? (
                <div className="mt-4 grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((item) => (
                        <span key={item} className="h-16 rounded-lg bg-white/75" />
                    ))}
                </div>
            ) : null}
        </article>
    );
};

const AdminSurfacePreview: React.FC<{ settings: AdminSurfaceSettings }> = ({ settings }) => {
    const state = ADMIN_SURFACE_COPY[settings.state];

    return (
        <article className="max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Admin card</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-950">{state.title}</h3>
                </div>
                <span className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', state.badgeClassName)}>{state.label}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{state.body}</p>
            {settings.showMetadata ? (
                <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
                    {[
                        ['Runs', '42'],
                        ['Latency', '1.4s'],
                        ['Errors', settings.state === 'healthy' ? '0' : '3'],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                            <dt className="text-slate-500">{label}</dt>
                            <dd className="font-semibold text-slate-900">{value}</dd>
                        </div>
                    ))}
                </dl>
            ) : null}
            {settings.showAction ? (
                <button type="button" className="mt-4 inline-flex min-h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700">
                    Review
                </button>
            ) : null}
        </article>
    );
};

const CalendarCardPreview: React.FC<{ settings: CalendarCardSettings }> = ({ settings }) => {
    const scope = CALENDAR_SCOPE_COPY[settings.scope];

    return (
        <section className="max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700 ring-1 ring-accent-200">
                        <CalendarDays className="size-5" aria-hidden="true" />
                    </span>
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-accent-700">{scope.label}</p>
                        <h3 className="mt-1 text-lg font-semibold text-slate-900">{scope.title}</h3>
                        {settings.showDescription ? <p className="mt-1 text-sm text-slate-600">{scope.body}</p> : null}
                        <p className="mt-1 text-xs font-medium text-slate-500">{settings.eventCount} calendar events</p>
                    </div>
                </div>
                <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-sm font-semibold text-accent-800">
                    <CalendarDays className="size-4" aria-hidden="true" />
                    Add calendar
                </button>
            </div>
        </section>
    );
};

export const AdminComponentPlaygroundPage: React.FC = () => {
    useNoIndexMeta();
    const [activeTab, setActiveTab] = useState('components');
    const [globeSettings, setGlobeSettings] = useState<GlobePlaygroundSettings>(GLOBE_DEFAULTS);
    const [ctaSettings, setCtaSettings] = useState<CtaPlaygroundSettings>(CTA_DEFAULTS);
    const [exampleTripSettings, setExampleTripSettings] = useState<ExampleTripCardSettings>(EXAMPLE_TRIP_CARD_DEFAULTS);
    const [blogCardSettings, setBlogCardSettings] = useState<BlogCardSettings>(BLOG_CARD_DEFAULTS);
    const [profileTripSettings, setProfileTripSettings] = useState<ProfileTripCardSettings>(PROFILE_TRIP_CARD_DEFAULTS);
    const [stampCardSettings, setStampCardSettings] = useState<StampCardSettings>(STAMP_CARD_DEFAULTS);
    const [featureCardSettings, setFeatureCardSettings] = useState<FeatureCardSettings>(FEATURE_CARD_DEFAULTS);
    const [adminSurfaceSettings, setAdminSurfaceSettings] = useState<AdminSurfaceSettings>(ADMIN_SURFACE_DEFAULTS);
    const [calendarCardSettings, setCalendarCardSettings] = useState<CalendarCardSettings>(CALENDAR_CARD_DEFAULTS);
    const [sampleHeadline, setSampleHeadline] = useState('Plan the route before the route plans you');
    const ctaHeadlineInputId = React.useId();

    useEffect(() => {
        trackEvent('admin__component_playground--open');
    }, []);

    const globeSnippetSettings = useMemo(() => ({ ...globeSettings }), [globeSettings]);
    const ctaSnippetSettings = useMemo(() => ({ ...ctaSettings, headline: sampleHeadline }), [ctaSettings, sampleHeadline]);
    const exampleTripSnippetSettings = useMemo(() => ({ ...exampleTripSettings }), [exampleTripSettings]);
    const blogCardSnippetSettings = useMemo(() => ({ ...blogCardSettings }), [blogCardSettings]);
    const profileTripSnippetSettings = useMemo(() => ({ ...profileTripSettings }), [profileTripSettings]);
    const stampCardSnippetSettings = useMemo(() => ({ ...stampCardSettings }), [stampCardSettings]);
    const featureCardSnippetSettings = useMemo(() => ({ ...featureCardSettings }), [featureCardSettings]);
    const adminSurfaceSnippetSettings = useMemo(() => ({ ...adminSurfaceSettings }), [adminSurfaceSettings]);
    const calendarCardSnippetSettings = useMemo(() => ({ ...calendarCardSettings }), [calendarCardSettings]);

    return (
        <AdminShell
            title="Component Playground"
            description="Hidden admin-only lab for tuning TravelFlow sections and copying exact settings back into code."
        >
            <div className="flex w-full min-w-0 flex-col gap-6" data-testid="admin-component-playground-root">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0">
                    <TabsList variant="line" className="w-full overflow-x-auto">
                        <TabsTrigger value="sections">Sections</TabsTrigger>
                        <TabsTrigger value="components">Components</TabsTrigger>
                        <TabsTrigger value="settings">Copied Settings</TabsTrigger>
                    </TabsList>
                    <TabsContent value="sections" className="flex w-full min-w-0 flex-col gap-5">
                        <PlaygroundBlock
                            title="CTA section"
                            description="Tune section copy and semantic audience variants while spacing and typography stay governed by the design system."
                            preview={(() => {
                                const ctaCopy = CTA_AUDIENCE_COPY[ctaSettings.audience];
                                return (
                                    <section className={cn('rounded-2xl border p-6 shadow-sm', ctaCopy.className)}>
                                        <div className="max-w-3xl">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{ctaCopy.eyebrow}</p>
                                            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{sampleHeadline}</h2>
                                            <p className="mt-3 text-sm leading-6 text-slate-600">{ctaCopy.body}</p>
                                            <div className="mt-5 flex flex-wrap gap-2">
                                                <button type="button" className="rounded-lg bg-accent-600 px-4 py-2 text-sm font-semibold text-white">
                                                    {ctaCopy.primary}
                                                </button>
                                                {ctaSettings.showSecondaryAction ? (
                                                    <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                                                        {ctaCopy.secondary}
                                                    </button>
                                                ) : null}
                                            </div>
                                        </div>
                                    </section>
                                );
                            })()}
                            controls={(
                                <PlaygroundControls
                                    onReset={() => setCtaSettings(CTA_DEFAULTS)}
                                    copyButton={<CopySettingsButton label="Copy CTA settings" variableName="ctaSectionSettings" settings={ctaSnippetSettings} />}
                                >
                                    <label htmlFor={ctaHeadlineInputId} className="flex flex-col gap-2 text-xs font-semibold uppercase text-slate-500">
                                        Headline
                                        <Input id={ctaHeadlineInputId} value={sampleHeadline} onChange={(event) => setSampleHeadline(event.target.value)} />
                                    </label>
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-semibold uppercase text-slate-500">Audience</span>
                                        <Select
                                            value={ctaSettings.audience}
                                            onValueChange={(audience) => setCtaSettings((current) => ({ ...current, audience: audience as CtaAudienceId }))}
                                        >
                                            <SelectTrigger aria-label="CTA audience">
                                                <SelectValue placeholder="Choose audience" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(CTA_AUDIENCE_COPY).map(([value, option]) => (
                                                    <SelectItem key={value} value={value}>{option.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
                                        <span>Secondary action</span>
                                        <Switch
                                            aria-label="Secondary action"
                                            checked={ctaSettings.showSecondaryAction}
                                            onCheckedChange={(showSecondaryAction) => setCtaSettings((current) => ({ ...current, showSecondaryAction }))}
                                        />
                                    </div>
                                </PlaygroundControls>
                            )}
                        />
                    </TabsContent>

                    <TabsContent value="components" className="flex w-full min-w-0 flex-col gap-5">
                        <PlaygroundBlock
                            title="COBE globe component"
                            description="Reusable interactive globe component with component-specific rendering controls."
                            preview={<CobeGlobePreview settings={globeSettings} />}
                            controls={(
                                <PlaygroundControls
                                    onReset={() => setGlobeSettings(GLOBE_DEFAULTS)}
                                    copyButton={<CopySettingsButton label="Copy globe settings" variableName="globeSettings" settings={globeSnippetSettings} />}
                                >
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-semibold uppercase text-slate-500">Globe palette</span>
                                        <Select
                                            value={globeSettings.palette}
                                            onValueChange={(palette) => setGlobeSettings((current) => ({ ...current, palette: palette as GlobePaletteId }))}
                                        >
                                            <SelectTrigger aria-label="Globe palette">
                                                <SelectValue placeholder="Choose palette" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="lavender">Lavender route</SelectItem>
                                                <SelectItem value="coastal">Coastal teal</SelectItem>
                                                <SelectItem value="ember">Warm route</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <SliderControl label="Globe scale" value={globeSettings.scale} min={0.74} max={1.16} step={0.01} onChange={(scale) => setGlobeSettings((current) => ({ ...current, scale }))} />
                                    <SliderControl label="Rotation speed" value={globeSettings.rotationSpeed} min={0} max={3} step={0.05} onChange={(rotationSpeed) => setGlobeSettings((current) => ({ ...current, rotationSpeed }))} />
                                    <SliderControl label="Map brightness" value={globeSettings.mapBrightness} min={2.8} max={8} step={0.1} onChange={(mapBrightness) => setGlobeSettings((current) => ({ ...current, mapBrightness }))} />
                                    <SliderControl label="Arc height" value={globeSettings.arcHeight} min={0.15} max={1.4} step={0.01} onChange={(arcHeight) => setGlobeSettings((current) => ({ ...current, arcHeight }))} />
                                    <SliderControl label="Marker elevation" value={globeSettings.markerElevation} min={0.005} max={0.08} step={0.001} onChange={(markerElevation) => setGlobeSettings((current) => ({ ...current, markerElevation }))} />
                                    <SliderControl label="Globe tilt" value={globeSettings.theta} min={-0.35} max={0.35} step={0.01} onChange={(theta) => setGlobeSettings((current) => ({ ...current, theta }))} />
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
                                        <span>Animate rotation</span>
                                        <Switch aria-label="Animate rotation" checked={globeSettings.animated} onCheckedChange={(animated) => setGlobeSettings((current) => ({ ...current, animated }))} />
                                    </div>
                                </PlaygroundControls>
                            )}
                        />

                        <PlaygroundBlock
                            title="Example trip card"
                            description="Repeated marketing/profile preview card for example trip templates."
                            preview={<ExampleTripCardPreview settings={exampleTripSettings} />}
                            controls={(
                                <PlaygroundControls
                                    onReset={() => setExampleTripSettings(EXAMPLE_TRIP_CARD_DEFAULTS)}
                                    copyButton={<CopySettingsButton label="Copy example trip settings" variableName="exampleTripCardSettings" settings={exampleTripSnippetSettings} />}
                                >
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-semibold uppercase text-slate-500">Template</span>
                                        <Select value={exampleTripSettings.template} onValueChange={(template) => setExampleTripSettings((current) => ({ ...current, template: template as ExampleTripTemplateId }))}>
                                            <SelectTrigger aria-label="Example trip template"><SelectValue placeholder="Choose template" /></SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(EXAMPLE_TRIP_TEMPLATES).map(([value, option]) => <SelectItem key={value} value={value}>{option.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
                                        <span>Creator attribution</span>
                                        <Switch aria-label="Creator attribution" checked={exampleTripSettings.showCreator} onCheckedChange={(showCreator) => setExampleTripSettings((current) => ({ ...current, showCreator }))} />
                                    </div>
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
                                        <span>Mini calendar</span>
                                        <Switch aria-label="Mini calendar" checked={exampleTripSettings.showMiniCalendar} onCheckedChange={(showMiniCalendar) => setExampleTripSettings((current) => ({ ...current, showMiniCalendar }))} />
                                    </div>
                                </PlaygroundControls>
                            )}
                        />

                        <PlaygroundBlock
                            title="Blog post card"
                            description="Reusable blog listing card with language, feature, and reading-time states."
                            preview={<BlogPostCardPreview settings={blogCardSettings} />}
                            controls={(
                                <PlaygroundControls
                                    onReset={() => setBlogCardSettings(BLOG_CARD_DEFAULTS)}
                                    copyButton={<CopySettingsButton label="Copy blog card settings" variableName="blogPostCardSettings" settings={blogCardSnippetSettings} />}
                                >
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-semibold uppercase text-slate-500">Category</span>
                                        <Select value={blogCardSettings.category} onValueChange={(category) => setBlogCardSettings((current) => ({ ...current, category: category as BlogCardCategoryId }))}>
                                            <SelectTrigger aria-label="Blog category"><SelectValue placeholder="Choose category" /></SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(BLOG_CARD_CATEGORIES).map(([value, option]) => <SelectItem key={value} value={value}>{option.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-semibold uppercase text-slate-500">Language</span>
                                        <Select value={blogCardSettings.language} onValueChange={(language) => setBlogCardSettings((current) => ({ ...current, language: language as 'en' | 'de' }))}>
                                            <SelectTrigger aria-label="Blog language"><SelectValue placeholder="Choose language" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="en">English</SelectItem>
                                                <SelectItem value="de">German</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <SliderControl label="Reading time" value={blogCardSettings.readingMinutes} min={2} max={14} step={1} suffix=" min" onChange={(readingMinutes) => setBlogCardSettings((current) => ({ ...current, readingMinutes }))} />
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
                                        <span>Featured state</span>
                                        <Switch aria-label="Featured state" checked={blogCardSettings.featured} onCheckedChange={(featured) => setBlogCardSettings((current) => ({ ...current, featured }))} />
                                    </div>
                                </PlaygroundControls>
                            )}
                        />

                        <PlaygroundBlock
                            title="Profile trip card"
                            description="Repeated trip card used for profile and saved-trip surfaces."
                            preview={<ProfileTripCardPreview settings={profileTripSettings} />}
                            controls={(
                                <PlaygroundControls
                                    onReset={() => setProfileTripSettings(PROFILE_TRIP_CARD_DEFAULTS)}
                                    copyButton={<CopySettingsButton label="Copy profile trip settings" variableName="profileTripCardSettings" settings={profileTripSnippetSettings} />}
                                >
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-semibold uppercase text-slate-500">Status</span>
                                        <Select value={profileTripSettings.status} onValueChange={(status) => setProfileTripSettings((current) => ({ ...current, status: status as ProfileTripStatusId }))}>
                                            <SelectTrigger aria-label="Profile trip status"><SelectValue placeholder="Choose status" /></SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(PROFILE_STATUS_COPY).map(([value, option]) => <SelectItem key={value} value={value}>{option.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {[
                                        ['Action row', 'showActions'],
                                        ['Favorite', 'isFavorite'],
                                        ['Pinned', 'isPinned'],
                                        ['Public', 'isPublic'],
                                    ].map(([label, key]) => (
                                        <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
                                            <span>{label}</span>
                                            <Switch
                                                aria-label={label}
                                                checked={Boolean(profileTripSettings[key as keyof ProfileTripCardSettings])}
                                                onCheckedChange={(checked) => setProfileTripSettings((current) => ({ ...current, [key]: checked }))}
                                            />
                                        </div>
                                    ))}
                                </PlaygroundControls>
                            )}
                        />

                        <PlaygroundBlock
                            title="Profile stamp card"
                            description="Reusable passport stamp card with achieved, selected, and rarity states."
                            preview={<StampCardPreview settings={stampCardSettings} />}
                            controls={(
                                <PlaygroundControls
                                    onReset={() => setStampCardSettings(STAMP_CARD_DEFAULTS)}
                                    copyButton={<CopySettingsButton label="Copy stamp card settings" variableName="profileStampCardSettings" settings={stampCardSnippetSettings} />}
                                >
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-semibold uppercase text-slate-500">Rarity</span>
                                        <Select value={stampCardSettings.rarity} onValueChange={(rarity) => setStampCardSettings((current) => ({ ...current, rarity: rarity as StampRarityId }))}>
                                            <SelectTrigger aria-label="Stamp rarity"><SelectValue placeholder="Choose rarity" /></SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(STAMP_RARITY_COPY).map(([value, option]) => <SelectItem key={value} value={value}>{option.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
                                        <span>Achieved</span>
                                        <Switch aria-label="Achieved" checked={stampCardSettings.achieved} onCheckedChange={(achieved) => setStampCardSettings((current) => ({ ...current, achieved }))} />
                                    </div>
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
                                        <span>Selected</span>
                                        <Switch aria-label="Selected" checked={stampCardSettings.selected} onCheckedChange={(selected) => setStampCardSettings((current) => ({ ...current, selected }))} />
                                    </div>
                                </PlaygroundControls>
                            )}
                        />

                        <PlaygroundBlock
                            title="Feature card"
                            description="Reusable marketing feature card used across feature and bento-style sections."
                            preview={<FeatureCardPreview settings={featureCardSettings} />}
                            controls={(
                                <PlaygroundControls
                                    onReset={() => setFeatureCardSettings(FEATURE_CARD_DEFAULTS)}
                                    copyButton={<CopySettingsButton label="Copy feature card settings" variableName="featureCardSettings" settings={featureCardSnippetSettings} />}
                                >
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-semibold uppercase text-slate-500">Variant</span>
                                        <Select value={featureCardSettings.variant} onValueChange={(variant) => setFeatureCardSettings((current) => ({ ...current, variant: variant as FeatureCardVariantId }))}>
                                            <SelectTrigger aria-label="Feature card variant"><SelectValue placeholder="Choose variant" /></SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(FEATURE_CARD_COPY).map(([value, option]) => <SelectItem key={value} value={value}>{option.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
                                        <span>Metric pill</span>
                                        <Switch aria-label="Metric pill" checked={featureCardSettings.showMetric} onCheckedChange={(showMetric) => setFeatureCardSettings((current) => ({ ...current, showMetric }))} />
                                    </div>
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
                                        <span>Media preview</span>
                                        <Switch aria-label="Media preview" checked={featureCardSettings.showMedia} onCheckedChange={(showMedia) => setFeatureCardSettings((current) => ({ ...current, showMedia }))} />
                                    </div>
                                </PlaygroundControls>
                            )}
                        />

                        <PlaygroundBlock
                            title="Admin surface card"
                            description="Reusable admin card pattern for operational dashboards and status panels."
                            preview={<AdminSurfacePreview settings={adminSurfaceSettings} />}
                            controls={(
                                <PlaygroundControls
                                    onReset={() => setAdminSurfaceSettings(ADMIN_SURFACE_DEFAULTS)}
                                    copyButton={<CopySettingsButton label="Copy admin surface settings" variableName="adminSurfaceSettings" settings={adminSurfaceSnippetSettings} />}
                                >
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-semibold uppercase text-slate-500">State</span>
                                        <Select value={adminSurfaceSettings.state} onValueChange={(state) => setAdminSurfaceSettings((current) => ({ ...current, state: state as AdminSurfaceStateId }))}>
                                            <SelectTrigger aria-label="Admin surface state"><SelectValue placeholder="Choose state" /></SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(ADMIN_SURFACE_COPY).map(([value, option]) => <SelectItem key={value} value={value}>{option.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
                                        <span>Metadata</span>
                                        <Switch aria-label="Metadata" checked={adminSurfaceSettings.showMetadata} onCheckedChange={(showMetadata) => setAdminSurfaceSettings((current) => ({ ...current, showMetadata }))} />
                                    </div>
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
                                        <span>Action</span>
                                        <Switch aria-label="Action" checked={adminSurfaceSettings.showAction} onCheckedChange={(showAction) => setAdminSurfaceSettings((current) => ({ ...current, showAction }))} />
                                    </div>
                                </PlaygroundControls>
                            )}
                        />

                        <PlaygroundBlock
                            title="Calendar card"
                            description="Reusable blog/calendar CTA card for downloadable trip or inspiration dates."
                            preview={<CalendarCardPreview settings={calendarCardSettings} />}
                            controls={(
                                <PlaygroundControls
                                    onReset={() => setCalendarCardSettings(CALENDAR_CARD_DEFAULTS)}
                                    copyButton={<CopySettingsButton label="Copy calendar card settings" variableName="calendarCardSettings" settings={calendarCardSnippetSettings} />}
                                >
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-semibold uppercase text-slate-500">Scope</span>
                                        <Select value={calendarCardSettings.scope} onValueChange={(scope) => setCalendarCardSettings((current) => ({ ...current, scope: scope as CalendarCardScopeId }))}>
                                            <SelectTrigger aria-label="Calendar scope"><SelectValue placeholder="Choose scope" /></SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(CALENDAR_SCOPE_COPY).map(([value, option]) => <SelectItem key={value} value={value}>{option.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <SliderControl label="Event count" value={calendarCardSettings.eventCount} min={1} max={8} step={1} onChange={(eventCount) => setCalendarCardSettings((current) => ({ ...current, eventCount }))} />
                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
                                        <span>Description</span>
                                        <Switch aria-label="Description" checked={calendarCardSettings.showDescription} onCheckedChange={(showDescription) => setCalendarCardSettings((current) => ({ ...current, showDescription }))} />
                                    </div>
                                </PlaygroundControls>
                            )}
                        />
                    </TabsContent>

                    <TabsContent value="settings" className="grid w-full min-w-0 gap-4 lg:grid-cols-3">
                        {[
                            ['globeSettings', globeSnippetSettings],
                            ['ctaSectionSettings', ctaSnippetSettings],
                            ['exampleTripCardSettings', exampleTripSnippetSettings],
                            ['blogPostCardSettings', blogCardSnippetSettings],
                            ['profileTripCardSettings', profileTripSnippetSettings],
                            ['profileStampCardSettings', stampCardSnippetSettings],
                            ['featureCardSettings', featureCardSnippetSettings],
                            ['adminSurfaceSettings', adminSurfaceSnippetSettings],
                            ['calendarCardSettings', calendarCardSnippetSettings],
                        ].map(([name, settings]) => (
                            <Card key={name as string} className="rounded-xl border-slate-200 bg-white">
                                <CardHeader>
                                    <CardTitle>{name as string}</CardTitle>
                                    <CardDescription>Copyable code snapshot for the current playground state.</CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-3">
                                    <pre className="max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-50">
                                        {formatSettingsSnippet(name as string, settings as Record<string, unknown>)}
                                    </pre>
                                    <CopySettingsButton
                                        label={`Copy ${name as string}`}
                                        variableName={name as string}
                                        settings={settings as Record<string, unknown>}
                                    />
                                </CardContent>
                            </Card>
                        ))}
                    </TabsContent>
                </Tabs>
            </div>
        </AdminShell>
    );
};
