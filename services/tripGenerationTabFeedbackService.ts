import { APP_NAME } from '../config/appGlobals';

export type TripGenerationOutcome = 'success' | 'error';

export interface TripGenerationTabFeedbackCompleteOptions {
    title?: string;
}

export interface TripGenerationTabFeedbackSession {
    complete: (outcome: TripGenerationOutcome, options?: TripGenerationTabFeedbackCompleteOptions) => void;
    cancel: () => void;
}

type SessionState = 'running' | 'success' | 'error' | 'disposed';

interface InternalSession {
    originalTitle: string;
    state: SessionState;
    reducedMotion: boolean;
    titleFrameIndex: number;
    faviconFrameIndex: number;
    faviconIntervalId: number | null;
    titleIntervalId: number | null;
    visibilityListener: () => void;
    stashedIconLinks: StashedIconLink[] | null;
}

interface StashedIconLink {
    link: HTMLLinkElement;
    parent: ParentNode;
    nextSibling: ChildNode | null;
}

const FAVICON_LINK_ID = 'tf-trip-generation-favicon';
const RUNNING_TITLE_FRAMES = [
    'Creating your trip...',
    'Mapping your route...',
    'Balancing your travel days...',
    'Curating highlights...',
    'Checking timing and transfers...',
    'Finalizing your itinerary...',
];
const TITLE_INTERVAL_MS = 10000;
const FAVICON_INTERVAL_MS = 900;
const REDUCED_MOTION_FAVICON_INTERVAL_MS = 2200;

let activeSession: InternalSession | null = null;
let canonicalDocumentTitle: string | null = null;

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined';

const supportsNotifications = (): boolean => isBrowser() && typeof Notification !== 'undefined';

const shouldReduceMotion = (): boolean => {
    if (!isBrowser() || typeof window.matchMedia !== 'function') return false;
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
};

const svgToDataUrl = (svg: string): string => `data:image/svg+xml,${encodeURIComponent(svg)}`;

const buildFavicon = (inner: string): string =>
    svgToDataUrl([
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="TravelFlow">',
        '<rect x="0" y="0" width="24" height="24" rx="6" fill="#4f46e5"/>',
        inner,
        '</svg>',
    ].join(''));

const buildRunningFaviconFrame = (needleDegrees: number): string => {
    return buildFavicon([
        '<circle cx="12" cy="12" r="7.1" fill="#ffffff" opacity="0.12" />',
        '<circle cx="12" cy="12" r="5.9" fill="none" stroke="#ffffff" stroke-width="1.35" opacity="0.98" />',
        `<g transform="rotate(${needleDegrees} 12 12)">`,
        '<path d="M12 6.5 L13.22 11.62 L12 12.62 L10.78 11.62 Z" fill="#ffffff" />',
        '<path d="M12 17.6 L11.34 13.35 L12 12.72 L12.66 13.35 Z" fill="#ffffff" opacity="0.9" />',
        '</g>',
        '<circle cx="12" cy="12" r="1.05" fill="#ffffff" />',
    ].join(''));
};

const RUNNING_FAVICON_FRAMES = [
    buildRunningFaviconFrame(0),
    buildRunningFaviconFrame(45),
    buildRunningFaviconFrame(90),
    buildRunningFaviconFrame(135),
    buildRunningFaviconFrame(180),
    buildRunningFaviconFrame(225),
    buildRunningFaviconFrame(270),
    buildRunningFaviconFrame(315),
];
const SUCCESS_FAVICON = buildFavicon('<path fill="#ffffff" d="M9.6 16.2 6.3 12.9l1.4-1.4 1.9 1.9 6.4-6.4 1.4 1.4z"/>');
const ERROR_FAVICON = buildFavicon('<path fill="#ffffff" d="M11 6h2v8h-2zm0 10h2v2h-2z"/>');

const ensureDynamicFaviconLink = (): HTMLLinkElement => {
    let link = document.getElementById(FAVICON_LINK_ID) as HTMLLinkElement | null;
    if (link) return link;

    link = document.createElement('link');
    link.id = FAVICON_LINK_ID;
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.setAttribute('sizes', 'any');
    document.head.appendChild(link);
    return link;
};

const removeDynamicFaviconLink = (): void => {
    document.getElementById(FAVICON_LINK_ID)?.remove();
};

const shouldManageIconLink = (link: HTMLLinkElement): boolean => {
    if (!link.rel) return false;
    const relTokens = link.rel
        .toLowerCase()
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean);
    if (relTokens.includes('apple-touch-icon')) return false;
    return relTokens.includes('icon');
};

const stashExistingIconLinks = (): StashedIconLink[] => {
    const headLinks = Array.from(document.head.querySelectorAll('link'));
    const targetLinks = headLinks
        .filter((entry): entry is HTMLLinkElement => entry instanceof HTMLLinkElement)
        .filter((entry) => entry.id !== FAVICON_LINK_ID)
        .filter((entry) => shouldManageIconLink(entry));

    const stashed: StashedIconLink[] = [];
    targetLinks.forEach((link) => {
        const parent = link.parentNode;
        if (!parent) return;
        stashed.push({
            link,
            parent,
            nextSibling: link.nextSibling,
        });
        parent.removeChild(link);
    });
    return stashed;
};

const restoreStashedIconLinks = (stashedIconLinks: StashedIconLink[] | null): void => {
    if (!stashedIconLinks || stashedIconLinks.length === 0) return;

    stashedIconLinks.forEach(({ link, parent, nextSibling }) => {
        if (link.parentNode) return;
        if (nextSibling && nextSibling.parentNode === parent) {
            parent.insertBefore(link, nextSibling);
            return;
        }
        parent.appendChild(link);
    });
};

const stopAnimationTimers = (session: InternalSession): void => {
    if (session.faviconIntervalId !== null) {
        window.clearInterval(session.faviconIntervalId);
        session.faviconIntervalId = null;
    }
    if (session.titleIntervalId !== null) {
        window.clearInterval(session.titleIntervalId);
        session.titleIntervalId = null;
    }
};

const restoreOriginalTabUi = (session: InternalSession): void => {
    document.title = canonicalDocumentTitle || session.originalTitle;
    removeDynamicFaviconLink();
    restoreStashedIconLinks(session.stashedIconLinks);
    session.stashedIconLinks = null;
};

const disposeSession = (session: InternalSession): void => {
    if (session.state === 'disposed') return;
    session.state = 'disposed';
    stopAnimationTimers(session);
    document.removeEventListener('visibilitychange', session.visibilityListener);
    if (activeSession === session) {
        activeSession = null;
    }
};

const applyRunningFrame = (session: InternalSession): void => {
    if (!session.stashedIconLinks) {
        session.stashedIconLinks = stashExistingIconLinks();
    }
    const frames = session.reducedMotion ? RUNNING_FAVICON_FRAMES.slice(0, 1) : RUNNING_FAVICON_FRAMES;
    const favicon = ensureDynamicFaviconLink();
    favicon.href = frames[session.faviconFrameIndex % frames.length];
    session.faviconFrameIndex = (session.faviconFrameIndex + 1) % frames.length;
};

const applyRunningTitle = (session: InternalSession): void => {
    const frames = session.reducedMotion ? RUNNING_TITLE_FRAMES.slice(0, 1) : RUNNING_TITLE_FRAMES;
    document.title = frames[session.titleFrameIndex % frames.length];
    session.titleFrameIndex = (session.titleFrameIndex + 1) % frames.length;
};

const beginHiddenRunningAnimation = (session: InternalSession): void => {
    if (session.state !== 'running') return;
    if (session.faviconIntervalId !== null || session.titleIntervalId !== null) return;

    applyRunningFrame(session);
    applyRunningTitle(session);

    const faviconInterval = session.reducedMotion
        ? REDUCED_MOTION_FAVICON_INTERVAL_MS
        : FAVICON_INTERVAL_MS;
    session.faviconIntervalId = window.setInterval(() => {
        applyRunningFrame(session);
    }, faviconInterval);

    if (!session.reducedMotion && RUNNING_TITLE_FRAMES.length > 1) {
        session.titleIntervalId = window.setInterval(() => {
            applyRunningTitle(session);
        }, TITLE_INTERVAL_MS);
    }
};

const applyCompletionState = (
    session: InternalSession,
    outcome: TripGenerationOutcome,
    options?: TripGenerationTabFeedbackCompleteOptions
): void => {
    if (!session.stashedIconLinks) {
        session.stashedIconLinks = stashExistingIconLinks();
    }
    const favicon = ensureDynamicFaviconLink();
    if (outcome === 'success') {
        favicon.href = SUCCESS_FAVICON;
        const tripTitle = options?.title?.trim();
        document.title = tripTitle ? `Trip ready: ${tripTitle}` : 'Trip ready';
        return;
    }

    favicon.href = ERROR_FAVICON;
    document.title = 'Generation failed';
};

const syncUiToVisibility = (session: InternalSession): void => {
    if (session.state === 'disposed') return;
    const hidden = document.visibilityState === 'hidden';

    if (session.state === 'running') {
        if (hidden) {
            beginHiddenRunningAnimation(session);
            return;
        }
        stopAnimationTimers(session);
        restoreOriginalTabUi(session);
        return;
    }

    if (hidden) return;
    restoreOriginalTabUi(session);
    disposeSession(session);
};

const createNoopSession = (): TripGenerationTabFeedbackSession => ({
    complete: () => {},
    cancel: () => {},
});

export const setCanonicalDocumentTitle = (title: string): void => {
    if (!isBrowser()) return;
    canonicalDocumentTitle = title;
    const hidden = document.visibilityState === 'hidden';
    if (activeSession && hidden) return;
    document.title = title;
};

export const beginTripGenerationTabFeedback = (): TripGenerationTabFeedbackSession => {
    if (!isBrowser()) return createNoopSession();

    if (activeSession) {
        restoreOriginalTabUi(activeSession);
        disposeSession(activeSession);
    }

    const session: InternalSession = {
        originalTitle: canonicalDocumentTitle || document.title,
        state: 'running',
        reducedMotion: shouldReduceMotion(),
        titleFrameIndex: 0,
        faviconFrameIndex: 0,
        faviconIntervalId: null,
        titleIntervalId: null,
        visibilityListener: () => {},
        stashedIconLinks: null,
    };

    session.visibilityListener = () => syncUiToVisibility(session);
    document.addEventListener('visibilitychange', session.visibilityListener);
    activeSession = session;
    syncUiToVisibility(session);

    return {
        complete: (outcome: TripGenerationOutcome, options?: TripGenerationTabFeedbackCompleteOptions) => {
            if (session.state === 'disposed') return;
            if (session.state !== 'running') return;

            session.state = outcome;
            stopAnimationTimers(session);

            if (document.visibilityState === 'hidden') {
                applyCompletionState(session, outcome, options);
                return;
            }

            restoreOriginalTabUi(session);
            disposeSession(session);
        },
        cancel: () => {
            if (session.state === 'disposed') return;
            restoreOriginalTabUi(session);
            disposeSession(session);
        },
    };
};

export const getTripReadyNotificationPermission = (): NotificationPermission | 'unsupported' => {
    if (!supportsNotifications()) return 'unsupported';
    return Notification.permission;
};

export const requestTripReadyNotificationPermission = async (): Promise<NotificationPermission | 'unsupported'> => {
    if (!supportsNotifications()) return 'unsupported';
    try {
        return await Notification.requestPermission();
    } catch {
        return Notification.permission || 'default';
    }
};

export const sendTripReadyNotification = (options?: { title?: string; body?: string }): boolean => {
    if (!supportsNotifications()) return false;
    if (Notification.permission !== 'granted') return false;

    try {
        const notification = new Notification(options?.title || 'Trip ready', {
            body: options?.body || `Your itinerary in ${APP_NAME} is ready to review.`,
        });
        if (typeof notification.close === 'function') {
            window.setTimeout(() => notification.close(), 8000);
        }
        return true;
    } catch {
        return false;
    }
};
