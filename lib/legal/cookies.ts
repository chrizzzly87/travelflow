import { COOKIE_REGISTRY, CookieCategory, CookieDefinition } from './cookies.config';
import { getLegalReviewDates } from './legalEnv';

export interface CookieTableRow extends CookieDefinition {
    category: CookieCategory;
}

export const COOKIE_CATEGORY_COPY: Record<CookieCategory, { title: string; description: string }> = {
    essential: {
        title: 'Essential cookies',
        description: 'Required for authentication, security, and core functionality. These cannot be switched off.',
    },
    analytics: {
        title: 'Analytics & performance',
        description: 'Help us understand product usage. Loaded only after consent and never used for profiling.',
    },
    marketing: {
        title: 'Marketing & personalization',
        description: 'Used for remarketing or personalization campaigns. We do not set any marketing cookies yet.',
    },
};

export const getCookieTableRows = (): CookieTableRow[] =>
    (Object.entries(COOKIE_REGISTRY) as Array<[CookieCategory, CookieDefinition[]]>)
        .flatMap(([category, cookies]) => cookies.map((cookie) => ({ ...cookie, category })));

export const getCookieLastReviewedDate = (): string => getLegalReviewDates().cookiesLastUpdated;

export const hasCategoryEntries = (category: CookieCategory): boolean => COOKIE_REGISTRY[category].length > 0;

export { COOKIE_REGISTRY };
