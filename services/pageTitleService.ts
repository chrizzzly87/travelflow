import { stripLocalePrefix } from '../config/routes';

export interface PageTitleLabels {
    features: string;
    inspirations: string;
    updates: string;
    blog: string;
    pricing: string;
    faq: string;
    contact: string;
    imprint: string;
    privacy: string;
    terms: string;
    cookies: string;
    login: string;
    resetPassword: string;
    shareUnavailable: string;
    createTrip: string;
    createTripLab: string;
    profile: string;
    profileSettings: string;
    profileOnboarding: string;
    admin: string;
    notFound: string;
}

export interface ResolvePageTitleOptions {
    pathname: string;
    appName: string;
    labels: PageTitleLabels;
    tripTitle?: string | null;
    blogPostTitle?: string | null;
}

const titleWithAppName = (title: string, appName: string): string => `${title} · ${appName}`;

const normalizePath = (pathname: string): string => {
    if (!pathname) return '/';
    const stripped = stripLocalePrefix(pathname);
    const normalized = stripped || '/';
    if (normalized === '/') return normalized;
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
};

const safeDecodeSegment = (segment: string): string => {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
};

const humanizeSegment = (segment: string): string => {
    const decoded = safeDecodeSegment(segment);
    return decoded
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\p{L}/gu, (char) => char.toUpperCase());
};

export const resolvePageTitle = ({
    pathname,
    appName,
    labels,
    tripTitle,
    blogPostTitle,
}: ResolvePageTitleOptions): string => {
    const normalizedPath = normalizePath(pathname);

    if (normalizedPath === '/') return appName;
    if (normalizedPath === '/features') return titleWithAppName(labels.features, appName);
    if (normalizedPath === '/inspirations') return titleWithAppName(labels.inspirations, appName);
    if (normalizedPath.startsWith('/inspirations/country/')) {
        const slug = normalizedPath.split('/')[3] || '';
        const countryLabel = humanizeSegment(slug);
        if (countryLabel) return titleWithAppName(`${countryLabel} · ${labels.inspirations}`, appName);
        return titleWithAppName(labels.inspirations, appName);
    }
    if (normalizedPath === '/inspirations/themes') return titleWithAppName(labels.inspirations, appName);
    if (normalizedPath === '/inspirations/best-time-to-travel') return titleWithAppName(labels.inspirations, appName);
    if (normalizedPath === '/inspirations/countries') return titleWithAppName(labels.inspirations, appName);
    if (normalizedPath === '/inspirations/events-and-festivals') return titleWithAppName(labels.inspirations, appName);
    if (normalizedPath === '/inspirations/weekend-getaways') return titleWithAppName(labels.inspirations, appName);
    if (normalizedPath === '/updates') return titleWithAppName(labels.updates, appName);
    if (normalizedPath === '/blog') return titleWithAppName(labels.blog, appName);
    if (normalizedPath.startsWith('/blog/')) {
        const blogTitle = (blogPostTitle || '').trim();
        return blogTitle ? titleWithAppName(blogTitle, appName) : titleWithAppName(labels.blog, appName);
    }
    if (normalizedPath === '/pricing') return titleWithAppName(labels.pricing, appName);
    if (normalizedPath === '/faq') return titleWithAppName(labels.faq, appName);
    if (normalizedPath === '/contact') return titleWithAppName(labels.contact, appName);
    if (normalizedPath === '/imprint') return titleWithAppName(labels.imprint, appName);
    if (normalizedPath === '/privacy') return titleWithAppName(labels.privacy, appName);
    if (normalizedPath === '/terms') return titleWithAppName(labels.terms, appName);
    if (normalizedPath === '/cookies') return titleWithAppName(labels.cookies, appName);
    if (normalizedPath === '/share-unavailable') return titleWithAppName(labels.shareUnavailable, appName);
    if (normalizedPath === '/login') return titleWithAppName(labels.login, appName);
    if (normalizedPath === '/auth/reset-password') return titleWithAppName(labels.resetPassword, appName);

    if (normalizedPath === '/create-trip') return titleWithAppName(labels.createTrip, appName);
    if (normalizedPath.startsWith('/create-trip/labs/')) return titleWithAppName(labels.createTripLab, appName);
    if (normalizedPath.startsWith('/create-trip/v')) return titleWithAppName(labels.createTrip, appName);

    if (normalizedPath.startsWith('/trip/')) {
        const routeTripTitle = (tripTitle || '').trim();
        return routeTripTitle ? titleWithAppName(routeTripTitle, appName) : titleWithAppName(labels.createTrip, appName);
    }
    if (normalizedPath.startsWith('/example/')) return titleWithAppName(labels.inspirations, appName);
    if (normalizedPath.startsWith('/s/')) return titleWithAppName(labels.inspirations, appName);

    if (normalizedPath === '/profile') return titleWithAppName(labels.profile, appName);
    if (normalizedPath === '/profile/settings') return titleWithAppName(labels.profileSettings, appName);
    if (normalizedPath === '/profile/onboarding') return titleWithAppName(labels.profileOnboarding, appName);

    if (normalizedPath.startsWith('/admin')) {
        if (normalizedPath === '/admin/dashboard') return titleWithAppName(`${labels.admin} · Dashboard`, appName);
        if (normalizedPath === '/admin/users') return titleWithAppName(`${labels.admin} · Users`, appName);
        if (normalizedPath === '/admin/trips') return titleWithAppName(`${labels.admin} · Trips`, appName);
        if (normalizedPath === '/admin/tiers') return titleWithAppName(`${labels.admin} · Tiers`, appName);
        if (normalizedPath === '/admin/audit') return titleWithAppName(`${labels.admin} · Audit`, appName);
        if (normalizedPath === '/admin/ai-benchmark') return titleWithAppName(`${labels.admin} · AI Benchmark`, appName);
        if (normalizedPath === '/admin/ai-telemetry') return titleWithAppName(`${labels.admin} · AI Telemetry`, appName);
        return titleWithAppName(labels.admin, appName);
    }

    return titleWithAppName(labels.notFound, appName);
};
