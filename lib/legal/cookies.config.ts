/**
 * Cookie Registry - single source of truth.
 *
 * When adding cookies:
 * 1. Add the cookie entry here with purpose, duration, provider, and category.
 * 2. Update legal/cookie page copy if user-facing disclosure changes.
 * 3. For non-essential categories, ensure consent-gated loading is in place.
 */

export type CookieCategory = 'essential' | 'analytics' | 'marketing';

export interface CookieDefinition {
  name: string;
  purpose: string;
  duration: string;
  provider: string;
  storage?: 'cookie' | 'localStorage' | 'sessionStorage';
  notes?: string;
}

export type CookieRegistry = Record<CookieCategory, CookieDefinition[]>;

export const COOKIE_REGISTRY: CookieRegistry = {
  essential: [
    {
      name: 'tf_cookie_consent_choice_v1',
      purpose: 'Stores user cookie consent preference',
      duration: 'Persistent',
      provider: 'TravelFlow',
      storage: 'localStorage',
    },
  ],
  analytics: [
    {
      name: 'umami.cache',
      purpose: 'Anonymous pageview tracking in cookieless analytics mode',
      duration: 'Persistent',
      provider: 'Umami (self-hosted)',
      storage: 'localStorage',
      notes: 'Only used when optional analytics consent is granted.',
    },
  ],
  marketing: [],
};

export const getCookiesByCategory = (category: CookieCategory): CookieDefinition[] =>
  COOKIE_REGISTRY[category];

export const getAllCookies = (): CookieDefinition[] => [
  ...COOKIE_REGISTRY.essential,
  ...COOKIE_REGISTRY.analytics,
  ...COOKIE_REGISTRY.marketing,
];

export const isCookieRegistered = (cookieName: string): boolean =>
  getAllCookies().some((cookie) => cookie.name === cookieName);

export const getCookieByName = (cookieName: string): CookieDefinition | undefined =>
  getAllCookies().find((cookie) => cookie.name === cookieName);

export const validateCookieRegistry = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const allCookies = getAllCookies();
  const seen = new Set<string>();

  allCookies.forEach((cookie) => {
    if (!cookie.name) {
      errors.push('Cookie is missing name');
      return;
    }
    if (seen.has(cookie.name)) {
      errors.push(`Duplicate cookie name found: ${cookie.name}`);
    }
    seen.add(cookie.name);
    if (!cookie.purpose) errors.push(`Cookie ${cookie.name} is missing purpose`);
    if (!cookie.duration) errors.push(`Cookie ${cookie.name} is missing duration`);
    if (!cookie.provider) errors.push(`Cookie ${cookie.name} is missing provider`);
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

if (import.meta.env.DEV) {
  const validation = validateCookieRegistry();
  if (!validation.valid) {
    console.error('[Cookie Registry] Validation errors:', validation.errors);
  }
}
