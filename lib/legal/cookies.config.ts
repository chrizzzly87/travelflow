/**
 * Cookie Registry - Single Source of Truth
 * 
 * ⚠️ MANDATORY: When adding new cookies:
 * 1. Add entry to this config with: name, purpose, duration, category
 * 2. Update locales/*/legal.json with cookie descriptions
 * 3. If category is 'analytics' or 'marketing': Update consent logic
 * 4. Verify GDPR compliance (data processing agreement if third-party)
 * 
 * See CONTRIBUTING.md for full cookie compliance workflow.
 */

export interface CookieEntry {
    name: string;
    purpose: string;
    duration: string;
    provider: string;
    category: 'essential' | 'analytics' | 'marketing';
}

export interface CookieRegistry {
    essential: CookieEntry[];
    analytics: CookieEntry[];
    marketing: CookieEntry[];
}

/**
 * Current cookie inventory for TravelFlow
 */
export const COOKIE_REGISTRY: CookieRegistry = {
    /**
     * Essential cookies (no consent required)
     * These are necessary for core functionality
     */
    essential: [
        {
            name: 'tf_cookie_consent_choice_v1',
            purpose: 'Stores user cookie consent preference (localStorage)',
            duration: 'Persistent (localStorage)',
            provider: 'TravelFlow',
            category: 'essential',
        },
        // Add session/auth cookies here when implemented
        // {
        //     name: 'session',
        //     purpose: 'User authentication',
        //     duration: '7 days',
        //     provider: 'TravelFlow',
        //     category: 'essential',
        // },
    ],

    /**
     * Analytics cookies (consent required)
     * Loaded only after user consent
     */
    analytics: [
        {
            name: 'umami.cache',
            purpose: 'Anonymous pageview tracking (cookieless mode)',
            duration: 'Persistent (localStorage)',
            provider: 'Umami (self-hosted)',
            category: 'analytics',
        },
        // Note: Current Umami setup is cookieless (uses localStorage only)
        // If you enable cookie-based features later, add them here:
        // {
        //     name: 'umami.disabled',
        //     purpose: 'Opt-out flag for analytics',
        //     duration: 'Persistent',
        //     provider: 'Umami',
        //     category: 'analytics',
        // },
    ],

    /**
     * Marketing cookies (consent required)
     * Currently none - add future marketing/tracking cookies here
     */
    marketing: [],
};

/**
 * Get all cookies by category
 */
export function getCookiesByCategory(category: keyof CookieRegistry): CookieEntry[] {
    return COOKIE_REGISTRY[category];
}

/**
 * Get all cookies (flattened)
 */
export function getAllCookies(): CookieEntry[] {
    return [
        ...COOKIE_REGISTRY.essential,
        ...COOKIE_REGISTRY.analytics,
        ...COOKIE_REGISTRY.marketing,
    ];
}

/**
 * Check if a specific cookie is registered
 */
export function isCookieRegistered(cookieName: string): boolean {
    return getAllCookies().some(cookie => cookie.name === cookieName);
}

/**
 * Get cookie by name
 */
export function getCookieByName(cookieName: string): CookieEntry | undefined {
    return getAllCookies().find(cookie => cookie.name === cookieName);
}

/**
 * Validate cookie registry at build time
 * Call this in your build scripts to ensure all cookies are documented
 */
export function validateCookieRegistry(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const allCookies = getAllCookies();
    const names = allCookies.map(c => c.name);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);

    if (duplicates.length > 0) {
        errors.push(`Duplicate cookie names found: ${duplicates.join(', ')}`);
    }

    allCookies.forEach(cookie => {
        if (!cookie.name) errors.push('Cookie missing name');
        if (!cookie.purpose) errors.push(`Cookie ${cookie.name} missing purpose`);
        if (!cookie.duration) errors.push(`Cookie ${cookie.name} missing duration`);
        if (!cookie.provider) errors.push(`Cookie ${cookie.name} missing provider`);
    });

    return {
        valid: errors.length === 0,
        errors,
    };
}

// Development-time validation
if (import.meta.env.DEV) {
    const validation = validateCookieRegistry();
    if (!validation.valid) {
        console.error('[Cookie Registry] Validation errors:', validation.errors);
    }
}
