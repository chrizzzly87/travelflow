import { useEffect, useMemo, useState } from 'react';
import {
    adminGetUserProfile,
    adminListUserChangeLogs,
    adminListUserTrips,
    type AdminTripRecord,
    type AdminUserChangeRecord,
    type AdminUserRecord,
} from '../../../services/adminService';
import {
    buildUserChangeDiffEntries,
    resolveUserChangeActionPresentation,
    resolveUserChangeSecondaryFacets,
} from '../../../services/adminUserChangeLog';
import type { PlanTierKey } from '../../../types';
import {
    EMPTY_USER_PROFILE_DRAFT,
    USER_CHANGE_LOG_DRAWER_LIMIT,
    formatOverrideDraft,
    getUserActiveTrips,
    getUserTotalTrips,
    toUserProfileDraft,
    type UserProfileDraft,
} from '../adminUsersModel';
import { toAdminUsersErrorMessage } from './useAdminUsersData';

/** What the sheet's form fields hold until "Save changes". */
export interface AdminUserDraft {
    tier: PlanTierKey;
    overrides: string;
    profile: UserProfileDraft;
}

const toUserDraft = (user: AdminUserRecord): AdminUserDraft => ({
    tier: user.tier_key,
    overrides: formatOverrideDraft(user.entitlements_override),
    profile: toUserProfileDraft(user),
});

const EMPTY_DRAFT: AdminUserDraft = { tier: 'tier_free', overrides: '', profile: EMPTY_USER_PROFILE_DRAFT };

/**
 * Everything the user sheet loads for one account: the full profile (which
 * seeds the edit form), its owned trips and its latest change log entries.
 * It reloads whenever the account record changes, for example after a save.
 */
export const useAdminUserDetail = (
    selectedUser: AdminUserRecord | null,
    setErrorMessage: (message: string | null) => void
) => {
    const [draft, setDraft] = useState<AdminUserDraft>(EMPTY_DRAFT);
    const [userTrips, setUserTrips] = useState<AdminTripRecord[]>([]);
    const [isLoadingTrips, setIsLoadingTrips] = useState(false);
    const [userChangeLogs, setUserChangeLogs] = useState<AdminUserChangeRecord[]>([]);
    const [isLoadingChangeLogs, setIsLoadingChangeLogs] = useState(false);
    const [changeLogsError, setChangeLogsError] = useState<string | null>(null);

    // Loads the full profile, trips and change log for the account in the inspector.
    useEffect(() => {
        if (!selectedUser) return undefined;
        let active = true;

        setDraft(toUserDraft(selectedUser));

        void adminGetUserProfile(selectedUser.user_id)
            .then((fullProfile) => {
                if (!active || !fullProfile) return;
                setDraft(toUserDraft(fullProfile));
            })
            .catch((error) => {
                if (!active) return;
                setErrorMessage(toAdminUsersErrorMessage(error, 'Could not load the full user profile.'));
            });

        setUserTrips([]);
        setIsLoadingTrips(true);
        setUserChangeLogs([]);
        setIsLoadingChangeLogs(true);
        setChangeLogsError(null);
        void adminListUserTrips(selectedUser.user_id)
            .then((rows) => {
                if (!active) return;
                setUserTrips(rows);
            })
            .catch((error) => {
                if (!active) return;
                setErrorMessage(toAdminUsersErrorMessage(error, 'Could not load user trips.'));
            })
            .finally(() => {
                if (!active) return;
                setIsLoadingTrips(false);
            });

        void adminListUserChangeLogs({ ownerUserId: selectedUser.user_id, limit: USER_CHANGE_LOG_DRAWER_LIMIT })
            .then((rows) => {
                if (!active) return;
                setUserChangeLogs(rows);
            })
            .catch((error) => {
                if (!active) return;
                setChangeLogsError(toAdminUsersErrorMessage(error, 'Could not load the change log.'));
            })
            .finally(() => {
                if (!active) return;
                setIsLoadingChangeLogs(false);
            });

        return () => {
            active = false;
        };
    }, [selectedUser, setErrorMessage]);

    // While trips load, the list row's counters stand in for the real numbers.
    const tripStats = useMemo(() => {
        if (isLoadingTrips) {
            return {
                total: selectedUser ? getUserTotalTrips(selectedUser) : 0,
                active: selectedUser ? getUserActiveTrips(selectedUser) : 0,
            };
        }
        return {
            total: userTrips.length,
            active: userTrips.filter((trip) => trip.status === 'active').length,
        };
    }, [isLoadingTrips, selectedUser, userTrips]);

    const changeEntries = useMemo(() => userChangeLogs.map((log) => {
        const diffEntries = buildUserChangeDiffEntries(log);
        const visibleDiffEntries = diffEntries.slice(0, 4);
        return {
            log,
            actionPresentation: resolveUserChangeActionPresentation(log, diffEntries),
            secondaryFacets: resolveUserChangeSecondaryFacets(log),
            visibleDiffEntries,
            hiddenDiffCount: Math.max(0, diffEntries.length - visibleDiffEntries.length),
        };
    }), [userChangeLogs]);

    const updateProfileDraft = (patch: Partial<UserProfileDraft>) => {
        setDraft((current) => ({ ...current, profile: { ...current.profile, ...patch } }));
    };

    return {
        draft,
        setTierDraft: (tier: PlanTierKey) => setDraft((current) => ({ ...current, tier })),
        setOverrideDraft: (overrides: string) => setDraft((current) => ({ ...current, overrides })),
        updateProfileDraft,
        userTrips,
        setUserTrips,
        isLoadingTrips,
        tripStats,
        changeEntries,
        isLoadingChangeLogs,
        changeLogsError,
    };
};

export type AdminUserDetailApi = ReturnType<typeof useAdminUserDetail>;
export type AdminUserChangeEntry = AdminUserDetailApi['changeEntries'][number];
