import React from 'react';
import { NavLink, useNavigate } from '../../app/navigation';
import { IdentificationCard, SealCheck, ShieldCheck } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { buildPath } from '../../config/routes';
import { PASSPORT_FEATURE_ENABLED } from '../../services/passportService';
import { getAnalyticsDebugAttributes, trackEvent } from '../../services/analyticsService';
import { showAppToast } from '../ui/appToast';

const actionClass = 'inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary';

/** Account-home actions stay separate from the public identity/statistics card. */
export function ProfileHomeActions({ username, isAdmin, onOpenPassport }: {
    username?: string | null;
    isAdmin: boolean;
    onOpenPassport: (rect: DOMRect) => void;
}) {
    const { t } = useTranslation(['profile', 'common']);
    const navigate = useNavigate();
    const publicProfilePath = username ? buildPath('publicProfile', { username }) : null;
    const shareProfile = () => {
        if (!publicProfilePath) {
            trackEvent('profile__summary--view_public_profile_setup');
            navigate(buildPath('profileSettings'));
            return;
        }
        const publicProfileUrl = `${window.location.origin}${publicProfilePath}`;
        trackEvent('profile__summary--share_public_profile');
        const openProfile = () => {
            window.open(publicProfileUrl, '_blank', 'noopener,noreferrer');
            showAppToast({ tone: 'info', title: t('summary.shareOpenedTitle'), description: t('summary.shareOpened') });
        };
        if (navigator.clipboard?.writeText) {
            void navigator.clipboard.writeText(publicProfileUrl)
                .then(() => {
                    showAppToast({ tone: 'success', title: t('summary.shareCopiedTitle'), description: t('summary.shareCopied') });
                })
                .catch(openProfile);
        } else {
            openProfile();
        }
    };
    return (
        <section className="space-y-2">
            <h2 className="text-sm font-black tracking-tight text-foreground">{t('actions.title')}</h2>
            <div className="flex flex-wrap items-center gap-2">
                <NavLink to={buildPath('createTrip')} onClick={() => trackEvent('profile__shortcut--planner')}
                    className={actionClass} {...getAnalyticsDebugAttributes('profile__shortcut--planner')}>
                    <IdentificationCard size={16} />
                    {t('nav.createTrip', { ns: 'common' })}
                </NavLink>
                {PASSPORT_FEATURE_ENABLED && (
                    <button type="button" onClick={(event) => {
                        trackEvent('profile__shortcut--stamps');
                        onOpenPassport(event.currentTarget.getBoundingClientRect());
                    }} className={actionClass} {...getAnalyticsDebugAttributes('profile__shortcut--stamps')}>
                        <SealCheck size={16} weight="duotone" />
                        {t('actions.stamps')}
                    </button>
                )}
                <NavLink to={buildPath('profileSettings')} onClick={() => trackEvent('profile__summary--edit_profile')}
                    className={actionClass} {...getAnalyticsDebugAttributes('profile__summary--edit_profile')}>
                    {t('summary.editProfile')}
                </NavLink>
                {publicProfilePath && (
                    <NavLink to={publicProfilePath} onClick={() => trackEvent('profile__summary--view_public_profile')}
                        className={actionClass} {...getAnalyticsDebugAttributes('profile__summary--view_public_profile')}>
                        {t('summary.viewPublicProfile')}
                    </NavLink>
                )}
                <button type="button" onClick={shareProfile} className={actionClass}
                    {...getAnalyticsDebugAttributes('profile__summary--share_public_profile')}>
                    {t('summary.shareProfile')}
                </button>
                {isAdmin && (
                    <NavLink to={buildPath('adminDashboard')} onClick={() => trackEvent('profile__shortcut--admin_workspace')}
                        className={actionClass} {...getAnalyticsDebugAttributes('profile__shortcut--admin_workspace')}>
                        <ShieldCheck size={16} />
                        {t('actions.adminWorkspace')}
                    </NavLink>
                )}
            </div>
        </section>
    );
}
