import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from '@/app/navigation';
import { useAuth } from '../hooks/useAuth';
import { useLoginModal } from '../hooks/useLoginModal';
import { DB_ENABLED } from '../config/db';
import { trackEvent } from '../services/analyticsService';
import { dbCanCreateTrip, dbCreateTripVersion, dbUpsertTrip } from '../services/dbApi';
import { saveTrip } from '../services/storageService';
import { buildTripFromDraft, findMyTripDraftClaim, recordTripDraftClaim } from '../services/tripDraftService';
import { showAppToast } from '../components/ui/appToast';
import { buildTripUrl } from '../utils';
import type { IViewSettings } from '../types';
import type { ExampleTripLoaderRouteProps } from './tripRouteTypes';
import type { TripDraftRouteData } from '../features/trips/routeData';
import { useRouteViewSettings } from '../features/trips/useRouteViewSettings';
import { useTripCopyLimit } from '../features/trips/useTripCopyLimit';
// The native route component chunk owns the complete required view.
import { TripView } from '../components/TripView';

/**
 * A trip an outside assistant planned and sent through MCP, WebMCP, the API or
 * the paste page. Anyone with the link can explore it like an example trip;
 * saving needs a signed-in account and copies it into the traveller's trips.
 */
export const TripDraftLoaderRoute: React.FC<ExampleTripLoaderRouteProps & { data: TripDraftRouteData }> = ({ data, trip, onTripLoaded, onOpenManager, onOpenSettings, appLanguage, onViewSettingsChange }) => {
    const { t } = useTranslation('common');
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { access, isAuthenticated, isAnonymous, isLoading } = useAuth();
    const { openLoginModal } = useLoginModal();
    // Local edits made while exploring are kept on save; a trip from another route never is.
    const activeTrip = trip?.id === data.trip.id ? trip : data.trip;
    const { draftId } = data;
    const [viewSettings, updateViewSettings] = useRouteViewSettings(data.view);
    const handleTripLimitReached = useTripCopyLimit('trip_draft');
    const [isSaving, setIsSaving] = useState(false);
    // State updates are async, so a double click (or a click during the login
    // resume) would pass a state check twice and create two trips.
    const savingRef = useRef(false);
    const resumeAttemptedRef = useRef(false);

    useEffect(() => {
        trackEvent('trip_draft__open', { status: data.status, client: data.clientName ?? 'unknown' });
    }, [draftId, data.status, data.clientName]);

    const saveDraft = useCallback(async (trigger: 'banner' | 'resume') => {
        if (savingRef.current) return;
        if (!isAuthenticated || isAnonymous) {
            trackEvent('trip_draft__claim--login_required', { trigger });
            openLoginModal({ nextPath: `/draft/${draftId}?claim=1`, source: 'trip_draft' });
            return;
        }
        savingRef.current = true;
        setIsSaving(true);
        let savedTripId: string | null = null;
        try {
            // A failed lookup throws rather than reading as "not saved yet", which would duplicate.
            const existingTripId = await findMyTripDraftClaim(draftId);
            if (existingTripId) {
                trackEvent('trip_draft__claim--existing', { trigger });
                navigate(buildTripUrl(existingTripId));
                return;
            }
            if (DB_ENABLED) {
                const limit = await dbCanCreateTrip();
                if (!limit.allowCreate) {
                    await handleTripLimitReached(limit);
                    return;
                }
            }
            const saved = buildTripFromDraft({ draftId, trip: activeTrip }, { tripExpirationDays: access?.entitlements.tripExpirationDays });
            if (DB_ENABLED) {
                const storedId = await dbUpsertTrip(saved, viewSettings);
                if (!storedId) throw new Error('trip_not_stored');
            }
            // The trip is the traveller's from here on; the steps below must not turn it into a "failed" save.
            savedTripId = saved.id;
            saveTrip(saved);
            if (DB_ENABLED) {
                await dbCreateTripVersion(saved, viewSettings, 'Data: Saved AI assistant draft').catch(() => null);
                const claim = await recordTripDraftClaim(draftId, saved.id);
                if (claim.code !== 'claimed' && claim.code !== 'already_claimed') {
                    trackEvent('trip_draft__claim--record_failed', { code: claim.code });
                }
            }
            trackEvent('trip_draft__claim--success', { trigger, client: data.clientName ?? 'unknown' });
            navigate(buildTripUrl(saved.id));
        } catch {
            if (savedTripId) {
                navigate(buildTripUrl(savedTripId));
            } else {
                showAppToast({ tone: 'error', title: t('tripView.draftBanner.saveFailedTitle'), description: t('tripView.draftBanner.saveFailedBody') });
            }
        } finally {
            savingRef.current = false;
            setIsSaving(false);
        }
    }, [access?.entitlements.tripExpirationDays, activeTrip, data.clientName, draftId, handleTripLimitReached, isAnonymous, isAuthenticated, navigate, openLoginModal, t, viewSettings]);

    // Coming back from the login modal with ?claim=1 finishes the save the
    // traveller started, once the session is a real account.
    const shouldResumeSave = searchParams.get('claim') === '1';
    useEffect(() => {
        if (!shouldResumeSave || resumeAttemptedRef.current || isLoading || !isAuthenticated || isAnonymous) return;
        resumeAttemptedRef.current = true;
        // Drop the flag first so a reload or Back after a failed save does not start it again.
        navigate(`/draft/${draftId}`, { replace: true });
        void saveDraft('resume');
    }, [draftId, isAnonymous, isAuthenticated, isLoading, navigate, saveDraft, shouldResumeSave]);

    const handleSaveClick = () => {
        trackEvent('trip_draft__banner--save', { status: data.status });
        void saveDraft('banner');
    };

    const handleRouteViewSettingsChange = useCallback((settings: IViewSettings) => {
        if (updateViewSettings(settings)) onViewSettingsChange(settings);
    }, [onViewSettingsChange, updateViewSettings]);

    const clientLabel = data.clientName?.trim();
    return (
        <TripView
            trip={activeTrip}
            initialViewSettings={viewSettings ?? activeTrip.defaultView}
            onUpdateTrip={(updatedTrip) => onTripLoaded(updatedTrip, viewSettings ?? updatedTrip.defaultView)}
            onViewSettingsChange={handleRouteViewSettingsChange}
            onOpenManager={onOpenManager}
            onOpenSettings={onOpenSettings}
            appLanguage={appLanguage}
            canShare={false}
            onCopyTrip={handleSaveClick}
            isExamplePreview
            suppressToasts
            suppressReleaseNotice
            exampleTripBanner={{
                title: activeTrip.title,
                countries: [],
                isPrimaryBusy: isSaving,
                copy: {
                    eyebrow: clientLabel
                        ? t('tripView.draftBanner.eyebrowFrom', { client: clientLabel })
                        : t('tripView.draftBanner.eyebrow'),
                    title: t('tripView.draftBanner.title'),
                    body: t('tripView.draftBanner.body'),
                    primaryLabel: t('tripView.draftBanner.save'),
                    dismissLabel: t('tripView.draftBanner.dismiss'),
                },
            }}
        />
    );
};
