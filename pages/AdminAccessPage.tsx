import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PLAN_CATALOG, PLAN_ORDER } from '../config/planCatalog';
import { supabase } from '../services/supabaseClient';
import type { PlanTierKey } from '../types';
import { AdminMenu } from '../components/admin/AdminMenu';

interface AdminUserRow {
    user_id: string;
    email: string | null;
    system_role: 'admin' | 'user';
    tier_key: PlanTierKey;
    entitlements_override: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
}

type TierTemplateDrafts = Record<PlanTierKey, string>;

const formatEntitlementValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'Unlimited';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
};

export const AdminAccessPage: React.FC = () => {
    const buildInitialTierTemplateDrafts = (): TierTemplateDrafts => ({
        tier_free: JSON.stringify(PLAN_CATALOG.tier_free.entitlements, null, 2),
        tier_mid: JSON.stringify(PLAN_CATALOG.tier_mid.entitlements, null, 2),
        tier_premium: JSON.stringify(PLAN_CATALOG.tier_premium.entitlements, null, 2),
    });

    const [users, setUsers] = useState<AdminUserRow[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [tierDraft, setTierDraft] = useState<PlanTierKey>('tier_free');
    const [overrideDraft, setOverrideDraft] = useState('{}');
    const [tierTemplateDrafts, setTierTemplateDrafts] = useState<TierTemplateDrafts>(buildInitialTierTemplateDrafts);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingTierTemplates, setIsLoadingTierTemplates] = useState(false);
    const [savingTierKey, setSavingTierKey] = useState<PlanTierKey | null>(null);

    const selectedUser = useMemo(
        () => users.find((row) => row.user_id === selectedUserId) || null,
        [selectedUserId, users]
    );

    const loadUsers = useCallback(async () => {
        if (!supabase) {
            setError('Supabase is not configured.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setMessage(null);
        const { data, error: rpcError } = await supabase.rpc('admin_list_users', {
            p_limit: 200,
            p_offset: 0,
            p_search: null,
        });
        if (rpcError) {
            setError(rpcError.message || 'Could not load users.');
            setUsers([]);
            setIsLoading(false);
            return;
        }
        const rows = (Array.isArray(data) ? data : []) as AdminUserRow[];
        setUsers(rows);
        setIsLoading(false);
        if (!selectedUserId && rows.length > 0) {
            setSelectedUserId(rows[0].user_id);
        }
    }, [selectedUserId]);

    useEffect(() => {
        void loadUsers();
    }, [loadUsers]);

    const loadTierTemplates = useCallback(async () => {
        if (!supabase) return;
        setIsLoadingTierTemplates(true);
        const { data, error: queryError } = await supabase
            .from('plans')
            .select('key, entitlements')
            .in('key', PLAN_ORDER);
        if (queryError) {
            setIsLoadingTierTemplates(false);
            return;
        }

        const nextDrafts = buildInitialTierTemplateDrafts();
        for (const row of (Array.isArray(data) ? data : [])) {
            const key = row.key;
            if (key !== 'tier_free' && key !== 'tier_mid' && key !== 'tier_premium') continue;
            if (row.entitlements && typeof row.entitlements === 'object') {
                nextDrafts[key] = JSON.stringify(row.entitlements, null, 2);
            }
        }
        setTierTemplateDrafts(nextDrafts);
        setIsLoadingTierTemplates(false);
    }, []);

    useEffect(() => {
        void loadTierTemplates();
    }, [loadTierTemplates]);

    useEffect(() => {
        if (!selectedUser) return;
        setTierDraft(selectedUser.tier_key);
        setOverrideDraft(JSON.stringify(selectedUser.entitlements_override || {}, null, 2));
    }, [selectedUser]);

    const saveTier = async () => {
        if (!supabase || !selectedUser) return;
        setIsSaving(true);
        setError(null);
        setMessage(null);
        const { error: rpcError } = await supabase.rpc('admin_update_user_tier', {
            p_user_id: selectedUser.user_id,
            p_tier_key: tierDraft,
        });
        if (rpcError) {
            setError(rpcError.message || 'Could not update user tier.');
            setIsSaving(false);
            return;
        }
        setMessage('Tier updated successfully.');
        setIsSaving(false);
        await loadUsers();
    };

    const saveOverrides = async () => {
        if (!supabase || !selectedUser) return;
        setIsSaving(true);
        setError(null);
        setMessage(null);
        let parsed: unknown;
        try {
            parsed = JSON.parse(overrideDraft);
        } catch {
            setError('Override JSON is invalid.');
            setIsSaving(false);
            return;
        }
        const { error: rpcError } = await supabase.rpc('admin_update_user_overrides', {
            p_user_id: selectedUser.user_id,
            p_overrides: parsed,
        });
        if (rpcError) {
            setError(rpcError.message || 'Could not update user overrides.');
            setIsSaving(false);
            return;
        }
        setMessage('Overrides updated successfully.');
        setIsSaving(false);
        await loadUsers();
    };

    const saveTierTemplate = async (tierKey: PlanTierKey) => {
        if (!supabase) return;
        setSavingTierKey(tierKey);
        setError(null);
        setMessage(null);

        let parsed: unknown;
        try {
            parsed = JSON.parse(tierTemplateDrafts[tierKey]);
        } catch {
            setError(`Tier template JSON is invalid for ${tierKey}.`);
            setSavingTierKey(null);
            return;
        }

        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            setError(`Tier template JSON must be an object for ${tierKey}.`);
            setSavingTierKey(null);
            return;
        }

        const { error: rpcError } = await supabase.rpc('admin_update_plan_entitlements', {
            p_tier_key: tierKey,
            p_entitlements: parsed,
        });
        if (rpcError) {
            setError(rpcError.message || `Could not update tier template for ${tierKey}.`);
            setSavingTierKey(null);
            return;
        }

        setMessage(`Tier template updated for ${tierKey}.`);
        setSavingTierKey(null);
        await loadTierTemplates();
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <AdminMenu />
            <div className="mx-auto w-full max-w-7xl space-y-6 px-6 py-8 md:px-10 md:py-10">
                <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">Admin access control</p>
                    <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">Roles, Tiers, and User Overrides</h1>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                        Manage user tier assignments and per-user entitlement overrides. Admin role remains allowlist-controlled.
                    </p>
                </section>

                {error && (
                    <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                        {error}
                    </section>
                )}
                {message && (
                    <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                        {message}
                    </section>
                )}

                <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <h2 className="text-sm font-semibold text-slate-900">Users</h2>
                        {isLoading ? (
                            <div className="mt-4 text-sm text-slate-500">Loading users...</div>
                        ) : (
                            <div className="mt-4 space-y-2">
                                {users.map((row) => (
                                    <button
                                        key={row.user_id}
                                        type="button"
                                        onClick={() => setSelectedUserId(row.user_id)}
                                        className={`w-full rounded-xl border px-3 py-2 text-left text-xs ${
                                            selectedUserId === row.user_id
                                                ? 'border-accent-300 bg-accent-50 text-accent-900'
                                                : 'border-slate-200 bg-white text-slate-700'
                                        }`}
                                    >
                                        <div className="truncate font-semibold">{row.email || row.user_id}</div>
                                        <div className="mt-1 text-[11px] uppercase tracking-wide text-slate-500">
                                            {row.system_role} • {row.tier_key}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </article>

                    <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        {!selectedUser ? (
                            <div className="text-sm text-slate-500">Select a user to edit access.</div>
                        ) : (
                            <>
                                <header>
                                    <h2 className="text-sm font-semibold text-slate-900">{selectedUser.email || selectedUser.user_id}</h2>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Role: {selectedUser.system_role} • Created: {new Date(selectedUser.created_at).toLocaleString()}
                                    </p>
                                </header>

                                <section className="rounded-xl border border-slate-200 p-3">
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tier assignment</h3>
                                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                                        <select
                                            value={tierDraft}
                                            onChange={(event) => setTierDraft(event.target.value as PlanTierKey)}
                                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent-500"
                                        >
                                            {PLAN_ORDER.map((key) => (
                                                <option key={key} value={key}>
                                                    {PLAN_CATALOG[key].publicName} ({key})
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={saveTier}
                                            disabled={isSaving}
                                            className="rounded-lg bg-accent-600 px-3 py-2 text-xs font-semibold text-white hover:bg-accent-700 disabled:opacity-50"
                                        >
                                            Save tier
                                        </button>
                                    </div>
                                </section>

                                <section className="rounded-xl border border-slate-200 p-3">
                                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Per-user overrides (JSON)</h3>
                                    <textarea
                                        value={overrideDraft}
                                        onChange={(event) => setOverrideDraft(event.target.value)}
                                        className="mt-3 min-h-[180px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-accent-500"
                                    />
                                    <div className="mt-3">
                                        <button
                                            type="button"
                                            onClick={saveOverrides}
                                            disabled={isSaving}
                                            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                                        >
                                            Save overrides
                                        </button>
                                    </div>
                                </section>
                            </>
                        )}
                    </article>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-sm font-semibold text-slate-900">Tier template management</h2>
                    <p className="mt-2 text-xs text-slate-500">
                        Update plan default entitlements in the database. Keep <code>config/planCatalog.ts</code> in sync before shipping pricing copy.
                    </p>
                    {isLoadingTierTemplates ? (
                        <div className="mt-4 text-sm text-slate-500">Loading tier templates...</div>
                    ) : (
                        <div className="mt-4 grid gap-4 md:grid-cols-3">
                            {PLAN_ORDER.map((key) => (
                                <article key={`template-${key}`} className="rounded-xl border border-slate-200 p-3">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{key}</div>
                                    <div className="mt-1 text-sm font-semibold text-slate-900">{PLAN_CATALOG[key].publicName}</div>
                                    <textarea
                                        value={tierTemplateDrafts[key]}
                                        onChange={(event) => {
                                            setTierTemplateDrafts((current) => ({
                                                ...current,
                                                [key]: event.target.value,
                                            }));
                                        }}
                                        className="mt-3 min-h-[180px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-accent-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => void saveTierTemplate(key)}
                                        disabled={savingTierKey !== null}
                                        className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                                    >
                                        {savingTierKey === key ? 'Saving...' : 'Save template'}
                                    </button>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h2 className="text-sm font-semibold text-slate-900">Tier defaults</h2>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                        {PLAN_ORDER.map((key) => {
                            const plan = PLAN_CATALOG[key];
                            return (
                                <article key={key} className="rounded-xl border border-slate-200 p-3">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{plan.key}</div>
                                    <div className="mt-1 text-sm font-semibold text-slate-900">{plan.publicName}</div>
                                    <ul className="mt-3 space-y-1 text-xs text-slate-600">
                                        {Object.entries(plan.entitlements).map(([entitlementKey, value]) => (
                                            <li key={entitlementKey}>
                                                <span className="font-medium text-slate-700">{entitlementKey}:</span>{' '}
                                                {formatEntitlementValue(value)}
                                            </li>
                                        ))}
                                    </ul>
                                </article>
                            );
                        })}
                    </div>
                </section>
            </div>
        </div>
    );
};
