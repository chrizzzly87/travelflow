import React from 'react';
import { Clock, MapPin, Repeat } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import type { ExampleTripCard as ExampleTripCardType } from '../../data/exampleTripCards';
import type { ExampleTemplateMiniCalendar } from '../../data/exampleTripTemplates';
import { getDestinationDisplayName } from '../../utils';
import { getExampleCityLaneViewTransitionName, getExampleMapViewTransitionName, getExampleTitleViewTransitionName } from '../../shared/viewTransitionNames';
import { ProgressiveImage } from '../ProgressiveImage';
import { buildBlurhashEndpointUrl, isImageCdnEnabled } from '../../utils/imageDelivery';

interface ExampleTripCardProps {
    card: ExampleTripCardType;
    mapPreviewUrl?: string | null;
    miniCalendar?: ExampleTemplateMiniCalendar | null;
    enableSharedTransition?: boolean;
}

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_COLOR_PATTERN = /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*[0-9.]+\s*)?\)$/i;

const parseHexColor = (color: string): [number, number, number] | null => {
    const normalized = color.trim();
    const match = normalized.match(HEX_COLOR_PATTERN);
    if (!match) return null;
    const raw = match[1];
    const expanded = raw.length === 3 ? raw.split('').map((part) => `${part}${part}`).join('') : raw;
    const red = Number.parseInt(expanded.slice(0, 2), 16);
    const green = Number.parseInt(expanded.slice(2, 4), 16);
    const blue = Number.parseInt(expanded.slice(4, 6), 16);
    if ([red, green, blue].some((channel) => Number.isNaN(channel))) return null;
    return [red, green, blue];
};

const parseRgbColor = (color: string): [number, number, number] | null => {
    const match = color.trim().match(RGB_COLOR_PATTERN);
    if (!match) return null;
    const red = Number.parseFloat(match[1]);
    const green = Number.parseFloat(match[2]);
    const blue = Number.parseFloat(match[3]);
    if ([red, green, blue].some((channel) => !Number.isFinite(channel))) return null;
    return [Math.round(red), Math.round(green), Math.round(blue)];
};

const buildLaneOutlineColor = (color: string): string => {
    if (typeof CSS !== 'undefined' && CSS.supports?.('color', `color(from ${color} srgb r g b / 0.45)`)) {
        return `color(from ${color} srgb r g b / 0.45)`;
    }

    const rgb = parseHexColor(color) || parseRgbColor(color);
    if (!rgb) return 'rgb(15 23 42 / 0.2)';
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.45)`;
};

const normalizeTagTranslationKey = (value: string): string =>
    value
        .trim()
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

export const ExampleTripCard: React.FC<ExampleTripCardProps> = ({
    card,
    mapPreviewUrl,
    miniCalendar = null,
    enableSharedTransition = false,
}) => {
    const { t, i18n } = useTranslation('home');
    const currentLocale = i18n.resolvedLanguage || i18n.language;
    const localizedTitle = t(`examples.cards.titles.${card.id}`, { defaultValue: card.title });
    const staticFallbackSrc = card.mapImagePath
        ? `${card.mapImagePath}?v=palette-20260210d`
        : null;
    const [mapImageSrc, setMapImageSrc] = React.useState<string | null>(mapPreviewUrl || staticFallbackSrc);
    const [dynamicBlurhash, setDynamicBlurhash] = React.useState<string>('');
    const mapViewTransitionName = getExampleMapViewTransitionName(enableSharedTransition);
    const titleViewTransitionName = getExampleTitleViewTransitionName(enableSharedTransition);
    const cityLanes = miniCalendar?.cityLanes || [];
    const routeLanes = miniCalendar?.routeLanes || [];

    React.useEffect(() => {
        setMapImageSrc(mapPreviewUrl || staticFallbackSrc);
        setDynamicBlurhash('');
    }, [mapPreviewUrl, staticFallbackSrc]);

    const handleMapImageError = () => {
        if (mapImageSrc === mapPreviewUrl && staticFallbackSrc && staticFallbackSrc !== mapImageSrc) {
            setMapImageSrc(staticFallbackSrc);
            return;
        }
        setMapImageSrc(null);
    };

    React.useEffect(() => {
        if (!mapPreviewUrl || !isImageCdnEnabled()) return;
        let canceled = false;
        const controller = new AbortController();

        const loadBlurhash = async () => {
            try {
                const response = await fetch(buildBlurhashEndpointUrl(mapPreviewUrl), { signal: controller.signal });
                if (!response.ok) return;
                const hash = (await response.text()).trim();
                if (!hash || canceled) return;
                setDynamicBlurhash(hash);
            } catch {
                // Ignore preview placeholder fetch errors.
            }
        };

        void loadBlurhash();

        return () => {
            canceled = true;
            controller.abort();
        };
    }, [mapPreviewUrl]);

    return (
        <article className="rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-lg cursor-pointer">
            <div
                className={`relative h-36 rounded-t-2xl overflow-hidden ${mapImageSrc ? 'bg-slate-100' : card.mapColor}`}
                style={mapViewTransitionName ? ({ viewTransitionName: mapViewTransitionName } as React.CSSProperties) : undefined}
            >
                {mapImageSrc ? (
                    <ProgressiveImage
                        src={mapImageSrc}
                        alt={t('examples.cards.labels.routeMapAlt', {
                            title: localizedTitle,
                            defaultValue: `Route map for ${localizedTitle}`,
                        })}
                        width={680}
                        height={288}
                        sizes="(min-width: 768px) 340px, 300px"
                        srcSetWidths={[280, 340, 420, 560]}
                        placeholderKey={card.mapImagePath || mapImageSrc}
                        placeholderBlurhash={mapImageSrc === mapPreviewUrl ? dynamicBlurhash : undefined}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        fetchPriority="low"
                        disableCdn={Boolean(card.mapImagePath && mapImageSrc?.includes(card.mapImagePath))}
                        onError={handleMapImageError}
                    />
                ) : (
                    <>
                        <div className={`absolute left-[20%] top-[30%] h-2.5 w-2.5 rounded-full ${card.mapAccent}`} />
                        <div className={`absolute left-[40%] top-[55%] h-2 w-2 rounded-full ${card.mapAccent} opacity-70`} />
                        <div className={`absolute left-[60%] top-[35%] h-3 w-3 rounded-full ${card.mapAccent}`} />
                        <div className={`absolute left-[75%] top-[60%] h-2 w-2 rounded-full ${card.mapAccent} opacity-60`} />
                        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 340 144" fill="none" preserveAspectRatio="none">
                            <path
                                d="M68 43 L136 79 L204 50 L255 86"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeDasharray="4 4"
                                className="text-slate-400/40"
                            />
                        </svg>
                    </>
                )}
            </div>

            <div className="p-4">
                <h3
                    className="text-base font-bold text-slate-900"
                    style={titleViewTransitionName ? ({ viewTransitionName: titleViewTransitionName } as React.CSSProperties) : undefined}
                >
                    {localizedTitle}
                </h3>

                <div className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-600">
                    {card.countries.map((c) => (
                        <span key={c.name} className="inline-flex items-center gap-1">
                            <span>{c.flag}</span>
                            <span>{getDestinationDisplayName(c.name, currentLocale)}</span>
                        </span>
                    ))}
                </div>

                <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                        <Clock size={14} weight="duotone" className="text-accent-500" />
                        {t('examples.cards.labels.days', {
                            count: card.durationDays,
                            defaultValue: `${card.durationDays} days`,
                        })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <MapPin size={14} weight="duotone" className="text-accent-500" />
                        {t('examples.cards.labels.cities', {
                            count: card.cityCount,
                            defaultValue: `${card.cityCount} cities`,
                        })}
                    </span>
                    {card.isRoundTrip ? (
                        <span className="inline-flex items-center gap-1">
                            <Repeat size={14} weight="duotone" className="text-accent-500" />
                            {t('examples.cards.labels.roundTrip', { defaultValue: 'Round-trip' })}
                        </span>
                    ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                    {card.tags.map((tag) => (
                        <span
                            key={tag}
                            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
                        >
                            {t(`examples.cards.tags.${normalizeTagTranslationKey(tag)}`, { defaultValue: tag })}
                        </span>
                    ))}
                </div>
            </div>

            {cityLanes.length > 0 && (
                <div className="border-t border-slate-100 px-4 py-2.5">
                    <div className="flex items-center gap-[2px]">
                        {cityLanes.map((cityLane, index) => {
                            const routeLane = routeLanes[index];
                            const laneName = getExampleCityLaneViewTransitionName(enableSharedTransition, index);
                            return (
                                <React.Fragment key={cityLane.id}>
                                    <span
                                        className="example-city-lane-hitbox block cursor-pointer"
                                        data-tooltip={cityLane.title}
                                        style={{
                                            flexGrow: cityLane.nights,
                                            flexBasis: 0,
                                        }}
                                    >
                                        <span
                                            className="example-city-lane block rounded-[1px]"
                                            style={{
                                                backgroundColor: cityLane.color,
                                                color: buildLaneOutlineColor(cityLane.color),
                                                ...(laneName ? ({ viewTransitionName: laneName } as React.CSSProperties) : {}),
                                            }}
                                        />
                                    </span>
                                    {routeLane && (
                                        <span
                                            className="block h-[3px] self-center rounded-[1px]"
                                            title={t('examples.cards.labels.routeLegTitle', {
                                                days: routeLane.durationDays.toFixed(2),
                                                defaultValue: `Route leg: ${routeLane.durationDays.toFixed(2)} days`,
                                            })}
                                            style={{
                                                flexGrow: routeLane.durationDays,
                                                flexBasis: 0,
                                                backgroundColor: routeLane.color,
                                                opacity: 0.45,
                                            }}
                                        />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className={`${cityLanes.length > 0 ? '' : 'border-t border-slate-100'} px-4 py-3 flex items-center gap-2`}>
                <div className={`h-6 w-6 rounded-full ${card.avatarColor} flex items-center justify-center text-white text-[10px] font-bold`}>
                    {card.username[0].toUpperCase()}
                </div>
                <span className="text-xs text-slate-500">{card.username}</span>
            </div>
        </article>
    );
};
