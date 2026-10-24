import React from 'react';
import { loadLazyComponentWithRecovery } from '../../services/lazyImportRecovery';
import type { TripClaimConflictDialogProps } from './TripClaimConflictDialog';

type RecoveryModule = typeof import('./TripClaimConflictDialog');
let pendingRecovery: Promise<RecoveryModule> | undefined;
let resolvedRecovery: RecoveryModule | undefined;

const loadRecovery = (): Promise<RecoveryModule> => {
    if (resolvedRecovery) return Promise.resolve(resolvedRecovery);
    if (!pendingRecovery) {
        pendingRecovery = loadLazyComponentWithRecovery('TripClaimConflictDialog', () => import('./TripClaimConflictDialog'))
            .then((module) => {
                resolvedRecovery = module;
                return module;
            }, (error: unknown) => {
                pendingRecovery = undefined;
                throw error;
            });
    }
    return pendingRecovery;
};

/** Native trip beforeLoad calls this only for an actual claim conflict. */
export const preloadTripClaimConflictDialog = async (): Promise<void> => {
    await loadRecovery();
};

const LazyRecovery = React.lazy(async () => {
    const module = await loadRecovery();
    return { default: module.TripClaimConflictDialog };
});

/** Ordinary trip viewing never loads destination normalization or recovery UI. */
export const TripClaimRecoveryBoundary: React.FC<TripClaimConflictDialogProps> = (props) => (
    resolvedRecovery
        ? React.createElement(resolvedRecovery.TripClaimConflictDialog, props)
        : React.createElement(React.Suspense, { fallback: null }, React.createElement(LazyRecovery, props))
);
