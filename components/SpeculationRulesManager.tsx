import React, { useEffect } from 'react';

const SCRIPT_ID = 'tf-speculation-rules';

const isSpeculationRulesSupported = (): boolean => {
    if (typeof window === 'undefined') return false;
    if (typeof HTMLScriptElement === 'undefined') return false;

    const supports = (HTMLScriptElement as typeof HTMLScriptElement & {
        supports?: (type: string) => boolean;
    }).supports;

    return typeof supports === 'function' && supports('speculationrules');
};

const isSpeculationRulesEnabled = (): boolean => {
    const env = import.meta.env.VITE_SPECULATION_RULES_ENABLED;
    if (env === 'true') return true;
    if (env === 'false') return false;
    return import.meta.env.PROD;
};

const speculationRules = {
    prefetch: [
        {
            source: 'document',
            where: {
                and: [
                    { href_matches: '/*' },
                    { not: { href_matches: '/admin/*' } },
                    { not: { href_matches: '/s/*' } },
                    { not: { href_matches: '/trip/*' } },
                    { not: { href_matches: '/api/*' } },
                    { not: { selector_matches: '[data-prefetch="off"]' } },
                ],
            },
            eagerness: 'moderate',
        },
    ],
};

export const SpeculationRulesManager: React.FC = () => {
    useEffect(() => {
        if (!isSpeculationRulesEnabled()) return;
        if (!isSpeculationRulesSupported()) return;

        const existing = document.getElementById(SCRIPT_ID);
        if (existing) return;

        const script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.type = 'speculationrules';
        script.text = JSON.stringify(speculationRules);
        document.head.appendChild(script);

        return () => {
            const node = document.getElementById(SCRIPT_ID);
            if (node && node.parentNode) {
                node.parentNode.removeChild(node);
            }
        };
    }, []);

    return null;
};
