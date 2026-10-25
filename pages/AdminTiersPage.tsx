import React, { useEffect, useState } from 'react';
import { toAdminErrorMessage } from '../services/adminErrorMessages';
import { ArrowsClockwise, Info, SpinnerGap } from '@phosphor-icons/react';
import { PLAN_CATALOG, PLAN_ORDER } from '../config/planCatalog';
import type { PlanTierKey } from '../types';
import { AdminShell } from '../components/admin/AdminShell';
import {
    adminPreviewTierReapply,
    adminReapplyTierToUsers,
    adminUpdatePlanEntitlements,
    type AdminTierReapplyPreview,
} from '../services/adminService';
import { useAppDialog } from '../components/AppDialogProvider';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { readAdminCache, writeAdminCache } from '../components/admin/adminLocalCache';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminStatusBadge } from '../components/admin/AdminStatusBadge';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import { Textarea } from '../components/ui/textarea';
import { showAppToast } from '../components/ui/appToast';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';

type DraftMap = Record<PlanTierKey, string>;
type PreviewMap = Record<PlanTierKey, AdminTierReapplyPreview | null>;

const TIERS_PREVIEW_CACHE_KEY = 'admin.tiers.preview.v1';

const buildInitialTierPreview = (): PreviewMap => ({
    tier_free: null,
    tier_mid: null,
    tier_premium: null,
});

const buildInitialDrafts = (): DraftMap => ({
    tier_free: JSON.stringify(PLAN_CATALOG.tier_free.entitlements, null, 2),
    tier_mid: JSON.stringify(PLAN_CATALOG.tier_mid.entitlements, null, 2),
    tier_premium: JSON.stringify(PLAN_CATALOG.tier_premium.entitlements, null, 2),
});

const LIMIT_FIELDS = [
    { key: 'maxActiveTrips', label: 'Max active trips' },
    { key: 'maxTotalTrips', label: 'Max total trips' },
    { key: 'tripExpirationDays', label: 'Trip expiration (days)' },
];

const PERMISSION_FIELDS = [
    { key: 'canShare', label: 'Can share trips' },
    { key: 'canCreateEditableShares', label: 'Can appoint co-editors' },
    { key: 'canViewProTrips', label: 'Can view premium content' },
    { key: 'canCreateProTrips', label: 'Can create premium trips' },
];

const formatCount = (value: number | null | undefined): string => (value ?? 0).toLocaleString();

const EntitlementCard: React.FC<{
    tierName: string;
    draft: string;
    onChange: (nextStr: string) => void;
}> = ({ tierName, draft, onChange }) => {
    let parsed: Record<string, any> = {};
    let isError = false;
    try {
        parsed = JSON.parse(draft) || {};
    } catch {
        isError = true;
    }

    const updateField = (field: string, value: any) => {
        const next = { ...parsed, [field]: value };
        onChange(JSON.stringify(next, null, 2));
    };

    const jsonEditor = (
        <Textarea
            aria-label={`${tierName} limits JSON editor`}
            aria-invalid={isError || undefined}
            value={draft}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[220px] font-mono text-xs"
        />
    );

    if (isError) {
        return (
            <div className="flex flex-col gap-2">
                <p className="text-xs text-red-700 dark:text-red-300">
                    The limits JSON is not valid. Fix it here to get the form back.
                </p>
                {jsonEditor}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {LIMIT_FIELDS.map((l) => (
                    <label key={l.key} className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-muted-foreground">{l.label}</span>
                        <Input
                            type="number"
                            min={0}
                            aria-label={l.label}
                            value={parsed[l.key] === null ? '' : parsed[l.key] ?? ''}
                            onChange={(e) => {
                                const val = e.target.value === '' ? null : Number(e.target.value);
                                updateField(l.key, val);
                            }}
                            placeholder="Unlimited"
                            className="h-8 tabular-nums"
                        />
                    </label>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {PERMISSION_FIELDS.map((p) => (
                    <label key={p.key} className="flex cursor-pointer items-center gap-2">
                        <Checkbox
                            aria-label={p.label}
                            checked={Boolean(parsed[p.key])}
                            onCheckedChange={(checked) => updateField(p.key, checked === true)}
                        />
                        <span className="text-sm text-foreground">{p.label}</span>
                    </label>
                ))}
            </div>

            <details className="group rounded-md border border-border bg-muted/40 px-3 py-2">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Edit as JSON</summary>
                <div className="mt-2">{jsonEditor}</div>
            </details>
        </div>
    );
};

export const AdminTiersPage: React.FC = () => {
    const { confirm: confirmDialog } = useAppDialog();
    const [tierDrafts, setTierDrafts] = useState<DraftMap>(buildInitialDrafts);
    const [savedDrafts, setSavedDrafts] = useState<DraftMap>(buildInitialDrafts);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState<PlanTierKey | null>(null);
    const [isReapplying, setIsReapplying] = useState<PlanTierKey | null>(null);
    const [isReloading, setIsReloading] = useState(false);
    const [tierPreview, setTierPreview] = useState<PreviewMap>(
        () => readAdminCache<PreviewMap>(TIERS_PREVIEW_CACHE_KEY, buildInitialTierPreview())
    );
    const [isLoadingPreview, setIsLoadingPreview] = useState<PlanTierKey | null>(null);

    const refreshTierSnapshot = async (tierKey: PlanTierKey) => {
        setIsLoadingPreview(tierKey);
        try {
            const preview = await adminPreviewTierReapply(tierKey);
            setTierPreview((current) => {
                const next = { ...current, [tierKey]: preview };
                writeAdminCache(TIERS_PREVIEW_CACHE_KEY, next);
                return next;
            });
        } finally {
            setIsLoadingPreview((current) => (current === tierKey ? null : current));
        }
    };

    const refreshAllTierSnapshots = async () => {
        setIsReloading(true);
        setErrorMessage(null);
        try {
            for (const tierKey of PLAN_ORDER) {
                // Sequential loading keeps DB pressure low and preserves predictable UI updates.
                // eslint-disable-next-line no-await-in-loop
                await refreshTierSnapshot(tierKey);
            }
        } catch (error) {
            setErrorMessage(toAdminErrorMessage(error, 'Could not load the reapply preview. Reload to try again.', 'admin-tiers'));
        } finally {
            setIsReloading(false);
        }
    };

    useEffect(() => {
        void refreshAllTierSnapshots();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const saveTier = async (tierKey: PlanTierKey) => {
        setErrorMessage(null);
        setIsSaving(tierKey);
        trackEvent('admin__tiers--save', { tier_key: tierKey });
        const tierName = PLAN_CATALOG[tierKey].publicName;
        try {
            const draft = tierDrafts[tierKey];
            const parsed = JSON.parse(draft);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                throw new Error('Tier entitlement payload must be a JSON object.');
            }
            await adminUpdatePlanEntitlements(tierKey, parsed as Record<string, unknown>);
            setSavedDrafts((current) => ({ ...current, [tierKey]: draft }));
            showAppToast({
                tone: 'success',
                title: `Saved ${tierName}`,
                description: 'Reapply it if existing trips should follow the new limits.',
            });
            await refreshTierSnapshot(tierKey);
        } catch (error) {
            setErrorMessage(
                error instanceof SyntaxError || (error instanceof Error && error.message.startsWith('Tier entitlement payload'))
                    ? `The ${tierName} limits are not a valid JSON object. Fix them and save again.`
                    : toAdminErrorMessage(error, `Could not save the ${tierName} template. Try again in a moment.`, 'admin-tiers')
            );
        } finally {
            setIsSaving(null);
        }
    };

    const reapplyTier = async (tierKey: PlanTierKey) => {
        const tierName = PLAN_CATALOG[tierKey].publicName;
        const preview = tierPreview[tierKey];
        const confirmed = await confirmDialog({
            title: `Reapply ${tierName} to existing customers?`,
            message: (
                <div className="flex flex-col gap-2">
                    <p>
                        This recalculates the expiry date of every trip owned by {tierName} customers from the saved template.
                        Trips past their new date become expired; archived trips stay archived. It cannot be undone from here.
                    </p>
                    {preview ? (
                        <ul className="list-disc ps-5 tabular-nums">
                            <li>{formatCount(preview.affected_users)} customers</li>
                            <li>
                                {formatCount(preview.affected_trips)} trips ({formatCount(preview.active_trips)} active,
                                {' '}{formatCount(preview.expired_trips)} expired, {formatCount(preview.archived_trips)} archived)
                            </li>
                            <li>{formatCount(preview.users_with_overrides)} customers with personal overrides keep them</li>
                        </ul>
                    ) : null}
                </div>
            ),
            confirmLabel: preview ? `Reapply to ${formatCount(preview.affected_users)} customers` : 'Reapply',
            cancelLabel: 'Cancel',
            tone: 'danger',
        });
        if (!confirmed) return;

        setErrorMessage(null);
        setIsReapplying(tierKey);
        trackEvent('admin__tiers--reapply', { tier_key: tierKey });
        try {
            const result = await adminReapplyTierToUsers(tierKey);
            showAppToast({
                tone: 'success',
                title: `Reapplied ${tierName}`,
                description: `${result.affected_users} users and ${result.affected_trips} trips updated.`,
            });
            await refreshTierSnapshot(tierKey);
        } catch (error) {
            setErrorMessage(toAdminErrorMessage(error, `Could not reapply ${tierName} to existing customers. Try again in a moment.`, 'admin-tiers'));
        } finally {
            setIsReapplying(null);
        }
    };

    const isBusy = isSaving !== null || isReapplying !== null;

    return (
        <AdminShell
            title="Plans"
            description="Edit what each plan includes, save it, then decide whether existing trips follow the change."
            showGlobalSearch={false}
            showDateRange={false}
            actions={(
                <AdminReloadButton
                    onClick={() => {
                        void refreshAllTierSnapshots();
                    }}
                    isLoading={isReloading}
                    label="Reload"
                />
            )}
        >
            <div className="flex flex-col gap-4">
                {errorMessage && <AdminErrorAlert message={errorMessage} />}

                <Alert>
                    <Info weight="fill" />
                    <AlertDescription>
                        The forms start from the built-in plan defaults. Saving replaces the stored template for that tier;
                        existing trips keep their expiry dates until you reapply.
                    </AlertDescription>
                </Alert>

                <section className="grid gap-4 xl:grid-cols-3" aria-label="Plan tiers">
                    {PLAN_ORDER.map((tierKey) => {
                        const preview = tierPreview[tierKey];
                        const plan = PLAN_CATALOG[tierKey];
                        const isDirty = tierDrafts[tierKey].trim() !== savedDrafts[tierKey].trim();
                        const reapplyCount = preview?.affected_users ?? 0;
                        return (
                            <AdminSurfaceCard key={`tier-${tierKey}`} className="flex flex-col gap-4" aria-label={`${plan.publicName} tier`}>
                                <AdminSectionHeader
                                    title={plan.publicName}
                                    description={<span className="font-mono text-xs">{tierKey}</span>}
                                    actions={(
                                        <>
                                            {isDirty ? <AdminStatusBadge tone="warning">Unsaved changes</AdminStatusBadge> : null}
                                            <AdminStatusBadge tone="neutral" dot={false} className="tabular-nums">
                                                ${plan.monthlyPriceUsd}/mo
                                            </AdminStatusBadge>
                                        </>
                                    )}
                                />

                                <div className="flex flex-col gap-3">
                                    <h3 className="text-xs font-medium text-muted-foreground">1. Limits and permissions</h3>
                                    <EntitlementCard
                                        tierName={plan.publicName}
                                        draft={tierDrafts[tierKey]}
                                        onChange={(nextStr) => {
                                            setTierDrafts((current) => ({
                                                ...current,
                                                [tierKey]: nextStr,
                                            }));
                                        }}
                                    />
                                    <div>
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => void saveTier(tierKey)}
                                            disabled={isBusy}
                                            {...getAnalyticsDebugAttributes('admin__tiers--save', { tier_key: tierKey })}
                                        >
                                            {isSaving === tierKey ? (
                                                <>
                                                    <SpinnerGap className="animate-spin" aria-hidden="true" />
                                                    Saving…
                                                </>
                                            ) : (
                                                `Save ${plan.publicName}`
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                <Separator />

                                <div className="mt-auto flex flex-col gap-3">
                                    <h3 className="text-xs font-medium text-muted-foreground">2. Existing customers (optional)</h3>
                                    <div aria-live="polite" className="text-sm">
                                        {isLoadingPreview === tierKey && !preview ? (
                                            <span role="status" className="inline-flex items-center gap-1.5 text-muted-foreground">
                                                <SpinnerGap size={12} className="animate-spin" aria-hidden="true" />
                                                Loading reapply preview…
                                            </span>
                                        ) : (
                                            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 tabular-nums">
                                                <dt className="text-muted-foreground">Customers on this tier</dt>
                                                <dd className="text-end font-medium text-foreground">{formatCount(preview?.affected_users)}</dd>
                                                <dt className="text-muted-foreground">Trips recalculated</dt>
                                                <dd className="text-end font-medium text-foreground">{formatCount(preview?.affected_trips)}</dd>
                                                <dd className="col-span-2 text-xs text-muted-foreground">
                                                    {formatCount(preview?.active_trips)} active · {formatCount(preview?.expired_trips)} expired · {formatCount(preview?.archived_trips)} archived
                                                </dd>
                                                <dt className="text-muted-foreground">Personal overrides kept</dt>
                                                <dd className="text-end font-medium text-foreground">{formatCount(preview?.users_with_overrides)}</dd>
                                            </dl>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-start gap-1.5">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => void reapplyTier(tierKey)}
                                            disabled={isBusy || isDirty}
                                            {...getAnalyticsDebugAttributes('admin__tiers--reapply', { tier_key: tierKey })}
                                        >
                                            {isReapplying === tierKey ? (
                                                <SpinnerGap className="animate-spin" aria-hidden="true" />
                                            ) : (
                                                <ArrowsClockwise aria-hidden="true" />
                                            )}
                                            {isReapplying === tierKey
                                                ? 'Reapplying…'
                                                : `Reapply to ${formatCount(reapplyCount)} customers…`}
                                        </Button>
                                        {isDirty ? (
                                            <p className="text-xs text-muted-foreground">Save the template first: reapply uses the saved version.</p>
                                        ) : null}
                                    </div>
                                </div>
                            </AdminSurfaceCard>
                        );
                    })}
                </section>
            </div>
        </AdminShell>
    );
};
