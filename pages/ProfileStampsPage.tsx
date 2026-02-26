import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, NavLink } from 'react-router-dom';
import { CaretLeft, IdentificationCard } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { ProfileStampBookViewer } from '../components/profile/ProfileStampBookViewer';
import { buildProfileStampProgress, computeProfileStampMetrics } from '../components/profile/profileStamps';
import { useAuth } from '../hooks/useAuth';
import { getAllTrips } from '../services/storageService';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { buildPath } from '../config/routes';

export const ProfileStampsPage: React.FC = () => {
  const { t, i18n } = useTranslation('profile');
  const {
    isLoading,
    isAuthenticated,
    access,
    session,
    profile,
    isProfileLoading,
    refreshProfile,
  } = useAuth();
  const [trips, setTrips] = useState(() => getAllTrips());
  const hasRequestedMissingProfileRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      hasRequestedMissingProfileRef.current = false;
      return;
    }
    if (profile) {
      hasRequestedMissingProfileRef.current = false;
      return;
    }
    if (isProfileLoading || hasRequestedMissingProfileRef.current) return;
    hasRequestedMissingProfileRef.current = true;
    void refreshProfile();
  }, [isAuthenticated, isProfileLoading, profile, refreshProfile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = () => setTrips(getAllTrips());
    window.addEventListener('storage', sync);
    window.addEventListener('tf:trips-updated', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('tf:trips-updated', sync);
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    trackEvent('profile__stamps--view');
  }, [isAuthenticated]);

  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const fallbackName = access?.email?.split('@')[0] || t('fallback.displayName');
  const displayName = profile?.displayName
    || [profile?.firstName || '', profile?.lastName || ''].filter(Boolean).join(' ')
    || fallbackName;

  const stampProgress = useMemo(() => {
    const metrics = computeProfileStampMetrics(trips, {
      likesGiven: trips.filter((trip) => Boolean(trip.isFavorite)).length,
      likesEarned: 0,
    });
    return buildProfileStampProgress(metrics);
  }, [trips]);

  if (!isLoading && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isProfileLoading && !profile) {
    return (
      <div className="min-h-screen bg-slate-50">
        <SiteHeader hideCreateTrip />
        <main className="mx-auto w-full max-w-7xl px-5 pb-14 pt-8 md:px-8 md:pt-10">
          <div className="h-20 animate-pulse rounded-lg bg-slate-100" aria-hidden="true" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader hideCreateTrip />
      <main className="mx-auto w-full max-w-7xl space-y-6 px-5 pb-14 pt-8 md:px-8 md:pt-10">
        <nav className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
          <CaretLeft size={14} weight="bold" className="text-slate-500" />
          <NavLink
            to={buildPath('profile')}
            className="transition-colors hover:text-accent-700"
            onClick={() => trackEvent('profile__stamps_back--profile')}
            {...getAnalyticsDebugAttributes('profile__stamps_back--profile')}
          >
            {t('stamps.backToProfile')}
          </NavLink>
        </nav>

        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-700">{t('stamps.eyebrow')}</p>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">{t('stamps.title')}</h1>
          <p className="max-w-3xl text-sm text-slate-600">{t('stamps.description', { name: displayName })}</p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
            <IdentificationCard size={14} weight="duotone" className="text-accent-600" />
            {t('summary.stampsTitle')}
          </div>
          <ProfileStampBookViewer
            stamps={stampProgress}
            locale={locale}
            labels={{
              pageIndicator: t('stamps.pageIndicator'),
              previousPage: t('stamps.previousPage'),
              nextPage: t('stamps.nextPage'),
              emptySlot: t('stamps.emptySlot'),
            }}
            resolveGroupLabel={(group) => t(`stamps.group.${group}`)}
            onPageChange={(page) => {
              trackEvent('profile__stamps_page--change', { page });
            }}
          />
        </section>
      </main>
    </div>
  );
};
