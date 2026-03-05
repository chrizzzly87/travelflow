import { PLAN_CATALOG } from '../../config/planCatalog';
import type { AdminUserRecord } from '../../services/adminService';
import type { PlanTierKey } from '../../types';

export type AdminDashboardUserLevelKey = 'admin' | PlanTierKey;

export interface AdminDashboardUserLevelBreakdownItem {
    key: AdminDashboardUserLevelKey;
    label: string;
    count: number;
    shareOfTotal: number;
    shareLabel: string;
    tooltip: string;
}

const INTEGER_FORMATTER = new Intl.NumberFormat();
const SHARE_FORMATTER = new Intl.NumberFormat(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });

const USER_LEVEL_ORDER: AdminDashboardUserLevelKey[] = [
    'admin',
    'tier_premium',
    'tier_mid',
    'tier_free',
];

const USER_LEVEL_LABELS: Record<AdminDashboardUserLevelKey, string> = {
    admin: 'Admin',
    tier_premium: PLAN_CATALOG.tier_premium.publicName,
    tier_mid: PLAN_CATALOG.tier_mid.publicName,
    tier_free: PLAN_CATALOG.tier_free.publicName,
};

export const resolveAdminDashboardUserLevelKey = (user: AdminUserRecord): AdminDashboardUserLevelKey => {
    if (user.system_role === 'admin') return 'admin';
    return user.tier_key;
};

const buildInitialCounts = (): Record<AdminDashboardUserLevelKey, number> => ({
    admin: 0,
    tier_premium: 0,
    tier_mid: 0,
    tier_free: 0,
});

export const buildAdminDashboardUserLevelBreakdown = (
    users: AdminUserRecord[]
): AdminDashboardUserLevelBreakdownItem[] => {
    const counts = buildInitialCounts();
    users.forEach((user) => {
        const levelKey = resolveAdminDashboardUserLevelKey(user);
        counts[levelKey] += 1;
    });

    const totalUsers = users.length;
    return USER_LEVEL_ORDER.map((key) => {
        const count = counts[key];
        const shareOfTotal = totalUsers > 0 ? count / totalUsers : 0;
        const shareLabel = `${SHARE_FORMATTER.format(shareOfTotal * 100)}%`;
        const tooltip = `${USER_LEVEL_LABELS[key]}: ${INTEGER_FORMATTER.format(count)} of ${INTEGER_FORMATTER.format(totalUsers)} total users (${shareLabel})`;
        return {
            key,
            label: USER_LEVEL_LABELS[key],
            count,
            shareOfTotal,
            shareLabel,
            tooltip,
        };
    });
};
