import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { CaretLeft, IdentificationCard } from '@phosphor-icons/react';
import { useTranslation } from 'react-i18next';
import { SiteHeader } from '../components/navigation/SiteHeader';
import { SiteFooter } from '../components/marketing/SiteFooter';
import { ProfileStampBookViewer } from '../components/profile/ProfileStampBookViewer';
import { buildProfileStampProgress, computeProfileStampMetrics } from '../components/profile/profileStamps';
import { sortTripsByUpdatedDesc } from '../components/profile/profileTripState';
import {
  getPublicTripsPageByUserId,
  resolvePublicProfileByHandle,
  type UserProfileRecord,
} from '../services/profileService';
import { getAllTrips } from '../services/storageService';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import { useAuth } from '../hooks/useAuth';
import { buildPath } from '../config/routes';
import type { ITrip } from '../types';

const PUBLIC_STAMPS_PAGE_SIZE = 40;

const normalizeUsername = (value: unknown): string => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

const mergeTrips = (rows: ITrip[]): ITrip[] => {
  const byId = new Map<string, ITrip>();
  rows.forEach((trip) => byId.set(trip.id, trip));
  return sortTripsByUpdatedDesc(Array.from(byId.values()));
};

const loadAllPublicTripsByUserId = async (userId: string): Promise<ITrip[]> => {
  const allTrips: ITrip[] = [];
  let nextOffset = 0;
  let hasMore = true;
  let guard = 0;

  while (hasMore && guard < 40) {
    const page = await getPublicTripsPageByUserId(userId, {
      offset: nextOffset,
      limit: PUBLIC_STAMPS_PAGE_SIZE,
    });
    allTrips.push(...page.trips);
    hasMore = page.hasMore;
    if (!hasMore) break;
    if (page.nextOffset === nextOffset) break;
    nextOffset = page.nextOffset;
    guard += 1;
  }

  return mergeTrips(allTrips);
};

type PublicStampState = {
  status: 'loading' | 'found' | 'private' | 'not_found';
  profile: UserProfileRecord | null;
  trips: ITrip[];
};

export const PublicProfileStampsPage: React.FC = () => {
  const { username = '' } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('profile');
  const { isLoading: isAuthLoading, isAuthenticated, profile: viewerProfile } = useAuth();
  const [state, setState] = useState<PublicStampState>({
    status: 'loading',
    profile: null,
    trips: [],
  });

  const locale = i18n.resolvedLanguage ?? i18n.language ?? 'en';
  const viewerHandle = useMemo(
    () => normalizeUsername(viewerProfile?.username),
    [viewerProfile?.username]
  );
  const viewerProfileId = viewerProfile?.id || null;

  useEffect(() => {
    if (isAuthLoading) return;

    const handle = normalizeUsername(username);
    if (!handle) {
      setState({ status: 'not_found', profile: null, trips: [] });
      return;
    }

    let active = true;
    setState({ status: 'loading', profile: null, trips: [] });

    void resolvePublicProfileByHandle(handle)
      .then(async (result) => {
        if (!active) return;

        if (result.status === 'redirect' && result.canonicalUsername) {
          const canonicalPath = buildPath('publicProfileStamps', { username: result.canonicalUsername });
          const currentPath = buildPath('publicProfileStamps', { username: handle });
          if (canonicalPath !== currentPath) {
            navigate(canonicalPath, { replace: true });
            return;
          }
        }

        if ((result.status === 'private' || result.status === 'not_found') && isAuthenticated && viewerProfileId && viewerProfile && viewerHandle === handle) {
          const ownTrips = mergeTrips(getAllTrips());
          setState({
            status: 'found',
            profile: viewerProfile,
            trips: ownTrips,
          });
          trackEvent('public_profile__stamps_view', {
            username: viewerProfile.username || handle,
            owner_mode: 'self_fallback',
          });
          return;
        }

        if (result.status === 'private') {
          setState({ status: 'private', profile: null, trips: [] });
          return;
        }

        if (result.status === 'not_found' || !result.profile) {
          setState({ status: 'not_found', profile: null, trips: [] });
          return;
        }

        let trips: ITrip[] = [];
        try {
          trips = await loadAllPublicTripsByUserId(result.profile.id);
        } catch {
          trips = [];
        }
        if (!active) return;
        setState({
          status: 'found',
          profile: result.profile,
          trips,
        });
        trackEvent('public_profile__stamps_view', {
          username: result.profile.username || handle,
          owner_mode: 'public',
        });
      })
      .catch(() => {
        if (!active) return;
        setState({ status: 'not_found', profile: null, trips: [] });
      });

    return () => {
      active = false;
    };
  }, [isAuthLoading, isAuthenticated, navigate, username, viewerHandle, viewerProfileId]);

  const stampProgress = useMemo(() => {
    const metrics = computeProfileStampMetrics(state.trips, {
      likesGiven: 0,
      likesEarned: 0,
    });
    return buildProfileStampProgress(metrics);
  }, [state.trips]);

  const displayName = state.profile?.displayName
    || [state.profile?.firstName || '', state.profile?.lastName || ''].filter(Boolean).join(' ')
    || state.profile?.username
    || t('fallback.displayName');

  const publicProfilePath = state.profile?.username
    ? buildPath('publicProfile', { username: state.profile.username })
    : buildPath('inspirations');

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <SiteHeader hideCreateTrip />
      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-5 pb-14 pt-8 md:px-8 md:pt-10">
        <nav className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
          <CaretLeft size={14} weight="bold" className="text-slate-500" />
          <NavLink
            to={publicProfilePath}
            className="transition-colors hover:text-accent-700"
            onClick={() => trackEvent('public_profile__stamps_back--profile')}
            {...getAnalyticsDebugAttributes('public_profile__stamps_back--profile')}
          >
            {t('stamps.backToPublicProfile')}
          </NavLink>
        </nav>

        {state.status === 'loading' ? (
          <section className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        ) : null}

        {state.status === 'private' ? (
          <section className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">{t('publicProfile.privateTitle')}</h1>
            <p className="mt-2 text-sm text-slate-600">{t('publicProfile.privateDescription')}</p>
          </section>
        ) : null}

        {state.status === 'not_found' ? (
          <section className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">{t('publicProfile.notFoundTitle')}</h1>
            <p className="mt-2 text-sm text-slate-600">{t('publicProfile.notFoundDescription')}</p>
          </section>
        ) : null}

        {state.status === 'found' && state.profile ? (
          <>
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
                  trackEvent('public_profile__stamps_page--change', { page });
                }}
              />
            </section>
          </>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
};
