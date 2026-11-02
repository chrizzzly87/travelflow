/**
 * Pure helpers shared by the list + editor content screens (Destinations,
 * Recommendations, Airports). No React, so they are tested directly.
 */

import {
    formatAdminAbsoluteTime as formatAbsolute,
    formatAdminRelativeTime as formatRelative,
} from './adminRelativeTime';

// Content screens say "Never" for a missing date; the format itself is shared.
export const formatAdminRelativeTime = (value: unknown, nowMs = Date.now(), fallback = 'Never'): string => (
    formatRelative(value, nowMs, fallback)
);

export const formatAdminAbsoluteTime = (value: unknown, fallback = 'Never'): string => formatAbsolute(value, fallback);

export interface OverridePatchParseResult {
    ok: boolean;
    /** The parsed object when `ok`, otherwise null. */
    patch: Record<string, unknown> | null;
    /** The authored problem when not `ok`, otherwise null. */
    message: string | null;
}

/** Validates the destination override editor's JSON as the admin types. */
export const parseOverridePatch = (json: string): OverridePatchParseResult => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json.trim() || '{}');
    } catch {
        return { ok: false, patch: null, message: 'The override must be valid JSON.' };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, patch: null, message: 'The override must be a JSON object.' };
    }
    return { ok: true, patch: parsed as Record<string, unknown>, message: null };
};

/** Counts records per status so filter menus can show "Draft (4)". */
export const countByStatus = <T, K extends string>(
    rows: readonly T[],
    readStatus: (row: T) => K,
): Partial<Record<K, number>> => {
    const counts: Partial<Record<K, number>> = {};
    rows.forEach((row) => {
        const status = readStatus(row);
        counts[status] = (counts[status] ?? 0) + 1;
    });
    return counts;
};

/** Shallow equality for flat editor drafts (strings, numbers, booleans). */
export const isEditorDraftEqual = <T extends object>(left: T, right: T): boolean => {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]) as Set<keyof T>;
    for (const key of keys) {
        if (left[key] !== right[key]) return false;
    }
    return true;
};

/** True below the `xl` breakpoint, where the editor stacks under the list. */
export const isStackedEditorLayout = (): boolean => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && !window.matchMedia('(min-width: 1280px)').matches
);
