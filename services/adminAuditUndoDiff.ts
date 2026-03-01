import type { AdminAuditRecord, AdminUserChangeRecord } from './adminService';
import { buildUserChangeDiffEntries, type UserChangeDiffEntry } from './adminUserChangeLog';

type TimelineEntryLike =
  | { kind: 'admin'; log: AdminAuditRecord }
  | { kind: 'user'; log: AdminUserChangeRecord };

const asRecord = (value: Record<string, unknown> | null | undefined): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

export const parseUndoSourceEventId = (log: AdminAuditRecord): string | null => {
  const metadata = asRecord(log.metadata);
  const explicit = asString(metadata.undo_source_event_id) || asString(metadata.source_event_id);
  if (explicit) return explicit;

  const label = asString(metadata.label);
  if (!label) return null;
  const match = label.match(/^Audit undo\s+([A-Za-z0-9_-]+)$/);
  return match?.[1] ?? null;
};

const invertDiffEntries = (entries: UserChangeDiffEntry[]): UserChangeDiffEntry[] => (
  entries.map((entry) => ({
    key: entry.key,
    beforeValue: entry.afterValue,
    afterValue: entry.beforeValue,
  }))
);

const resolveEntryDiffEntries = (
  entryId: string,
  timelineEntriesById: Map<string, TimelineEntryLike>,
  visited: Set<string>
): UserChangeDiffEntry[] | null => {
  if (visited.has(entryId)) return null;
  visited.add(entryId);

  const sourceEntry = timelineEntriesById.get(entryId);
  if (!sourceEntry) return null;

  if (sourceEntry.kind === 'user') {
    const sourceDiffEntries = buildUserChangeDiffEntries(sourceEntry.log);
    return sourceDiffEntries.length > 0 ? sourceDiffEntries : null;
  }

  if (sourceEntry.log.action.trim().toLowerCase() !== 'admin.trip.override_commit') {
    return null;
  }

  const nestedSourceEventId = parseUndoSourceEventId(sourceEntry.log);
  if (!nestedSourceEventId) return null;
  const nestedDiffEntries = resolveEntryDiffEntries(nestedSourceEventId, timelineEntriesById, visited);
  if (!nestedDiffEntries || nestedDiffEntries.length === 0) return null;
  return invertDiffEntries(nestedDiffEntries);
};

export const resolveUndoDiffEntries = (
  undoLog: AdminAuditRecord,
  timelineEntriesById: Map<string, TimelineEntryLike>
): UserChangeDiffEntry[] | null => {
  const sourceEventId = parseUndoSourceEventId(undoLog);
  if (!sourceEventId) return null;
  const sourceDiffEntries = resolveEntryDiffEntries(
    sourceEventId,
    timelineEntriesById,
    new Set<string>([undoLog.id])
  );
  if (!sourceDiffEntries || sourceDiffEntries.length === 0) return null;
  return invertDiffEntries(sourceDiffEntries);
};
