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

export const resolveUndoDiffEntries = (
  undoLog: AdminAuditRecord,
  timelineEntriesById: Map<string, TimelineEntryLike>
): UserChangeDiffEntry[] | null => {
  const sourceEventId = parseUndoSourceEventId(undoLog);
  if (!sourceEventId) return null;
  const sourceEntry = timelineEntriesById.get(sourceEventId);
  if (!sourceEntry || sourceEntry.kind !== 'user') return null;

  const sourceDiffEntries = buildUserChangeDiffEntries(sourceEntry.log);
  if (sourceDiffEntries.length === 0) return null;
  return sourceDiffEntries.map((entry) => ({
    key: entry.key,
    beforeValue: entry.afterValue,
    afterValue: entry.beforeValue,
  }));
};
