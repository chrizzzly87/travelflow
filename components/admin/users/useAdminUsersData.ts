import { useCallback, useEffect, useState } from 'react';
import {
    adminGetUserProfile,
    adminListUsers,
    type AdminUserRecord,
} from '../../../services/adminService';
import { toAdminErrorMessage } from '../../../services/adminErrorMessages';
import { readAdminCache, writeAdminCache } from '../adminLocalCache';
import { USERS_CACHE_KEY } from '../adminUsersModel';

export const toAdminUsersErrorMessage = (error: unknown, fallback: string): string => (
    toAdminErrorMessage(error, fallback, 'admin-users')
);

const cachedUsersNotice = (count: number): string => (
    `Showing ${count} cached user${count === 1 ? '' : 's'} from this browser because the live list could not load.`
);

/**
 * Loads the user list, falling back to this browser's cache when the live
 * list fails. Also owns the screen's error and data-source notices.
 */
export const useAdminUsersData = () => {
    const [users, setUsers] = useState<AdminUserRecord[]>(() => readAdminCache<AdminUserRecord[]>(USERS_CACHE_KEY, []));
    const [isLoadingUsers, setIsLoadingUsers] = useState(() => users.length === 0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [dataSourceNotice, setDataSourceNotice] = useState<string | null>(null);
    const [missingLinkedUserId, setMissingLinkedUserId] = useState<string | null>(null);

    const loadUsers = useCallback(async (options: { preserveErrorMessage?: boolean } = {}) => {
        setIsLoadingUsers(true);
        setDataSourceNotice(null);
        if (!options.preserveErrorMessage) {
            setErrorMessage(null);
        }
        try {
            const rows = await adminListUsers({ limit: 500 });
            setUsers(rows);
            writeAdminCache(USERS_CACHE_KEY, rows);
        } catch (error) {
            const reason = toAdminUsersErrorMessage(error, 'Could not load users.');
            if (!options.preserveErrorMessage) {
                setErrorMessage(reason);
            }
            const cachedRows = readAdminCache<AdminUserRecord[]>(USERS_CACHE_KEY, []);
            if (cachedRows.length > 0) {
                setUsers(cachedRows);
                setDataSourceNotice(cachedUsersNotice(cachedRows.length));
            } else {
                setUsers([]);
            }
        } finally {
            setIsLoadingUsers(false);
        }
    }, []);

    // Initial fetch of the user list.
    useEffect(() => {
        void loadUsers();
    }, [loadUsers]);

    /** Adds or refreshes one account in the list (and the cache) without a full reload. */
    const upsertUser = useCallback((profile: AdminUserRecord) => {
        setUsers((current) => {
            const exists = current.some((candidate) => candidate.user_id === profile.user_id);
            const nextUsers = exists
                ? current.map((candidate) => (candidate.user_id === profile.user_id ? { ...candidate, ...profile } : candidate))
                : [profile, ...current];
            writeAdminCache(USERS_CACHE_KEY, nextUsers);
            return nextUsers;
        });
    }, []);

    return {
        users,
        isLoadingUsers,
        errorMessage,
        setErrorMessage,
        dataSourceNotice,
        missingLinkedUserId,
        setMissingLinkedUserId,
        loadUsers,
        upsertUser,
    };
};

export type AdminUsersDataApi = ReturnType<typeof useAdminUsersData>;

/**
 * A deep link can point at an account outside the loaded list (older than the
 * 500 newest, or just created). Fetch it so the sheet can show it, and remember
 * when it does not exist so the sheet can say so.
 */
export const useDeepLinkedUserProfile = (data: AdminUsersDataApi, deepLinkedUserId: string | null) => {
    const { users, upsertUser, setMissingLinkedUserId, setErrorMessage } = data;
    useEffect(() => {
        if (!deepLinkedUserId) return undefined;
        if (users.some((user) => user.user_id === deepLinkedUserId)) return undefined;

        let active = true;
        void adminGetUserProfile(deepLinkedUserId)
            .then((profile) => {
                if (!active) return;
                if (!profile) {
                    setMissingLinkedUserId(deepLinkedUserId);
                    return;
                }
                upsertUser(profile);
            })
            .catch((error) => {
                if (!active) return;
                setErrorMessage(toAdminUsersErrorMessage(error, 'Could not load the linked user.'));
            });

        return () => {
            active = false;
        };
    }, [deepLinkedUserId, setErrorMessage, setMissingLinkedUserId, upsertUser, users]);
};
