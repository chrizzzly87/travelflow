import React from 'react';
import { NavLink } from 'react-router-dom';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';

interface SiteFooterProps {
    className?: string;
}

export const SiteFooter: React.FC<SiteFooterProps> = ({ className }) => {
    const year = new Date().getFullYear();

    const handleFooterClick = (target: string) => {
        trackEvent(`footer__${target}`);
    };

    const footerDebugAttributes = (target: string) =>
        getAnalyticsDebugAttributes(`footer__${target}`);

    return (
        <footer className={`border-t border-slate-200 bg-white/90 ${className || ''}`.trim()}>
            <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm text-slate-600">© {year} TravelFlow. All rights reserved.</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                        <NavLink to="/imprint" onClick={() => handleFooterClick('imprint')} className="text-slate-600 hover:text-slate-900" {...footerDebugAttributes('imprint')}>Imprint</NavLink>
                        <NavLink to="/privacy" onClick={() => handleFooterClick('privacy')} className="text-slate-600 hover:text-slate-900" {...footerDebugAttributes('privacy')}>Privacy</NavLink>
                        <NavLink to="/terms" onClick={() => handleFooterClick('terms')} className="text-slate-600 hover:text-slate-900" {...footerDebugAttributes('terms')}>Terms</NavLink>
                        <NavLink to="/cookies" onClick={() => handleFooterClick('cookies')} className="text-slate-600 hover:text-slate-900" {...footerDebugAttributes('cookies')}>Cookies</NavLink>
                    </div>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                    Legal content is scaffolded and should be replaced with approved production text before public launch.
                </p>
            </div>
        </footer>
    );
};
