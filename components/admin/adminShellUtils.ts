import {
    readLocalStorageItem,
    readSessionStorageItem,
    writeLocalStorageItem,
} from '../../services/browserStorageService';

export type AdminDateRange = '7d' | '30d' | '90d' | 'all';

const SIDEBAR_COLLAPSE_PERSIST_KEY = 'tf_admin_sidebar_collapsed_v1';
const DEV_ADMIN_BYPASS_DISABLED_SESSION_KEY = 'tf_dev_admin_bypass_disabled';

export const getStoredSidebarCollapseState = (): boolean => {
    return readLocalStorageItem(SIDEBAR_COLLAPSE_PERSIST_KEY) === '1';
};

export const persistSidebarCollapseState = (next: boolean): void => {
    writeLocalStorageItem(SIDEBAR_COLLAPSE_PERSIST_KEY, next ? '1' : '0');
};

export const isDevAdminBypassDisabled = (): boolean => {
    return readSessionStorageItem(DEV_ADMIN_BYPASS_DISABLED_SESSION_KEY) === '1';
};
