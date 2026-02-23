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
            name: 'travelflow.session',
            purpose: 'Secure session token that keeps authenticated users logged in.',
            duration: '7 days',
            provider: 'Travelflow (first-party)',
            storage: 'cookie',
        },
        {
            name: 'travelflow.csrf',
            purpose: 'Cross-site request forgery protection for all critical form submissions.',
            duration: 'Session',
            provider: 'Travelflow (first-party)',
            storage: 'cookie',
        },
    ],
    analytics: [
        {
            name: 'umami.cache',
            purpose: 'Anonymous page view & event telemetry (hashed, no personal data).',
            duration: '18 months',
            provider: 'Umami Analytics (self-hosted, EU)',
            storage: 'localStorage',
            notes: 'Stored locally; never shared with third parties.',
        },
    ],
    marketing: [],
};
