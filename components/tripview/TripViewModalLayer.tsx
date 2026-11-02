import React, { Suspense, useRef } from 'react';

import type { ITrip, ShareMode, TripGenerationAttemptSummary, TripGenerationState } from '../../types';
import type { TripPaywallActivationMode } from '../../config/paywall';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { lazyWithRecovery } from './lazyWithRecovery';
import { TripViewHudOverlays } from './TripViewHudOverlays';
import type { TripTravelerWarningSummary } from './tripViewModel';

// Each modal stays behind its own React.lazy boundary, so none of them joins
// the TripView chunk. The module keys match the ones TripView used before the
// split, so lazy-import recovery keeps working across a deploy.

const ReleaseNoticeDialog = lazyWithRecovery('ReleaseNoticeDialog', () =>
    import('../ReleaseNoticeDialog').then((module) => ({ default: module.ReleaseNoticeDialog }))
);

const AddActivityModal = lazyWithRecovery('AddActivityModal', () =>
    import('../AddActivityModal').then((module) => ({ default: module.AddActivityModal }))
);

const AddCityModal = lazyWithRecovery('AddCityModal', () =>
    import('../AddCityModal').then((module) => ({ default: module.AddCityModal }))
);

const TripShareModal = lazyWithRecovery('TripShareModal', () =>
    import('../TripShareModal').then((module) => ({ default: module.TripShareModal }))
);

const TripHistoryModal = lazyWithRecovery('TripHistoryModal', () =>
    import('../TripHistoryModal').then((module) => ({ default: module.TripHistoryModal }))
);

let tripInfoModalModulePromise: Promise<{ default: React.ComponentType<any> }> | null = null;

export const loadTripInfoModalModule = (): Promise<{ default: React.ComponentType<any> }> => {
    if (!tripInfoModalModulePromise) {
        tripInfoModalModulePromise = import('../TripInfoModal').then((module) => ({ default: module.TripInfoModal }));
    }
    return tripInfoModalModulePromise;
};

const TripInfoModal = lazyWithRecovery('TripInfoModal', () => loadTripInfoModalModule());

const TRIP_INFO_FALLBACK_ROWS = [0, 1, 2];

const TripInfoModalLoadingFallback: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);

    useFocusTrap({
        isActive: true,
        containerRef: dialogRef,
        initialFocusRef: closeButtonRef,
    });

    return (
        <>
            <button
                type="button"
                className="fixed inset-0 z-[1520] bg-black/40 backdrop-blur-sm"
                onClick={onClose}
                aria-label="Close"
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="trip-info-loading-title"
                className="fixed inset-0 z-[1521] pointer-events-none flex items-end sm:items-center justify-center p-3 sm:p-4"
            >
                <div ref={dialogRef} className="pointer-events-auto bg-card rounded-t-2xl rounded-b-none sm:rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[84vh] sm:max-h-[88vh] dark:shadow-none">
                    <div className="p-4 border-b border-border flex items-center justify-between">
                        <div>
                            <h3 id="trip-info-loading-title" className="text-lg font-semibold text-foreground">Trip information</h3>
                            <p className="text-xs text-muted-foreground">Plan details, destination info, and history.</p>
                        </div>
                        <button ref={closeButtonRef} type="button" onClick={onClose} className="px-2 py-1 rounded text-xs font-semibold text-muted-foreground hover:bg-secondary">
                            Close
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        <div className="rounded-xl border border-border p-3 space-y-2 animate-pulse">
                            <div className="h-5 w-44 rounded bg-gray-200" />
                            <div className="h-3 w-64 rounded bg-secondary" />
                        </div>
                        <div className="rounded-xl border border-border p-3 space-y-3 animate-pulse">
                            <div className="h-4 w-28 rounded bg-gray-200" />
                            <div className="grid grid-cols-2 gap-2">
                                {TRIP_INFO_FALLBACK_ROWS.map((row) => (
                                    <div key={`trip-info-fallback-${row}`} className="h-14 rounded-lg bg-secondary border border-border" />
                                ))}
                            </div>
                        </div>
                        <div className="rounded-xl border border-border p-3 space-y-2 animate-pulse">
                            <div className="h-4 w-20 rounded bg-gray-200" />
                            <div className="h-10 rounded bg-secondary border border-border" />
                            <div className="h-10 rounded bg-secondary border border-border" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export interface TripViewModalLayerProps {
    addActivityState: { isOpen: boolean; dayOffset: number; location: string };
    onCloseAddActivity: () => void;
    onAddActivity: (...args: any[]) => void;
    trip: ITrip;
    isAddCityModalOpen: boolean;
    onCloseAddCityModal: () => void;
    onAddCity: (name: string, lat: number, lng: number) => void;
    isTripInfoOpen: boolean;
    onCloseTripInfo: () => void;
    tripTitle: string;
    isEditingTitle: boolean;
    editTitleValue: string;
    onEditTitleValueChange: (value: string) => void;
    onCommitTitleEdit: () => void;
    onCancelTitleEdit: () => void;
    onStartTitleEdit: () => void;
    canManageTripMetadata: boolean;
    canEdit: boolean;
    isFavorite: boolean;
    onToggleFavorite: () => void;
    isExamplePreview: boolean;
    tripMeta: any;
    ownerSummary: string | null;
    ownerHint: string | null;
    adminMeta: {
        ownerUserId: string | null;
        ownerUsername: string | null;
        ownerEmail: string | null;
        accessSource: string | null;
    } | null;
    aiMeta: ITrip['aiMeta'];
    generationState: TripGenerationState;
    latestGenerationAttempt: TripGenerationAttemptSummary | null;
    canRetryGeneration: boolean;
    retryDisabledReason: string | null;
    isRetryingGeneration: boolean;
    retryModelId: string | null;
    onRetryModelIdChange: (modelId: string) => void;
    onRetryGeneration: (source: 'trip_info' | 'trip_strip', modelId?: string | null) => void;
    onOpenBenchmarkWithSnapshot: () => void;
    canOpenBenchmarkWithSnapshot: boolean;
    tripInfoRetryAnalyticsAttributes: Record<string, string>;
    forkMeta: { label: string; url: string | null } | null;
    showAllHistory: boolean;
    onToggleShowAllHistory: () => void;
    onHistoryUndo: () => void;
    onHistoryRedo: () => void;
    historyModalItems: any[];
    onGoToHistoryEntry: (item: any) => void;
    formatHistoryTime: (value: number) => string;
    pendingSyncCount: number;
    failedSyncCount: number;
    countryInfo: ITrip['countryInfo'];
    isPaywallLocked: boolean;
    travelerWarnings: TripTravelerWarningSummary[];
    onExportActivitiesCalendar: () => void;
    onExportCitiesCalendar: () => void;
    onExportAllCalendar: () => void;
    onOpenPrintLayout: () => void;
    tripInfoMyMapsPanel?: React.ReactNode;
    shouldEnableReleaseNotice: boolean;
    isShareOpen: boolean;
    shareMode: ShareMode;
    onShareModeChange: (mode: ShareMode) => void;
    activeShareUrl: string | null;
    onCloseShare: () => void;
    onCopyShareLink: () => void;
    onGenerateShare: () => void;
    isGeneratingShare: boolean;
    isHistoryOpen: boolean;
    onCloseHistory: () => void;
    onHistoryGo: (item: any) => void;
    shareStatus?: ShareMode;
    onCopyTrip?: () => void;
    /** Forwarded to TripViewHudOverlays so the view-only card clears the AI launcher. */
    isAgentLauncherVisible: boolean;
    expirationLabel: string | null;
    tripId: string;
    paywallActivationMode: TripPaywallActivationMode;
    onPaywallActivateClick: (
        event: React.MouseEvent<HTMLAnchorElement>,
        analyticsEvent: 'trip_paywall__strip--activate' | 'trip_paywall__overlay--activate',
        source: 'trip_paywall_strip' | 'trip_paywall_overlay'
    ) => void;
    paywallOverlayUpgradeCheckoutPath: string;
    showGenerationOverlay: boolean;
    generationProgressMessage: string;
    loadingDestinationSummary: string;
    tripDateRange: string;
    tripSpanCompactLabel: string;
    pendingAuthModalStage: 'hidden' | 'loading' | 'locked';
    onContinuePendingAuth: () => void;
    isPendingAuthContinueDisabled: boolean;
    claimConflictModalVisible: boolean;
    claimConflictShowLoginCta: boolean;
    claimConflictTrip?: Pick<ITrip, 'title' | 'aiMeta'>;
    claimConflictPathname?: string;
    onClaimConflictLogin: () => void;
}

export const TripViewModalLayer: React.FC<TripViewModalLayerProps> = ({
    addActivityState,
    onCloseAddActivity,
    onAddActivity,
    trip,
    isAddCityModalOpen,
    onCloseAddCityModal,
    onAddCity,
    isTripInfoOpen,
    onCloseTripInfo,
    tripTitle,
    isEditingTitle,
    editTitleValue,
    onEditTitleValueChange,
    onCommitTitleEdit,
    onCancelTitleEdit,
    onStartTitleEdit,
    canManageTripMetadata,
    canEdit,
    isFavorite,
    onToggleFavorite,
    isExamplePreview,
    tripMeta,
    ownerSummary,
    ownerHint,
    adminMeta,
    aiMeta,
    generationState,
    latestGenerationAttempt,
    canRetryGeneration,
    retryDisabledReason,
    isRetryingGeneration,
    retryModelId,
    onRetryModelIdChange,
    onRetryGeneration,
    onOpenBenchmarkWithSnapshot,
    canOpenBenchmarkWithSnapshot,
    tripInfoRetryAnalyticsAttributes,
    forkMeta,
    showAllHistory,
    onToggleShowAllHistory,
    onHistoryUndo,
    onHistoryRedo,
    historyModalItems,
    onGoToHistoryEntry,
    formatHistoryTime,
    pendingSyncCount,
    failedSyncCount,
    countryInfo,
    isPaywallLocked,
    travelerWarnings,
    onExportActivitiesCalendar,
    onExportCitiesCalendar,
    onExportAllCalendar,
    onOpenPrintLayout,
    tripInfoMyMapsPanel,
    shouldEnableReleaseNotice,
    isShareOpen,
    shareMode,
    onShareModeChange,
    activeShareUrl,
    onCloseShare,
    onCopyShareLink,
    onGenerateShare,
    isGeneratingShare,
    isHistoryOpen,
    onCloseHistory,
    onHistoryGo,
    shareStatus,
    onCopyTrip,
    isAgentLauncherVisible,
    expirationLabel,
    tripId,
    paywallActivationMode,
    onPaywallActivateClick,
    paywallOverlayUpgradeCheckoutPath,
    showGenerationOverlay,
    generationProgressMessage,
    loadingDestinationSummary,
    tripDateRange,
    tripSpanCompactLabel,
    pendingAuthModalStage,
    onContinuePendingAuth,
    isPendingAuthContinueDisabled,
    claimConflictModalVisible,
    claimConflictShowLoginCta,
    claimConflictTrip,
    claimConflictPathname,
    onClaimConflictLogin,
}) => (
    <>
        {addActivityState.isOpen && (
            <Suspense fallback={null}>
                <AddActivityModal
                    isOpen={addActivityState.isOpen}
                    onClose={onCloseAddActivity}
                    dayOffset={addActivityState.dayOffset}
                    location={addActivityState.location}
                    onAdd={onAddActivity}
                    trip={trip}
                    notes=""
                />
            </Suspense>
        )}
        {isAddCityModalOpen && (
            <Suspense fallback={null}>
                <AddCityModal isOpen={isAddCityModalOpen} onClose={onCloseAddCityModal} onAdd={onAddCity} />
            </Suspense>
        )}
        {isTripInfoOpen && (
            <Suspense fallback={<TripInfoModalLoadingFallback onClose={onCloseTripInfo} />}>
                <TripInfoModal
                    isOpen={isTripInfoOpen}
                    onClose={onCloseTripInfo}
                    tripTitle={tripTitle}
                    isEditingTitle={isEditingTitle}
                    editTitleValue={editTitleValue}
                    onEditTitleValueChange={onEditTitleValueChange}
                    onCommitTitleEdit={onCommitTitleEdit}
                    onCancelTitleEdit={onCancelTitleEdit}
                    onStartTitleEdit={onStartTitleEdit}
                    canManageTripMetadata={canManageTripMetadata}
                    canEdit={canEdit}
                    isFavorite={isFavorite}
                    onToggleFavorite={onToggleFavorite}
                    isExamplePreview={isExamplePreview}
                    tripMeta={tripMeta}
                    ownerSummary={ownerSummary}
                    ownerHint={ownerHint}
                    adminMeta={adminMeta}
                    aiMeta={aiMeta}
                    generationState={generationState}
                    latestGenerationAttempt={latestGenerationAttempt}
                    canRetryGeneration={canRetryGeneration}
                    retryDisabledReason={retryDisabledReason}
                    isRetryingGeneration={isRetryingGeneration}
                    retryModelId={retryModelId}
                    onRetryModelIdChange={onRetryModelIdChange}
                    onRetryGeneration={(modelId) => onRetryGeneration('trip_info', modelId)}
                    onOpenBenchmarkWithSnapshot={onOpenBenchmarkWithSnapshot}
                    canOpenBenchmarkWithSnapshot={canOpenBenchmarkWithSnapshot}
                    retryAnalyticsAttributes={tripInfoRetryAnalyticsAttributes}
                    forkMeta={forkMeta}
                    showAllHistory={showAllHistory}
                    onToggleShowAllHistory={onToggleShowAllHistory}
                    onHistoryUndo={onHistoryUndo}
                    onHistoryRedo={onHistoryRedo}
                    historyItems={historyModalItems}
                    onGoToHistoryEntry={onGoToHistoryEntry}
                    formatHistoryTime={formatHistoryTime}
                    pendingSyncCount={pendingSyncCount}
                    failedSyncCount={failedSyncCount}
                    countryInfo={countryInfo}
                    isPaywallLocked={isPaywallLocked}
                    travelerWarnings={travelerWarnings}
                    onExportActivitiesCalendar={onExportActivitiesCalendar}
                    onExportCitiesCalendar={onExportCitiesCalendar}
                    onExportAllCalendar={onExportAllCalendar}
                    onOpenPrintLayout={onOpenPrintLayout}
                    myMapsPanel={tripInfoMyMapsPanel}
                />
            </Suspense>
        )}
        {shouldEnableReleaseNotice && (
            <Suspense fallback={null}>
                <ReleaseNoticeDialog enabled={shouldEnableReleaseNotice} />
            </Suspense>
        )}
        {isShareOpen && (
            <Suspense fallback={null}>
                <TripShareModal
                    isOpen={isShareOpen}
                    shareMode={shareMode}
                    onShareModeChange={onShareModeChange}
                    activeShareUrl={activeShareUrl}
                    onClose={onCloseShare}
                    onCopyShareLink={onCopyShareLink}
                    onGenerateShare={onGenerateShare}
                    isGeneratingShare={isGeneratingShare}
                />
            </Suspense>
        )}
        {isHistoryOpen && (
            <Suspense fallback={null}>
                <TripHistoryModal
                    isOpen={isHistoryOpen}
                    isExamplePreview={isExamplePreview}
                    showAllHistory={showAllHistory}
                    items={historyModalItems}
                    pendingSyncCount={pendingSyncCount}
                    failedSyncCount={failedSyncCount}
                    onClose={onCloseHistory}
                    onUndo={onHistoryUndo}
                    onRedo={onHistoryRedo}
                    onToggleShowAllHistory={onToggleShowAllHistory}
                    onGo={onHistoryGo}
                    formatHistoryTime={formatHistoryTime}
                />
            </Suspense>
        )}
        <TripViewHudOverlays
            shareStatus={shareStatus}
            onCopyTrip={onCopyTrip}
            isAgentLauncherVisible={isAgentLauncherVisible}
            isPaywallLocked={isPaywallLocked}
            expirationLabel={expirationLabel}
            tripId={tripId}
            paywallActivationMode={paywallActivationMode}
            onPaywallActivateClick={onPaywallActivateClick}
            paywallOverlayUpgradeCheckoutPath={paywallOverlayUpgradeCheckoutPath}
            showGenerationOverlay={showGenerationOverlay}
            generationProgressMessage={generationProgressMessage}
            loadingDestinationSummary={loadingDestinationSummary}
            tripDateRange={tripDateRange}
            tripSpanCompactLabel={tripSpanCompactLabel}
            pendingAuthModalStage={pendingAuthModalStage}
            onContinuePendingAuth={onContinuePendingAuth}
            isPendingAuthContinueDisabled={isPendingAuthContinueDisabled}
            claimConflictModalVisible={claimConflictModalVisible}
            claimConflictShowLoginCta={claimConflictShowLoginCta}
            claimConflictTrip={claimConflictTrip}
            claimConflictPathname={claimConflictPathname}
            onClaimConflictLogin={onClaimConflictLogin}
        />
    </>
);
