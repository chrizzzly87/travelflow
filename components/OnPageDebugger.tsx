import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Compass,
    Flask,
    Globe,
    List,
    MagnifyingGlass,
    RocketLaunch,
    ShareNetwork,
    ShieldCheck,
    User,
    X,
} from '@phosphor-icons/react';
import {
    ANALYTICS_DEBUG_EVENT_ATTR,
    ANALYTICS_DEBUG_PAYLOAD_ATTR,
    ANALYTICS_DEBUG_SELECTOR,
} from '../services/analyticsService';
import { isSimulatedLoggedIn, setSimulatedLoggedIn as setDbSimulatedLoggedIn } from '../services/dbService';

const UMAMI_DASHBOARD_URL = 'https://cloud.umami.is/analytics/eu/websites/d8a78257-7625-4891-8954-1a20b10f7537';
const DEBUG_AUTO_OPEN_STORAGE_KEY = 'tf_debug_auto_open';
const DEBUG_TRACKING_ENABLED_STORAGE_KEY = 'tf_debug_tracking_enabled';
const DEBUG_PANEL_EXPANDED_STORAGE_KEY = 'tf_debug_panel_expanded';
const DEBUG_H1_HIGHLIGHT_STORAGE_KEY = 'tf_debug_h1_highlight';
const TRIP_EXPIRED_DEBUG_EVENT = 'tf:trip-expired-debug';
const SIMULATED_LOGIN_DEBUG_EVENT = 'tf:simulated-login-debug';
const SIMULATED_LOGIN_STORAGE_KEY = 'tf_debug_simulated_login';

interface TrackingBox {
    id: string;
    top: number;
    left: number;
    width: number;
    height: number;
    label: string;
    placeLabelBelow: boolean;
}

interface AuditCheck {
    label: string;
    status: 'pass' | 'warn';
    detail: string;
}

interface AuditResult {
    checks: AuditCheck[];
    passCount: number;
}

interface DebugState {
    open: boolean;
    tracking: boolean;
}

interface MetaSnapshot {
    title: string;
    description: string;
}

interface H1HighlightBox {
    top: number;
    left: number;
    width: number;
    height: number;
    label: string;
    placeLabelBelow: boolean;
}

interface TripExpiredDebugDetail {
    available: boolean;
    expired: boolean;
}

interface SimulatedLoginDebugDetail {
    available: boolean;
    loggedIn: boolean;
}

interface OnPageDebuggerApi {
    show: () => void;
    hide: () => void;
    toggle: () => void;
    setTracking: (enabled: boolean) => void;
    toggleSimulatedLogin: (next?: boolean) => boolean;
    getSimulatedLogin: () => boolean;
    openUmami: () => void;
    openOgPlayground: () => void;
    openLighthouse: () => void;
    runSeoAudit: () => AuditResult;
    runA11yAudit: () => AuditResult;
    getState: () => DebugState;
}

type DebugCommand =
    | boolean
    | {
        open?: boolean;
        tracking?: boolean;
        seo?: boolean;
        a11y?: boolean;
        simulatedLogin?: boolean;
    };

declare global {
    interface Window {
        debug?: (command?: DebugCommand) => OnPageDebuggerApi;
        onPageDebugger?: OnPageDebuggerApi;
        toggleExpired?: (next?: boolean) => boolean;
        toggleSimulatedLogin?: (next?: boolean) => boolean;
        getSimulatedLogin?: () => boolean;
    }
}

const truncate = (value: string, max = 100): string => {
    if (value.length <= max) return value;
    return `${value.slice(0, max - 1)}…`;
};

const describePayload = (payloadRaw: string | null): string => {
    if (!payloadRaw) return '';
    try {
        const parsed = JSON.parse(payloadRaw);
        if (!parsed || typeof parsed !== 'object') return truncate(String(parsed));
        const pairs = Object.entries(parsed).map(([key, value]) => `${key}=${String(value)}`);
        return truncate(pairs.join(', '), 90);
    } catch {
        return truncate(payloadRaw, 90);
    }
};

const ensureTaglessTitle = (rawTitle: string): string =>
    rawTitle.replace(/\s+\|\s+TravelFlow$/i, '').trim();

const readMetaSnapshot = (): MetaSnapshot => {
    if (typeof document === 'undefined') {
        return { title: '', description: '' };
    }
    return {
        title: document.title.trim(),
        description: document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content.trim() || '',
    };
};

const readStoredDebuggerBoolean = (storageKey: string, fallbackValue: boolean): boolean => {
    if (typeof window === 'undefined') return fallbackValue;
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw === '1') return true;
        if (raw === '0') return false;
        return fallbackValue;
    } catch {
        return fallbackValue;
    }
};

const persistStoredDebuggerBoolean = (storageKey: string, value: boolean, fallbackValue: boolean): void => {
    if (typeof window === 'undefined') return;
    try {
        if (value === fallbackValue) {
            window.localStorage.removeItem(storageKey);
            return;
        }
        window.localStorage.setItem(storageKey, value ? '1' : '0');
    } catch {
        // Ignore storage access issues.
    }
};

const getAccessibleName = (element: HTMLElement): string => {
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel?.trim()) return ariaLabel.trim();

    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
        const labelText = ariaLabelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
            .join(' ')
            .trim();
        if (labelText) return labelText;
    }

    const title = element.getAttribute('title');
    if (title?.trim()) return title.trim();

    const text = element.textContent?.replace(/\s+/g, ' ').trim();
    return text ?? '';
};

const runSeoAudit = (): AuditResult => {
    const title = document.title.trim();
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content.trim() || '';
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href.trim() || '';
    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content.trim() || '';
    const ogDescription = document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content.trim() || '';
    const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content.trim() || '';
    const h1Count = document.querySelectorAll('h1').length;
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content.trim() || '';

    const checks: AuditCheck[] = [
        {
            label: 'Title',
            status: title.length > 10 && title.length < 75 ? 'pass' : 'warn',
            detail: title || 'Missing <title>.',
        },
        {
            label: 'Description',
            status: description.length > 50 && description.length < 190 ? 'pass' : 'warn',
            detail: description || 'Missing meta description.',
        },
        {
            label: 'Canonical',
            status: canonical ? 'pass' : 'warn',
            detail: canonical || 'Missing canonical link.',
        },
        {
            label: 'Open Graph Title',
            status: ogTitle ? 'pass' : 'warn',
            detail: ogTitle || 'Missing og:title.',
        },
        {
            label: 'Open Graph Description',
            status: ogDescription ? 'pass' : 'warn',
            detail: ogDescription || 'Missing og:description.',
        },
        {
            label: 'Open Graph Image',
            status: ogImage ? 'pass' : 'warn',
            detail: ogImage || 'Missing og:image.',
        },
        {
            label: 'Single H1',
            status: h1Count === 1 ? 'pass' : 'warn',
            detail: h1Count === 1 ? 'Exactly one H1 found.' : `Found ${h1Count} H1 elements.`,
        },
        {
            label: 'Robots',
            status: robots.toLowerCase().includes('noindex') ? 'warn' : 'pass',
            detail: robots || 'No explicit robots meta (defaults apply).',
        },
    ];

    const passCount = checks.filter((check) => check.status === 'pass').length;
    return { checks, passCount };
};

const runA11yAudit = (): AuditResult => {
    const imagesMissingAlt = document.querySelectorAll('img:not([alt])').length;

    const buttonsWithoutName = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).filter(
        (button) => !getAccessibleName(button)
    ).length;

    const linksWithoutName = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href]')).filter(
        (link) => !getAccessibleName(link)
    ).length;

    const unlabeledControls = Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        'input, select, textarea'
    )).filter((control) => {
        if ((control as HTMLInputElement).type === 'hidden') return false;
        const element = control as HTMLElement;
        if (getAccessibleName(element)) return false;
        if (element.closest('label')) return false;
        if (control.id) {
            const escapedId = control.id.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
            const selector = `label[for="${escapedId}"]`;
            if (document.querySelector(selector)) return false;
        }
        return true;
    }).length;

    const headings = Array.from(document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6'))
        .map((heading) => Number(heading.tagName.slice(1)));
    let headingLevelJumps = 0;
    for (let i = 1; i < headings.length; i += 1) {
        if (headings[i] - headings[i - 1] > 1) {
            headingLevelJumps += 1;
        }
    }

    const hasMainLandmark = Boolean(document.querySelector('main'));

    const checks: AuditCheck[] = [
        {
            label: 'Images Missing Alt',
            status: imagesMissingAlt === 0 ? 'pass' : 'warn',
            detail: imagesMissingAlt === 0 ? 'All images define alt text.' : `${imagesMissingAlt} images are missing alt attributes.`,
        },
        {
            label: 'Buttons Without Name',
            status: buttonsWithoutName === 0 ? 'pass' : 'warn',
            detail: buttonsWithoutName === 0 ? 'All buttons have accessible names.' : `${buttonsWithoutName} buttons have no accessible name.`,
        },
        {
            label: 'Links Without Name',
            status: linksWithoutName === 0 ? 'pass' : 'warn',
            detail: linksWithoutName === 0 ? 'All links have readable names.' : `${linksWithoutName} links have no accessible name.`,
        },
        {
            label: 'Form Controls Without Label',
            status: unlabeledControls === 0 ? 'pass' : 'warn',
            detail: unlabeledControls === 0 ? 'All form controls have labels.' : `${unlabeledControls} controls have no associated label.`,
        },
        {
            label: 'Heading Order',
            status: headingLevelJumps === 0 ? 'pass' : 'warn',
            detail: headingLevelJumps === 0 ? 'No heading level jumps detected.' : `${headingLevelJumps} heading level jumps detected.`,
        },
        {
            label: 'Main Landmark',
            status: hasMainLandmark ? 'pass' : 'warn',
            detail: hasMainLandmark ? '<main> landmark is present.' : 'No <main> landmark found.',
        },
    ];

    const passCount = checks.filter((check) => check.status === 'pass').length;
    return { checks, passCount };
};

const buildOgPlaygroundUrl = (currentUrl: URL): string => {
    const params = new URLSearchParams();
    const pathWithSearch = `${currentUrl.pathname}${currentUrl.search}`;

    const shareMatch = currentUrl.pathname.match(/^\/s\/([^/]+)/);
    const tripMatch = currentUrl.pathname.match(/^\/trip\/([^/]+)/);
    const versionId = currentUrl.searchParams.get('v');

    if (shareMatch) {
        params.set('mode', 'trip');
        params.set('s', shareMatch[1]);
        if (versionId) params.set('v', versionId);
        params.set('path', pathWithSearch);
        return `/api/og/playground?${params.toString()}`;
    }

    if (tripMatch) {
        params.set('mode', 'trip');
        params.set('trip', tripMatch[1]);
        if (versionId) params.set('v', versionId);
        params.set('path', pathWithSearch);
        return `/api/og/playground?${params.toString()}`;
    }

    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content.trim();
    const ogDescription = document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content.trim();
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content.trim();
    const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content.trim() || '';

    params.set('mode', 'site');
    params.set('title', ensureTaglessTitle(ogTitle || document.title));
    params.set('description', ogDescription || description || '');
    params.set('path', pathWithSearch);

    try {
        const ogImageUrl = new URL(ogImage, currentUrl.origin);
        const blogImageParam = ogImageUrl.searchParams.get('blog_image');
        if (blogImageParam) {
            params.set('blog_image', blogImageParam);
        } else if (ogImageUrl.pathname.startsWith('/images/blog/')) {
            params.set('blog_image', ogImageUrl.pathname);
        }
    } catch {
        // Ignore invalid OG image URLs.
    }

    return `/api/og/playground?${params.toString()}`;
};

export const OnPageDebugger: React.FC = () => {
    const location = useLocation();
    const rafRef = useRef<number | null>(null);
    const h1RafRef = useRef<number | null>(null);

    const isTripDetailRoute = /^\/trip\/[^/]+/.test(location.pathname);
    const showSeoTools = !isTripDetailRoute;

    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(() =>
        readStoredDebuggerBoolean(DEBUG_PANEL_EXPANDED_STORAGE_KEY, true)
    );
    const [trackingEnabled, setTrackingEnabled] = useState(() =>
        readStoredDebuggerBoolean(DEBUG_TRACKING_ENABLED_STORAGE_KEY, true)
    );
    const [autoOpenEnabled, setAutoOpenEnabled] = useState(() =>
        readStoredDebuggerBoolean(DEBUG_AUTO_OPEN_STORAGE_KEY, false)
    );
    const [trackingBoxes, setTrackingBoxes] = useState<TrackingBox[]>([]);
    const [seoAudit, setSeoAudit] = useState<AuditResult | null>(null);
    const [a11yAudit, setA11yAudit] = useState<AuditResult | null>(null);
    const [metaSnapshot, setMetaSnapshot] = useState<MetaSnapshot>(() => readMetaSnapshot());
    const [h1HighlightEnabled, setH1HighlightEnabled] = useState(() =>
        readStoredDebuggerBoolean(DEBUG_H1_HIGHLIGHT_STORAGE_KEY, false)
    );
    const [h1HighlightBox, setH1HighlightBox] = useState<H1HighlightBox | null>(null);
    const [tripExpiredToggleAvailable, setTripExpiredToggleAvailable] = useState(false);
    const [tripExpiredDebug, setTripExpiredDebug] = useState(false);
    const [simulatedLoggedIn, setSimulatedLoggedIn] = useState(() => isSimulatedLoggedIn());
    const simulatedLoggedInRef = useRef(simulatedLoggedIn);

    useEffect(() => {
        if (autoOpenEnabled) {
            setIsOpen(true);
        }
    }, [autoOpenEnabled]);

    useEffect(() => {
        window.dispatchEvent(new CustomEvent<SimulatedLoginDebugDetail>(SIMULATED_LOGIN_DEBUG_EVENT, {
            detail: { available: true, loggedIn: simulatedLoggedInRef.current },
        }));
    }, []);

    useEffect(() => {
        simulatedLoggedInRef.current = simulatedLoggedIn;
    }, [simulatedLoggedIn]);

    useEffect(() => {
        persistStoredDebuggerBoolean(DEBUG_PANEL_EXPANDED_STORAGE_KEY, isExpanded, true);
    }, [isExpanded]);

    useEffect(() => {
        persistStoredDebuggerBoolean(DEBUG_TRACKING_ENABLED_STORAGE_KEY, trackingEnabled, true);
    }, [trackingEnabled]);

    useEffect(() => {
        persistStoredDebuggerBoolean(DEBUG_AUTO_OPEN_STORAGE_KEY, autoOpenEnabled, false);
    }, [autoOpenEnabled]);

    useEffect(() => {
        persistStoredDebuggerBoolean(DEBUG_H1_HIGHLIGHT_STORAGE_KEY, h1HighlightEnabled, false);
    }, [h1HighlightEnabled]);

    useEffect(() => {
        persistStoredDebuggerBoolean(SIMULATED_LOGIN_STORAGE_KEY, simulatedLoggedIn, false);
    }, [simulatedLoggedIn]);

    useEffect(() => {
        setMetaSnapshot(readMetaSnapshot());
        if (!showSeoTools) {
            setH1HighlightBox(null);
            setSeoAudit(null);
        }
    }, [location.pathname, location.search, showSeoTools]);

    const collectTrackingBoxes = useCallback(() => {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>(ANALYTICS_DEBUG_SELECTOR));
        const boxes: TrackingBox[] = [];

        nodes.forEach((element, index) => {
            const rect = element.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;

            const computedStyle = window.getComputedStyle(element);
            if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') return;
            if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) return;

            const top = Math.max(0, rect.top);
            const left = Math.max(0, rect.left);
            const width = Math.max(0, Math.min(rect.width, window.innerWidth - left));
            const height = Math.max(0, Math.min(rect.height, window.innerHeight - top));
            if (width <= 0 || height <= 0) return;

            const eventName = element.getAttribute(ANALYTICS_DEBUG_EVENT_ATTR) || 'tracked_event';
            const payloadRaw = element.getAttribute(ANALYTICS_DEBUG_PAYLOAD_ATTR);
            const payloadSummary = describePayload(payloadRaw);
            const label = payloadSummary ? `${eventName} | ${payloadSummary}` : eventName;

            boxes.push({
                id: `${eventName}:${index}:${left}:${top}`,
                top,
                left,
                width,
                height,
                label,
                placeLabelBelow: top < 22,
            });
        });

        setTrackingBoxes(boxes);
    }, []);

    const scheduleTrackingRefresh = useCallback(() => {
        if (rafRef.current !== null) return;
        rafRef.current = window.requestAnimationFrame(() => {
            rafRef.current = null;
            collectTrackingBoxes();
        });
    }, [collectTrackingBoxes]);

    const collectH1Highlight = useCallback(() => {
        if (!showSeoTools || !h1HighlightEnabled) {
            setH1HighlightBox(null);
            return;
        }

        const firstH1 = document.querySelector<HTMLElement>('h1');
        if (!firstH1) {
            setH1HighlightBox(null);
            return;
        }

        const rect = firstH1.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) {
            setH1HighlightBox(null);
            return;
        }

        const top = Math.max(0, rect.top);
        const left = Math.max(0, rect.left);
        const width = Math.max(0, Math.min(rect.width, window.innerWidth - left));
        const height = Math.max(0, Math.min(rect.height, window.innerHeight - top));
        if (width <= 0 || height <= 0) {
            setH1HighlightBox(null);
            return;
        }

        const headingText = firstH1.textContent?.replace(/\s+/g, ' ').trim() || 'Heading';
        setH1HighlightBox({
            top,
            left,
            width,
            height,
            label: truncate(`H1 | ${headingText}`, 100),
            placeLabelBelow: top < 22,
        });
    }, [h1HighlightEnabled, showSeoTools]);

    const scheduleH1Refresh = useCallback(() => {
        if (h1RafRef.current !== null) return;
        h1RafRef.current = window.requestAnimationFrame(() => {
            h1RafRef.current = null;
            collectH1Highlight();
        });
    }, [collectH1Highlight]);

    useEffect(() => {
        if (!isOpen || !trackingEnabled) {
            setTrackingBoxes([]);
            return;
        }

        scheduleTrackingRefresh();
        window.addEventListener('resize', scheduleTrackingRefresh);
        window.addEventListener('scroll', scheduleTrackingRefresh, true);
        const observer = new MutationObserver(scheduleTrackingRefresh);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: [ANALYTICS_DEBUG_EVENT_ATTR, ANALYTICS_DEBUG_PAYLOAD_ATTR, 'class', 'style'],
        });

        return () => {
            if (rafRef.current !== null) {
                window.cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            observer.disconnect();
            window.removeEventListener('resize', scheduleTrackingRefresh);
            window.removeEventListener('scroll', scheduleTrackingRefresh, true);
        };
    }, [collectTrackingBoxes, isOpen, scheduleTrackingRefresh, trackingEnabled]);

    useEffect(() => {
        if (isOpen && trackingEnabled) {
            scheduleTrackingRefresh();
        }
    }, [isOpen, location.pathname, location.search, scheduleTrackingRefresh, trackingEnabled]);

    useEffect(() => {
        if (!isOpen || !showSeoTools || !h1HighlightEnabled) {
            setH1HighlightBox(null);
            return;
        }

        scheduleH1Refresh();
        window.addEventListener('resize', scheduleH1Refresh);
        window.addEventListener('scroll', scheduleH1Refresh, true);
        const observer = new MutationObserver(scheduleH1Refresh);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style'],
        });

        return () => {
            if (h1RafRef.current !== null) {
                window.cancelAnimationFrame(h1RafRef.current);
                h1RafRef.current = null;
            }
            observer.disconnect();
            window.removeEventListener('resize', scheduleH1Refresh);
            window.removeEventListener('scroll', scheduleH1Refresh, true);
        };
    }, [h1HighlightEnabled, isOpen, scheduleH1Refresh, showSeoTools]);

    useEffect(() => {
        if (!isOpen || !showSeoTools || !h1HighlightEnabled) return;
        scheduleH1Refresh();
    }, [h1HighlightEnabled, isOpen, location.pathname, location.search, scheduleH1Refresh, showSeoTools]);

    const openUmami = useCallback(() => {
        window.open(UMAMI_DASHBOARD_URL, '_blank', 'noopener,noreferrer');
    }, []);

    const openOgPlayground = useCallback(() => {
        const currentUrl = new URL(window.location.href);
        const target = buildOgPlaygroundUrl(currentUrl);
        window.open(target, '_blank', 'noopener,noreferrer');
    }, []);

    const openLighthouse = useCallback(() => {
        const currentPage = encodeURIComponent(window.location.href);
        window.open(`https://pagespeed.web.dev/report?url=${currentPage}`, '_blank', 'noopener,noreferrer');
    }, []);

    const runSeoAuditAndStore = useCallback(() => {
        setMetaSnapshot(readMetaSnapshot());
        const result = runSeoAudit();
        setSeoAudit(result);
        return result;
    }, []);

    const runA11yAuditAndStore = useCallback(() => {
        const result = runA11yAudit();
        setA11yAudit(result);
        return result;
    }, []);

    const toggleAutoOpen = useCallback(() => {
        const next = !autoOpenEnabled;
        setAutoOpenEnabled(next);
    }, [autoOpenEnabled]);

    const setSimulatedLogin = useCallback((next: boolean): boolean => {
        const resolved = setDbSimulatedLoggedIn(next);
        setSimulatedLoggedIn(resolved);
        simulatedLoggedInRef.current = resolved;
        window.dispatchEvent(new CustomEvent<SimulatedLoginDebugDetail>(SIMULATED_LOGIN_DEBUG_EVENT, {
            detail: { available: true, loggedIn: resolved },
        }));
        return resolved;
    }, []);

    const toggleSimulatedLogin = useCallback((next?: boolean): boolean => {
        const resolved = typeof next === 'boolean' ? next : !simulatedLoggedInRef.current;
        return setSimulatedLogin(resolved);
    }, [setSimulatedLogin]);

    const handleTripExpiredEvent = useCallback((event: Event) => {
        const detail = (event as CustomEvent<TripExpiredDebugDetail>).detail;
        if (!detail) return;
        setTripExpiredToggleAvailable(Boolean(detail.available));
        setTripExpiredDebug(Boolean(detail.expired));
    }, []);

    useEffect(() => {
        const handler = (event: Event) => handleTripExpiredEvent(event);
        window.addEventListener(TRIP_EXPIRED_DEBUG_EVENT, handler as EventListener);
        return () => {
            window.removeEventListener(TRIP_EXPIRED_DEBUG_EVENT, handler as EventListener);
        };
    }, [handleTripExpiredEvent]);

    useEffect(() => {
        if (!isTripDetailRoute) {
            setTripExpiredToggleAvailable(false);
            setTripExpiredDebug(false);
        } else {
            setTripExpiredToggleAvailable(Boolean(window.toggleExpired));
        }
    }, [isTripDetailRoute]);

    const toggleTripExpired = useCallback((next?: boolean) => {
        const resolved = window.toggleExpired?.(next);
        if (typeof resolved !== 'boolean') {
            setTripExpiredToggleAvailable(false);
            return;
        }
        setTripExpiredToggleAvailable(true);
        setTripExpiredDebug(resolved);
    }, []);

    const api = useMemo<OnPageDebuggerApi>(() => ({
        show: () => {
            setIsOpen(true);
            setIsExpanded(true);
            setTrackingEnabled(true);
        },
        hide: () => setIsOpen(false),
        toggle: () => setIsOpen((prev) => !prev),
        setTracking: (enabled: boolean) => setTrackingEnabled(enabled),
        toggleSimulatedLogin,
        getSimulatedLogin: () => simulatedLoggedInRef.current,
        openUmami,
        openOgPlayground,
        openLighthouse,
        runSeoAudit: runSeoAuditAndStore,
        runA11yAudit: runA11yAuditAndStore,
        getState: () => ({ open: isOpen, tracking: trackingEnabled }),
    }), [isOpen, openLighthouse, openOgPlayground, openUmami, runA11yAuditAndStore, runSeoAuditAndStore, toggleSimulatedLogin, trackingEnabled]);

    useEffect(() => {
        const debugFn = (command?: DebugCommand): OnPageDebuggerApi => {
            if (typeof command === 'boolean') {
                setIsOpen(command);
                if (command) {
                    setTrackingEnabled(true);
                    setIsExpanded(true);
                }
                return api;
            }

            if (command && typeof command === 'object') {
                if (typeof command.open === 'boolean') {
                    setIsOpen(command.open);
                } else {
                    setIsOpen(true);
                }
                if (typeof command.tracking === 'boolean') {
                    setTrackingEnabled(command.tracking);
                }
                if (typeof command.simulatedLogin === 'boolean') {
                    toggleSimulatedLogin(command.simulatedLogin);
                }
                if (command.seo && showSeoTools) {
                    runSeoAuditAndStore();
                }
                if (command.a11y) {
                    runA11yAuditAndStore();
                }
                return api;
            }

            setIsOpen(true);
            setIsExpanded(true);
            setTrackingEnabled(true);
            return api;
        };

        window.debug = debugFn;
        window.onPageDebugger = api;
        window.toggleSimulatedLogin = (next?: boolean) => toggleSimulatedLogin(next);
        window.getSimulatedLogin = () => simulatedLoggedInRef.current;
        return () => {
            delete window.debug;
            delete window.onPageDebugger;
            delete window.toggleSimulatedLogin;
            delete window.getSimulatedLogin;
        };
    }, [api, runA11yAuditAndStore, runSeoAuditAndStore, showSeoTools, toggleSimulatedLogin]);

    if (!isOpen) {
        return null;
    }

    return (
        <>
            {trackingEnabled && trackingBoxes.length > 0 && (
                <div className="pointer-events-none fixed inset-0 z-[1590]">
                    {trackingBoxes.map((box) => (
                        <div
                            key={box.id}
                            className="absolute border border-red-500 bg-red-500/5"
                            style={{
                                top: `${box.top}px`,
                                left: `${box.left}px`,
                                width: `${box.width}px`,
                                height: `${box.height}px`,
                            }}
                        >
                            <span
                                className="absolute left-0 z-[1] max-w-[320px] rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-md"
                                style={box.placeLabelBelow ? { top: '100%', marginTop: '2px' } : { bottom: '100%', marginBottom: '2px' }}
                            >
                                {box.label}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {showSeoTools && h1HighlightEnabled && h1HighlightBox && (
                <div className="pointer-events-none fixed inset-0 z-[1595]">
                    <div
                        className="absolute border-2 border-sky-500 bg-sky-500/10"
                        style={{
                            top: `${h1HighlightBox.top}px`,
                            left: `${h1HighlightBox.left}px`,
                            width: `${h1HighlightBox.width}px`,
                            height: `${h1HighlightBox.height}px`,
                        }}
                    >
                        <span
                            className="absolute left-0 max-w-[320px] rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-md"
                            style={h1HighlightBox.placeLabelBelow ? { top: '100%', marginTop: '2px' } : { bottom: '100%', marginBottom: '2px' }}
                        >
                            {h1HighlightBox.label}
                        </span>
                    </div>
                </div>
            )}

            <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[1600] px-3">
                <div className="pointer-events-auto mx-auto w-full max-w-6xl overflow-hidden rounded-xl border border-slate-300 bg-white/95 shadow-2xl backdrop-blur">
                    <div className="flex flex-wrap items-center gap-2 p-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                            <Flask size={13} weight="duotone" />
                            Debugger
                        </span>
                        <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                            {trackingBoxes.length} tracked in viewport
                        </span>
                        {showSeoTools && seoAudit && (
                            <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                                SEO {seoAudit.passCount}/{seoAudit.checks.length}
                            </span>
                        )}
                        {a11yAudit && (
                            <span className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                                A11y {a11yAudit.passCount}/{a11yAudit.checks.length}
                            </span>
                        )}
                        <span className={`rounded-md border px-2 py-1 text-xs ${
                            simulatedLoggedIn
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                : 'border-slate-300 bg-slate-50 text-slate-600'
                        }`}>
                            Sim login {simulatedLoggedIn ? 'on' : 'off'}
                        </span>
                        {isTripDetailRoute && tripExpiredToggleAvailable && (
                            <span className={`rounded-md border px-2 py-1 text-xs ${
                                tripExpiredDebug
                                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                                    : 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            }`}>
                                Trip {tripExpiredDebug ? 'expired (debug)' : 'active'}
                            </span>
                        )}
                        <div className="ml-auto flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setIsExpanded((prev) => !prev)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                                <List size={14} />
                                {isExpanded ? 'Collapse' : 'Expand'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                                <X size={14} />
                                Close
                            </button>
                        </div>
                    </div>

                    {isExpanded && (
                        <div className="border-t border-slate-200 p-3">
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                <button
                                    type="button"
                                    onClick={openUmami}
                                    className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    <Globe size={16} weight="duotone" />
                                    Open Umami
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setTrackingEnabled((prev) => !prev)}
                                    className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                                        trackingEnabled
                                            ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <MagnifyingGlass size={16} weight="duotone" />
                                    {trackingEnabled ? 'Hide Tracking Boxes' : 'Show Tracking Boxes'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => toggleSimulatedLogin()}
                                    className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                                        simulatedLoggedIn
                                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <User size={16} weight="duotone" />
                                    {simulatedLoggedIn ? 'Disable Sim Login' : 'Enable Sim Login'}
                                </button>

                                <button
                                    type="button"
                                    onClick={openOgPlayground}
                                    className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    <ShareNetwork size={16} weight="duotone" />
                                    Open OG Playground
                                </button>

                                {showSeoTools && (
                                    <button
                                        type="button"
                                        onClick={runSeoAuditAndStore}
                                        className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                    >
                                        <Compass size={16} weight="duotone" />
                                        Run SEO Check
                                    </button>
                                )}

                                {showSeoTools && (
                                    <button
                                        type="button"
                                        onClick={() => setH1HighlightEnabled((prev) => !prev)}
                                        className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                                            h1HighlightEnabled
                                                ? 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100'
                                                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Compass size={16} weight="duotone" />
                                        {h1HighlightEnabled ? 'Unmark H1' : 'Mark H1'}
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={runA11yAuditAndStore}
                                    className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    <ShieldCheck size={16} weight="duotone" />
                                    Run A11y Check
                                </button>

                                <button
                                    type="button"
                                    onClick={openLighthouse}
                                    className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    <RocketLaunch size={16} weight="duotone" />
                                    Open Lighthouse (PSI)
                                </button>

                                {isTripDetailRoute && (
                                    <button
                                        type="button"
                                        onClick={() => toggleTripExpired()}
                                        disabled={!tripExpiredToggleAvailable}
                                        className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${
                                            tripExpiredDebug
                                                ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                                                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                        } ${tripExpiredToggleAvailable ? '' : 'opacity-50 cursor-not-allowed'}`}
                                    >
                                        <Flask size={16} weight="duotone" />
                                        {tripExpiredDebug ? 'Set Trip Active' : 'Set Trip Expired'}
                                    </button>
                                )}
                            </div>

                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                <span>
                                    Console: run <code className="rounded bg-slate-200 px-1 py-0.5">debug()</code> to reopen,{' '}
                                    <code className="rounded bg-slate-200 px-1 py-0.5">toggleSimulatedLogin()</code> to switch auth simulation.
                                </span>
                                <button
                                    type="button"
                                    onClick={toggleAutoOpen}
                                    className={`rounded border px-2 py-1 font-medium ${
                                        autoOpenEnabled
                                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                            : 'border-slate-300 bg-white text-slate-700'
                                    }`}
                                >
                                    {autoOpenEnabled ? 'Auto-open enabled' : 'Enable auto-open'}
                                </button>
                            </div>

                            {showSeoTools && (
                                <div className="mt-3 rounded-md border border-slate-200 bg-white p-2 text-xs">
                                    <div className="font-semibold uppercase tracking-wide text-slate-500">Current Meta</div>
                                    <div className="mt-2 grid gap-2">
                                        <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">
                                            <strong className="text-slate-900">Title:</strong>{' '}
                                            {metaSnapshot.title || 'Missing <title>.'}
                                        </div>
                                        <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">
                                            <strong className="text-slate-900">Description:</strong>{' '}
                                            {metaSnapshot.description || 'Missing meta description.'}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(seoAudit || a11yAudit) && (
                                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                    {showSeoTools && seoAudit && (
                                        <div className="rounded-md border border-slate-200 bg-white p-2">
                                            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">SEO Checks</h3>
                                            <ul className="mt-2 space-y-1 text-xs">
                                                {seoAudit.checks.map((check) => (
                                                    <li key={check.label} className="flex items-start gap-2">
                                                        <span className={check.status === 'pass' ? 'text-emerald-600' : 'text-amber-600'}>
                                                            {check.status === 'pass' ? 'PASS' : 'WARN'}
                                                        </span>
                                                        <span className="text-slate-700">
                                                            <strong>{check.label}:</strong> {check.detail}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {a11yAudit && (
                                        <div className="rounded-md border border-slate-200 bg-white p-2">
                                            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Accessibility Checks</h3>
                                            <ul className="mt-2 space-y-1 text-xs">
                                                {a11yAudit.checks.map((check) => (
                                                    <li key={check.label} className="flex items-start gap-2">
                                                        <span className={check.status === 'pass' ? 'text-emerald-600' : 'text-amber-600'}>
                                                            {check.status === 'pass' ? 'PASS' : 'WARN'}
                                                        </span>
                                                        <span className="text-slate-700">
                                                            <strong>{check.label}:</strong> {check.detail}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
