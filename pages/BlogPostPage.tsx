import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Clock, User, Tag, ArrowRight, Compass, Article, ArrowSquareOut, MapPinLine } from '@phosphor-icons/react';
import { Map as GoogleMap, useMap } from '@vis.gl/react-google-maps';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { AddToCalendarCard } from '../components/AddToCalendarCard';
import { GoogleMapsLoader, useGoogleMaps } from '../components/GoogleMapsLoader';
import { ProgressiveImage } from '../components/ProgressiveImage';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { FlagIcon } from '../components/flags/FlagIcon';
import { getBlogPostBySlugWithFallback, getPublishedBlogPostsForLocales } from '../services/blogService';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { parseBlogCalendarCardConfig } from '../services/blogCalendarCardService';
import type { BlogMapCardConfig, BlogMapCategory, BlogMapSpot } from '../services/blogMapCardService';
import { buildGoogleMapsCategoryQuery, buildGoogleMapsEmbedUrl, buildGoogleMapsSearchUrl, buildGoogleMapsSpotQuery, parseBlogMapCardConfig } from '../services/blogMapCardService';
import { buildLocalizedMarketingPath, buildPath, extractLocaleFromPath } from '../config/routes';
import { APP_NAME } from '../config/appGlobals';
import { DEFAULT_LOCALE, localeToIntlLocale } from '../config/locales';
import { normalizeAppLanguage } from '../utils';
import type { Components } from 'react-markdown';

const BLOG_HEADER_IMAGE_SIZES = '(min-width: 1280px) 76rem, (min-width: 1024px) 88vw, 100vw';
const BLOG_HEADER_IMAGE_FADE = 'pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/28 via-slate-900/10 to-transparent';
const BLOG_HEADER_IMAGE_PROGRESSIVE_BLUR = 'pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-slate-950/12 backdrop-blur-md [mask-image:linear-gradient(to_top,black_0%,rgba(0,0,0,0.68)_40%,transparent_100%)]';
const BLOG_DEFERRED_SECTION_STYLE: React.CSSProperties = {
    contentVisibility: 'auto',
    containIntrinsicSize: '1px 720px',
};

const toSlug = (text: string): string =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

const normalizeMarkdownImagePath = (value: string): string => {
    if (!value) return value;
    try {
        const normalized = new URL(value, window.location.origin);
        return normalized.pathname;
    } catch {
        return value.split('#')[0].split('?')[0];
    }
};

const deriveMarkdownImageAlt = (alt: string | undefined, src: string, articleTitle: string): string => {
    const cleanedAlt = (alt || '').trim();
    if (cleanedAlt.length > 0) return cleanedAlt;

    const normalizedSrc = normalizeMarkdownImagePath(src);
    const filename = normalizedSrc.split('/').pop() || 'reisebild';
    const readable = filename
        .replace(/\.[a-z0-9]+$/i, '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    return `${articleTitle}: ${readable || 'Reisebild'}`;
};

const flattenNodeText = (value: React.ReactNode): string => {
    if (value === null || value === undefined || typeof value === 'boolean') return '';
    if (typeof value === 'string' || typeof value === 'number') return String(value);
    if (Array.isArray(value)) return value.map((entry) => flattenNodeText(entry)).join('');
    if (React.isValidElement<{ children?: React.ReactNode }>(value)) {
        return flattenNodeText(value.props.children);
    }
    return '';
};

const isInternalPath = (href: string): boolean => href.startsWith('/');
const isExampleRoutePath = (href: string): boolean => href.startsWith('/example/');

interface MarkdownCodeBlockPayload {
    className: string;
    rawCode: string;
}

const extractMarkdownCodeBlockPayload = (children: React.ReactNode): MarkdownCodeBlockPayload | null => {
    const elementChild = React.Children.toArray(children)
        .find((child) => React.isValidElement<Record<string, unknown>>(child));
    if (!elementChild || !React.isValidElement<Record<string, unknown>>(elementChild)) return null;
    const className = typeof elementChild.props?.className === 'string' ? elementChild.props.className : '';
    const rawCode = flattenNodeText(elementChild.props?.children).replace(/\n$/, '');
    if (!className && !rawCode) return null;
    return { className, rawCode };
};

const BLOG_MAP_OVERLAP_RADIUS_METERS = 26;
const BLOG_MAP_OVERLAP_COORDINATE_PRECISION = 5;

const buildBlogMapCoordinateKey = (coordinates: google.maps.LatLngLiteral): string => (
    `${coordinates.lat.toFixed(BLOG_MAP_OVERLAP_COORDINATE_PRECISION)},${coordinates.lng.toFixed(BLOG_MAP_OVERLAP_COORDINATE_PRECISION)}`
);

const offsetBlogMapCoordinates = (
    origin: google.maps.LatLngLiteral,
    overlapIndex: number,
    overlapCount: number,
): google.maps.LatLngLiteral => {
    if (overlapCount <= 1 || overlapIndex < 0 || overlapIndex >= overlapCount) {
        return origin;
    }
    const angle = (-Math.PI / 2) + ((2 * Math.PI * overlapIndex) / overlapCount);
    const eastMeters = Math.cos(angle) * BLOG_MAP_OVERLAP_RADIUS_METERS;
    const northMeters = Math.sin(angle) * BLOG_MAP_OVERLAP_RADIUS_METERS;
    const metersPerDegreeLat = 111_320;
    const safeCosine = Math.max(0.01, Math.cos((origin.lat * Math.PI) / 180));
    const metersPerDegreeLng = metersPerDegreeLat * safeCosine;
    return {
        lat: origin.lat + (northMeters / metersPerDegreeLat),
        lng: origin.lng + (eastMeters / metersPerDegreeLng),
    };
};

const resolveBlogMapMarkerPositions = (
    spots: BlogMapSpot[],
    coordinatesBySpotId: Record<string, google.maps.LatLngLiteral | null | undefined>,
): Array<{ spot: BlogMapSpot; position: google.maps.LatLngLiteral }> => {
    const resolved = spots
        .map((spot) => {
            const position = coordinatesBySpotId[spot.id];
            if (!position) return null;
            return { spot, position };
        })
        .filter((entry): entry is { spot: BlogMapSpot; position: google.maps.LatLngLiteral } => Boolean(entry));

    const groupedByCoordinates = new Map<string, number[]>();
    resolved.forEach((entry, index) => {
        const key = buildBlogMapCoordinateKey(entry.position);
        const grouped = groupedByCoordinates.get(key) ?? [];
        grouped.push(index);
        groupedByCoordinates.set(key, grouped);
    });

    return resolved.map((entry, index) => {
        const key = buildBlogMapCoordinateKey(entry.position);
        const grouped = groupedByCoordinates.get(key) ?? [];
        const overlapIndex = grouped.indexOf(index);
        if (overlapIndex < 0 || grouped.length <= 1) return entry;
        return {
            spot: entry.spot,
            position: offsetBlogMapCoordinates(entry.position, overlapIndex, grouped.length),
        };
    });
};

interface BlogMapInstanceBridgeProps {
    mapId: string;
    onMapInstanceChange: (map: google.maps.Map | null) => void;
}

const BlogMapInstanceBridge: React.FC<BlogMapInstanceBridgeProps> = ({ mapId, onMapInstanceChange }) => {
    const map = useMap(mapId);

    useEffect(() => {
        onMapInstanceChange(map ?? null);
        return () => {
            onMapInstanceChange(null);
        };
    }, [map, onMapInstanceChange]);

    return null;
};

interface BlogMapCanvasProps {
    mapId: string;
    config: BlogMapCardConfig;
    activeCategory: BlogMapCategory;
    locale: string;
    postSlug: string;
    fallbackEmbedSrc: string;
}

const BlogMapCanvas: React.FC<BlogMapCanvasProps> = ({
    mapId,
    config,
    activeCategory,
    locale,
    postSlug,
    fallbackEmbedSrc,
}) => {
    const { isLoaded, loadError } = useGoogleMaps();
    const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
    const [coordinatesBySpotId, setCoordinatesBySpotId] = useState<Record<string, google.maps.LatLngLiteral | null | undefined>>({});
    const [isResolvingSpots, setIsResolvingSpots] = useState(false);
    const markerOverlaysRef = useRef<google.maps.OverlayView[]>([]);

    const mapZoom = Number.isFinite(config.mapZoom) ? Math.max(2, Math.min(18, Math.round(config.mapZoom as number))) : 13;
    const mapCenter = config.mapCenter ?? { lat: 20, lng: 0 };
    const markerSpots = useMemo(
        () => resolveBlogMapMarkerPositions(activeCategory.spots, coordinatesBySpotId),
        [activeCategory.spots, coordinatesBySpotId],
    );

    const geocodeSpotQuery = useCallback(async (
        geocoder: google.maps.Geocoder,
        spot: BlogMapSpot,
    ): Promise<{ id: string; coordinates: google.maps.LatLngLiteral | null }> => {
        const query = buildGoogleMapsSpotQuery(spot.query, config.regionContext);
        if (!query) return { id: spot.id, coordinates: null };
        return new Promise((resolve) => {
            geocoder.geocode({ address: query }, (results, status) => {
                if (status === 'OK' && results?.[0]?.geometry?.location) {
                    const location = results[0].geometry.location;
                    resolve({
                        id: spot.id,
                        coordinates: { lat: location.lat(), lng: location.lng() },
                    });
                    return;
                }
                resolve({ id: spot.id, coordinates: null });
            });
        });
    }, [config.regionContext]);

    useEffect(() => {
        if (!isLoaded || !window.google?.maps?.Geocoder) return;
        const unresolvedSpots = activeCategory.spots.filter((spot) => coordinatesBySpotId[spot.id] === undefined);
        if (unresolvedSpots.length === 0) return;

        let cancelled = false;
        setIsResolvingSpots(true);
        const geocoder = new window.google.maps.Geocoder();

        void Promise.all(unresolvedSpots.map((spot) => geocodeSpotQuery(geocoder, spot)))
            .then((results) => {
                if (cancelled) return;
                setCoordinatesBySpotId((current) => {
                    const next = { ...current };
                    results.forEach(({ id, coordinates }) => {
                        next[id] = coordinates;
                    });
                    return next;
                });
            })
            .finally(() => {
                if (!cancelled) {
                    setIsResolvingSpots(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [activeCategory.spots, coordinatesBySpotId, geocodeSpotQuery, isLoaded]);

    useEffect(() => {
        markerOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
        markerOverlaysRef.current = [];
        if (!mapInstance || !window.google?.maps?.OverlayView) return;

        markerSpots.forEach(({ spot, position }, markerIndex) => {
            const overlay = new window.google.maps.OverlayView();
            let markerNode: HTMLButtonElement | null = null;

            const handleClick = (event: MouseEvent) => {
                event.preventDefault();
                event.stopPropagation();
                trackEvent('blog__map_card--spot', {
                    slug: postSlug,
                    category: activeCategory.id,
                    spot: spot.id,
                    source: 'map_marker',
                });
                const mapsSearchUrl = buildGoogleMapsSearchUrl(spot.query);
                window.open(mapsSearchUrl, '_blank', 'noopener,noreferrer');
            };

            overlay.onAdd = function onAdd() {
                markerNode = document.createElement('button');
                markerNode.type = 'button';
                markerNode.title = spot.name;
                markerNode.style.position = 'absolute';
                markerNode.style.transform = 'translate(-50%, -100%)';
                markerNode.style.width = '30px';
                markerNode.style.height = '30px';
                markerNode.style.borderRadius = '9999px';
                markerNode.style.border = '1.5px solid #0f172a';
                markerNode.style.background = '#ffffff';
                markerNode.style.color = '#0f172a';
                markerNode.style.display = 'flex';
                markerNode.style.alignItems = 'center';
                markerNode.style.justifyContent = 'center';
                markerNode.style.cursor = 'pointer';
                markerNode.style.userSelect = 'none';
                markerNode.style.padding = '0';
                markerNode.style.fontSize = '13px';
                markerNode.style.fontWeight = '700';
                markerNode.style.boxShadow = '0 2px 6px rgba(15,23,42,0.16)';
                markerNode.style.zIndex = '25';
                markerNode.textContent = activeCategory.icon || `${markerIndex + 1}`;
                markerNode.setAttribute('aria-label', spot.name);
                markerNode.addEventListener('click', handleClick);

                const indexBadge = document.createElement('span');
                indexBadge.textContent = String(markerIndex + 1);
                indexBadge.style.position = 'absolute';
                indexBadge.style.bottom = '-7px';
                indexBadge.style.right = '-6px';
                indexBadge.style.width = '14px';
                indexBadge.style.height = '14px';
                indexBadge.style.borderRadius = '9999px';
                indexBadge.style.background = '#0f172a';
                indexBadge.style.color = '#f8fafc';
                indexBadge.style.fontSize = '9px';
                indexBadge.style.fontWeight = '700';
                indexBadge.style.display = 'flex';
                indexBadge.style.alignItems = 'center';
                indexBadge.style.justifyContent = 'center';
                markerNode.appendChild(indexBadge);

                const panes = this.getPanes();
                panes.overlayMouseTarget.appendChild(markerNode);
            };

            overlay.draw = function draw() {
                if (!markerNode) return;
                const projection = this.getProjection();
                if (!projection) return;
                const point = projection.fromLatLngToDivPixel(new window.google.maps.LatLng(position.lat, position.lng));
                if (!point) return;
                markerNode.style.left = `${point.x}px`;
                markerNode.style.top = `${point.y}px`;
            };

            overlay.onRemove = function onRemove() {
                if (!markerNode) return;
                markerNode.removeEventListener('click', handleClick);
                markerNode.remove();
                markerNode = null;
            };

            overlay.setMap(mapInstance);
            markerOverlaysRef.current.push(overlay);
        });

        return () => {
            markerOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
            markerOverlaysRef.current = [];
        };
    }, [activeCategory.icon, activeCategory.id, mapInstance, markerSpots, postSlug]);

    useEffect(() => {
        if (!mapInstance || !window.google?.maps?.LatLngBounds) return;
        if (markerSpots.length === 0) {
            mapInstance.setCenter(mapCenter);
            mapInstance.setZoom(mapZoom);
            return;
        }
        if (markerSpots.length === 1) {
            mapInstance.panTo(markerSpots[0].position);
            mapInstance.setZoom(Math.max(mapZoom, 15));
            return;
        }
        const bounds = new window.google.maps.LatLngBounds();
        markerSpots.forEach((entry) => bounds.extend(entry.position));
        mapInstance.fitBounds(bounds, { top: 52, right: 52, bottom: 52, left: 52 });
    }, [mapCenter, mapInstance, mapZoom, markerSpots]);

    if (loadError) {
        return (
            <iframe
                src={fallbackEmbedSrc}
                title={`${config.title} - ${activeCategory.label}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-full w-full border-0"
                allowFullScreen
            />
        );
    }

    const shouldRenderMapCanvas = isLoaded || !!mapInstance;

    return (
        <div className="relative h-full w-full">
            {shouldRenderMapCanvas && (
                <GoogleMap
                    id={mapId}
                    defaultCenter={mapCenter}
                    defaultZoom={mapZoom}
                    disableDefaultUI
                    gestureHandling="cooperative"
                    clickableIcons={false}
                    reuseMaps
                    className="h-full w-full"
                >
                    <BlogMapInstanceBridge mapId={mapId} onMapInstanceChange={setMapInstance} />
                </GoogleMap>
            )}
            {(!isLoaded || isResolvingSpots) && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-100/70 text-xs font-medium text-slate-600">
                    {locale === 'de' ? 'Karte wird geladen…' : 'Loading map…'}
                </div>
            )}
        </div>
    );
};

const resolveInitialCategoryId = (config: BlogMapCardConfig): string => {
    if (config.defaultCategoryId && config.categories.some((category) => category.id === config.defaultCategoryId)) {
        return config.defaultCategoryId;
    }
    return config.categories[0]?.id || '';
};

interface BlogMapCardProps {
    config: BlogMapCardConfig;
    locale: string;
    postSlug: string;
}

const BlogMapCard: React.FC<BlogMapCardProps> = ({ config, locale, postSlug }) => {
    const [activeCategoryId, setActiveCategoryId] = useState<string>(() => resolveInitialCategoryId(config));

    useEffect(() => {
        const nextCategoryId = resolveInitialCategoryId(config);
        setActiveCategoryId(nextCategoryId);
    }, [config]);

    const activeCategory = useMemo(() => {
        return config.categories.find((category) => category.id === activeCategoryId) || config.categories[0];
    }, [activeCategoryId, config.categories]);

    if (!activeCategory) return null;

    const mapId = `blog-map-${toSlug(postSlug || config.title || 'post')}`;
    const categoryQuery = buildGoogleMapsCategoryQuery(activeCategory.spots, config.regionContext);
    const fallbackSpotQuery = activeCategory.spots[0]?.query || '';
    if (!fallbackSpotQuery && !categoryQuery) return null;
    const embedSrc = buildGoogleMapsEmbedUrl(categoryQuery || fallbackSpotQuery, locale, {
        center: config.mapCenter,
        zoom: config.mapZoom,
    });
    const categoriesLabel = locale === 'de' ? 'Kategorien' : 'Categories';
    const spotsLabel = locale === 'de' ? 'Orte' : 'Places';
    const markerHintLabel = locale === 'de'
        ? 'Die Karte zeigt alle Spots der aktiven Kategorie.'
        : 'The map shows every spot from the active category.';

    return (
        <section className="my-12 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h3 className="text-lg font-bold text-slate-900">
                {config.title}
            </h3>
            {config.description && <p className="mt-2 text-sm text-slate-600">{config.description}</p>}
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{markerHintLabel}</p>

            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <div className="aspect-[16/10] w-full md:aspect-[18/9] lg:aspect-[20/9]">
                        <GoogleMapsLoader language={normalizeAppLanguage(locale)}>
                            <BlogMapCanvas
                                mapId={mapId}
                                config={config}
                                activeCategory={activeCategory}
                                locale={locale}
                                postSlug={postSlug}
                                fallbackEmbedSrc={embedSrc}
                            />
                        </GoogleMapsLoader>
                    </div>
                </div>

                <Tabs
                    value={activeCategory.id}
                    onValueChange={(nextCategoryId) => {
                        setActiveCategoryId(nextCategoryId);
                        trackEvent('blog__map_card--category', {
                            slug: postSlug,
                            category: nextCategoryId,
                        });
                    }}
                    className="min-w-0 gap-4"
                >
                    <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{categoriesLabel}</p>
                        <TabsList
                            variant="line"
                            className="h-auto w-full flex-wrap justify-start rounded-xl border border-slate-200 bg-slate-50 p-1"
                        >
                            {config.categories.map((category) => (
                                <TabsTrigger
                                    key={category.id}
                                    value={category.id}
                                    className="rounded-lg px-3 py-1.5 text-sm font-medium data-[state=active]:border-slate-200 data-[state=active]:bg-white data-[state=active]:text-slate-900"
                                    {...getAnalyticsDebugAttributes('blog__map_card--category', {
                                        slug: postSlug,
                                        category: category.id,
                                    })}
                                >
                                    {category.icon ? <span aria-hidden="true">{category.icon}</span> : null}
                                    <span>{category.label}</span>
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>

                    {config.categories.map((category) => (
                        <TabsContent key={category.id} value={category.id}>
                            <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{spotsLabel}</p>
                                <div className="grid gap-2">
                                    {category.spots.map((spot) => {
                                        const mapsSearchUrl = buildGoogleMapsSearchUrl(spot.query);
                                        return (
                                            <a
                                                key={spot.id}
                                                href={mapsSearchUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={() => {
                                                    trackEvent('blog__map_card--spot', {
                                                        slug: postSlug,
                                                        category: category.id,
                                                        spot: spot.id,
                                                    });
                                                }}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-accent-200 hover:bg-accent-50/40"
                                                {...getAnalyticsDebugAttributes('blog__map_card--spot', {
                                                    slug: postSlug,
                                                    category: category.id,
                                                    spot: spot.id,
                                                })}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="min-w-0 break-words text-sm font-semibold text-slate-800">{spot.name}</p>
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-700">
                                                        <MapPinLine size={12} weight="duotone" />
                                                        <ArrowSquareOut size={12} weight="bold" />
                                                    </span>
                                                </div>
                                                {spot.note && <p className="mt-0.5 text-xs text-slate-500">{spot.note}</p>}
                                            </a>
                                        );
                                    })}
                                </div>
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            </div>
        </section>
    );
};

const createMarkdownComponents = (mapContext: { locale: string; postSlug: string; articleTitle: string }): Components => ({
    h2: ({ children }) => {
        const text = flattenNodeText(children).trim();
        const id = toSlug(text);
        return (
            <h2
                id={id}
                className="mt-10 mb-4 text-2xl font-black tracking-tight text-slate-900 scroll-mt-24"
                style={{ fontFamily: 'var(--tf-font-heading)' }}
            >
                {children}
            </h2>
        );
    },
    h3: ({ children }) => (
        <h3 className="mt-8 mb-3 text-xl font-bold text-slate-800" style={{ fontFamily: 'var(--tf-font-heading)' }}>
            {children}
        </h3>
    ),
    p: ({ children }) => (
        <p className="mb-4 text-base leading-relaxed text-slate-600">{children}</p>
    ),
    a: ({ href, children }) => {
        const resolvedHref = (href || '').trim();
        const linkLabel = flattenNodeText(children).trim();
        const fallbackLabel = mapContext.locale === 'de' ? 'Beispielreise öffnen' : 'Open example trip';
        const displayLabel = linkLabel || fallbackLabel;

        if (resolvedHref && isExampleRoutePath(resolvedHref)) {
            return (
                <Link
                    to={resolvedHref}
                    className="group my-1 inline-flex w-full items-center justify-between gap-3 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 font-semibold text-accent-900 shadow-sm transition-colors hover:border-accent-300 hover:bg-accent-100"
                >
                    <span className="inline-flex min-w-0 items-center gap-2">
                        <img src="/favicon-32.png" alt="" aria-hidden="true" className="h-5 w-5 rounded" loading="lazy" />
                        <span className="truncate text-sm">{`${APP_NAME}: ${displayLabel}`}</span>
                    </span>
                    <ArrowSquareOut size={14} weight="bold" className="shrink-0 text-accent-700 transition-transform group-hover:translate-x-0.5" />
                </Link>
            );
        }

        if (resolvedHref && isInternalPath(resolvedHref)) {
            return (
                <Link to={resolvedHref} className="text-accent-600 underline decoration-accent-300 hover:text-accent-800 transition-colors">
                    {children}
                </Link>
            );
        }

        return (
            <a href={resolvedHref} className="text-accent-600 underline decoration-accent-300 hover:text-accent-800 transition-colors" target="_blank" rel="noopener noreferrer">
                {children}
            </a>
        );
    },
    ul: ({ children }) => (
        <ul className="mb-4 ml-6 list-disc space-y-1.5 text-base leading-relaxed text-slate-600">{children}</ul>
    ),
    ol: ({ children }) => (
        <ol className="mb-4 ml-6 list-decimal space-y-1.5 text-base leading-relaxed text-slate-600">{children}</ol>
    ),
    li: ({ children }) => <li>{children}</li>,
    img: ({ src, alt }) => {
        const resolvedSrc = (src || '').trim();
        if (!resolvedSrc) return null;
        const normalizedSrc = normalizeMarkdownImagePath(resolvedSrc);
        const resolvedAlt = deriveMarkdownImageAlt(alt, resolvedSrc, mapContext.articleTitle);
        return (
            <figure className="mb-7">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
                    <div className="relative w-full overflow-hidden bg-slate-100" style={{ aspectRatio: '3 / 2' }}>
                        <ProgressiveImage
                            src={resolvedSrc}
                            alt={resolvedAlt}
                            width={1536}
                            height={1024}
                            sizes="(min-width: 1280px) 48rem, (min-width: 1024px) 62vw, 100vw"
                            srcSetWidths={[480, 768, 1024, 1536]}
                            placeholderKey={normalizedSrc}
                            loading="lazy"
                            className="absolute inset-0 h-full w-full object-cover"
                        />
                    </div>
                </div>
                <figcaption className="mt-2 text-center text-xs font-medium text-slate-500">{resolvedAlt}</figcaption>
            </figure>
        );
    },
    pre: ({ children }) => {
        const payload = extractMarkdownCodeBlockPayload(children);

        if (payload?.className.includes('language-tf-map')) {
            const config = parseBlogMapCardConfig(payload.rawCode);
            if (config) return <BlogMapCard config={config} locale={mapContext.locale} postSlug={mapContext.postSlug} />;
        }

        if (payload?.className.includes('language-tf-calendar')) {
            const config = parseBlogCalendarCardConfig(payload.rawCode);
            if (config) return <AddToCalendarCard config={config} postSlug={mapContext.postSlug} />;
        }

        return <pre className="mb-4 overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm font-mono text-slate-200">{children}</pre>;
    },
    code: ({ children, className }) => {
        const isInline = !className;
        if (isInline) {
            return <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm font-mono text-slate-700">{children}</code>;
        }

        return (
            <code className={`text-sm font-mono text-slate-200 ${className}`}>
                {children}
            </code>
        );
    },
    blockquote: ({ children }) => (
        <blockquote className="mb-4 border-l-4 border-accent-300 pl-4 italic text-slate-500">{children}</blockquote>
    ),
    table: ({ children }) => (
        <div className="mb-4 overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
                {children}
            </table>
        </div>
    ),
    thead: ({ children }) => (
        <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
            {children}
        </thead>
    ),
    th: ({ children }) => (
        <th className="px-4 py-2.5 border-b border-slate-200">{children}</th>
    ),
    td: ({ children }) => (
        <td className="px-4 py-2.5 border-b border-slate-100 text-slate-600">{children}</td>
    ),
    hr: () => <hr className="my-8 border-slate-200" />,
});

interface HeadingInfo {
    text: string;
    slug: string;
}

const normalizeHeadingLabel = (value: string): string => {
    return value
        .replace(/[*_~`]/g, '')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
};

const extractHeadings = (content: string): HeadingInfo[] => {
    const lines = content.split('\n');
    const headings: HeadingInfo[] = [];
    for (const line of lines) {
        const match = line.match(/^##\s+(.+)$/);
        if (match) {
            const text = normalizeHeadingLabel(match[1]);
            headings.push({ text, slug: toSlug(text) });
        }
    }
    return headings;
};

const useActiveHeading = (headingSlugs: string[]): string | null => {
    const [activeId, setActiveId] = useState<string | null>(headingSlugs[0] ?? null);

    useEffect(() => {
        if (headingSlugs.length === 0) {
            setActiveId(null);
            return undefined;
        }

        const headingElements = headingSlugs
            .map((slug) => document.getElementById(slug))
            .filter((element): element is HTMLElement => Boolean(element));

        if (headingElements.length === 0) {
            setActiveId(headingSlugs[0] ?? null);
            return undefined;
        }

        let frameId: number | null = null;

        const updateActiveHeading = () => {
            frameId = null;
            const anchorTop = Math.min(220, window.innerHeight * 0.3);
            let nextId = headingElements[0].id;

            for (const headingElement of headingElements) {
                if (headingElement.getBoundingClientRect().top <= anchorTop) {
                    nextId = headingElement.id;
                    continue;
                }
                break;
            }

            setActiveId((currentId) => (currentId === nextId ? currentId : nextId));
        };

        const scheduleUpdate = () => {
            if (frameId !== null) return;
            frameId = window.requestAnimationFrame(updateActiveHeading);
        };

        updateActiveHeading();
        window.addEventListener('scroll', scheduleUpdate, { passive: true });
        window.addEventListener('resize', scheduleUpdate);

        return () => {
            if (frameId !== null) {
                window.cancelAnimationFrame(frameId);
            }
            window.removeEventListener('scroll', scheduleUpdate);
            window.removeEventListener('resize', scheduleUpdate);
        };
    }, [headingSlugs]);

    return activeId;
};

export const BlogPostPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const location = useLocation();
    const locale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
    const { t } = useTranslation('blog');

    const post = useMemo(() => (slug ? getBlogPostBySlugWithFallback(slug, locale) : undefined), [locale, slug]);
    const [hasHeaderImageError, setHasHeaderImageError] = useState(false);

    const relatedPosts = useMemo(() => {
        if (!post) return [];
        const relatedLocales = post.language === DEFAULT_LOCALE && locale !== DEFAULT_LOCALE
            ? [locale, DEFAULT_LOCALE]
            : [locale];
        const allPosts = getPublishedBlogPostsForLocales(relatedLocales);
        const postTags = new Set(post.tags);
        return allPosts
            .filter((entry) => entry.slug !== post.slug && entry.tags.some((tag) => postTags.has(tag)))
            .slice(0, 3);
    }, [locale, post]);

    const headings = useMemo(() => {
        if (!post) return [];
        const overviewLabel = locale === 'de' ? 'Einleitung' : 'Overview';
        return [{ text: overviewLabel, slug: 'overview' }, ...extractHeadings(post.content)];
    }, [locale, post]);
    const headingSlugs = useMemo(() => headings.map((heading) => heading.slug), [headings]);
    const activeHeadingId = useActiveHeading(headingSlugs);
    const markdownComponents = useMemo(
        () =>
            createMarkdownComponents({
                locale,
                postSlug: post?.slug || 'blog-post',
                articleTitle: post?.title || '',
            }),
        [locale, post?.slug, post?.title]
    );

    useEffect(() => {
        setHasHeaderImageError(false);
    }, [post?.slug]);

    const showEnglishContentNotice = post ? locale !== DEFAULT_LOCALE && post.language === DEFAULT_LOCALE : false;
    const canonicalPath = post
        ? showEnglishContentNotice
            ? buildLocalizedMarketingPath('blogPost', DEFAULT_LOCALE, { slug: post.slug })
            : buildLocalizedMarketingPath('blogPost', locale, { slug: post.slug })
        : buildLocalizedMarketingPath('blog', locale);

    useEffect(() => {
        if (!post) return;
        if (typeof document === 'undefined') return;
        const canonicalHref = new URL(canonicalPath, window.location.origin).toString();
        let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!canonicalLink) {
            canonicalLink = document.createElement('link');
            canonicalLink.setAttribute('rel', 'canonical');
            document.head.appendChild(canonicalLink);
        }
        canonicalLink.setAttribute('href', canonicalHref);
    }, [canonicalPath, post]);

    if (!post) {
        return <Navigate to={buildLocalizedMarketingPath('home', locale)} replace />;
    }

    const formattedDate = new Date(post.publishedAt).toLocaleDateString(localeToIntlLocale(locale), {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
    const contentLang = post.language;

    return (
        <MarketingLayout rootClassName="overflow-x-clip">
            <div className="reading-progress-bar" />

            <div className="pb-16 md:pb-24">
                <div className="pt-6 pb-4">
                    <Link
                        to={buildLocalizedMarketingPath('blog', locale)}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-accent-700 transition-colors"
                    >
                        <ArrowLeft size={14} weight="bold" />
                        {t('common:buttons.backToBlog')}
                    </Link>
                </div>
                {showEnglishContentNotice && (
                    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                        <span className="inline-flex items-center gap-1.5">
                            <FlagIcon code="GB" size="sm" />
                            {t('index.englishArticleNotice')}
                        </span>
                    </div>
                )}

                <div className={`relative mb-8 h-52 overflow-hidden rounded-2xl md:h-72 lg:h-80 ${hasHeaderImageError ? post.coverColor : 'bg-slate-100'}`}>
                    {!hasHeaderImageError && (
                        <>
                            <ProgressiveImage
                                src={post.images.header.sources.large}
                                alt={post.images.header.alt}
                                width={1536}
                                height={1024}
                                sizes={BLOG_HEADER_IMAGE_SIZES}
                                srcSetWidths={[480, 768, 1024, 1536]}
                                placeholderKey={post.images.header.sources.large}
                                loading="eager"
                                fetchPriority="high"
                                onError={() => setHasHeaderImageError(true)}
                                className="absolute inset-0 h-full w-full object-cover"
                            />
                            <div className={BLOG_HEADER_IMAGE_FADE} />
                            <div className={BLOG_HEADER_IMAGE_PROGRESSIVE_BLUR} />
                        </>
                    )}
                </div>

                <div className="flex items-start gap-10 lg:gap-14">
                    <div className="min-w-0 flex-1 max-w-3xl">
                        <article
                            lang={contentLang}
                            data-blog-content-lang={contentLang}
                            translate={showEnglishContentNotice ? 'no' : undefined}
                        >
                            <div id="overview" className="scroll-mt-24 h-px w-full" />
                            <h1
                                className="text-3xl font-black tracking-tight text-slate-900 md:text-5xl"
                                style={{ fontFamily: 'var(--tf-font-heading)' }}
                            >
                                {post.title}
                            </h1>

                            <div lang={locale} className="mt-5 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                                <span className="inline-flex items-center gap-1.5">
                                    <User size={14} weight="duotone" className="text-accent-400" />
                                    {post.author}
                                </span>
                                <span>{formattedDate}</span>
                                <span className="inline-flex items-center gap-1.5">
                                    <Clock size={14} weight="duotone" className="text-accent-400" />
                                    {t('index.readTime', { minutes: post.readingTimeMin })}
                                </span>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-1.5">
                                {post.tags.map((tag) => (
                                    <Link
                                        key={tag}
                                        to={buildLocalizedMarketingPath('blog', locale)}
                                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 hover:bg-slate-200 transition-colors"
                                    >
                                        <Tag size={10} weight="duotone" />
                                        {tag}
                                    </Link>
                                ))}
                            </div>

                            <p className="mt-6 border-l-4 border-accent-200 pl-4 text-lg leading-relaxed text-slate-600">
                                {post.summary}
                            </p>

                            <div className="mt-10">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                    {post.content}
                                </ReactMarkdown>
                            </div>
                        </article>
                    </div>

                    <aside className="hidden w-64 shrink-0 self-start lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
                        <div className="space-y-8 pr-1">
                            {headings.length > 0 && (
                                <nav>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{t('post.inThisArticle')}</h4>
                                    <ul className="relative border-l border-slate-200">
                                        {headings.map((heading) => {
                                            const isActive = activeHeadingId === heading.slug;
                                            return (
                                                <li key={heading.slug} className="relative">
                                                    <div
                                                        className={`absolute -left-px top-0 h-full w-0.5 rounded-full transition-colors duration-200 ${
                                                            isActive ? 'bg-accent-500' : 'bg-transparent'
                                                        }`}
                                                    />
                                                    <a
                                                        href={`#${heading.slug}`}
                                                        onClick={(event) => {
                                                            event.preventDefault();
                                                            document.getElementById(heading.slug)?.scrollIntoView({ behavior: 'smooth' });
                                                            window.history.pushState(null, '', `#${heading.slug}`);
                                                        }}
                                                        className={`block py-1.5 pl-4 text-[13px] leading-snug transition-colors duration-200 ${
                                                            isActive
                                                                ? 'font-semibold text-accent-700'
                                                                : 'text-slate-500 hover:text-slate-800'
                                                        }`}
                                                    >
                                                        {heading.text}
                                                    </a>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </nav>
                            )}

                            {relatedPosts.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{t('post.related')}</h4>
                                    <ul className="space-y-3">
                                        {relatedPosts.map((related) => (
                                            <li key={`${related.language}:${related.slug}`}>
                                                <Link
                                                    to={buildLocalizedMarketingPath('blogPost', locale, { slug: related.slug })}
                                                    lang={related.language}
                                                    data-blog-related-lang={related.language}
                                                    className="group flex items-start gap-2"
                                                >
                                                    <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${related.coverColor}`}>
                                                        <Article size={12} weight="duotone" className="text-slate-400" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-slate-700 group-hover:text-accent-700 transition-colors line-clamp-2 leading-snug">
                                                            {related.title}
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-slate-400">{t('index.readTime', { minutes: related.readingTimeMin })}</p>
                                                    </div>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-accent-50 to-white p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <Compass size={18} weight="duotone" className="text-accent-500" />
                                    <h4 className="text-sm font-bold text-slate-900">{t('post.planTripTitle')}</h4>
                                </div>
                                <p className="text-xs leading-relaxed text-slate-500 mb-3">
                                    {t('post.planTripDescription')}
                                </p>
                                <Link
                                    to={buildPath('createTrip')}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-accent-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-accent-700 hover:shadow-md"
                                >
                                    {t('common:buttons.startPlanning')}
                                    <ArrowRight size={12} weight="bold" />
                                </Link>
                            </div>

                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{t('post.explore')}</h4>
                                <div className="space-y-2">
                                    <Link to={buildLocalizedMarketingPath('blog', locale)} className="flex items-center gap-2 text-sm text-slate-600 hover:text-accent-700 transition-colors">
                                        <Article size={14} weight="duotone" className="text-slate-400" />
                                        {t('post.allArticles')}
                                    </Link>
                                    <Link to={buildLocalizedMarketingPath('inspirations', locale)} className="flex items-center gap-2 text-sm text-slate-600 hover:text-accent-700 transition-colors">
                                        <Compass size={14} weight="duotone" className="text-slate-400" />
                                        {t('post.tripInspirations')}
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>

                {relatedPosts.length > 0 && (
                    <div className="mt-16 border-t border-slate-200 pt-10 lg:hidden" style={BLOG_DEFERRED_SECTION_STYLE}>
                        <h2
                            className="text-xl font-black tracking-tight text-slate-900"
                            style={{ fontFamily: 'var(--tf-font-heading)' }}
                        >
                            {t('post.relatedArticles')}
                        </h2>
                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            {relatedPosts.map((related) => (
                                <Link
                                    key={`${related.language}:${related.slug}`}
                                    to={buildLocalizedMarketingPath('blogPost', locale, { slug: related.slug })}
                                    lang={related.language}
                                    data-blog-related-lang={related.language}
                                    className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                                >
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${related.coverColor}`}>
                                        <ArrowRight size={16} weight="bold" className="text-slate-400 group-hover:text-accent-600 transition-colors" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-accent-700 transition-colors line-clamp-2">
                                            {related.title}
                                        </h3>
                                        <p className="mt-1 text-xs text-slate-400">
                                            {t('index.readTime', { minutes: related.readingTimeMin })}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </MarketingLayout>
    );
};
