import React from 'react';
import { SpinnerGap } from '@phosphor-icons/react';
import { Link } from '@/app/navigation';
import { Button } from '../../ui/button';
import { AdminEmptyState } from '../AdminEmptyState';
import { AdminErrorAlert } from '../AdminErrorAlert';
import { AdminPagination } from '../AdminPagination';
import { AdminRelativeTimestamp } from '../AdminRelativeTimestamp';
import { AdminSectionHeader } from '../AdminSectionHeader';
import { AdminStatusBadge } from '../AdminStatusBadge';
import { CopyableUuid } from '../CopyableUuid';
import { cn } from '../../../lib/utils';
import type { AdminUserChangeRecord } from '../../../services/adminService';
import {
    buildDiffEntryRenderKey,
    buildSecondaryFacetRenderKey,
    formatUserChangeDiffValue,
} from '../../../services/adminUserChangeLog';
import {
    USER_CHANGE_LOG_DRAWER_LIMIT,
    USER_DETAIL_LOG_PAGE_SIZE,
    canOpenUserChangeFullDiff,
    clampPage,
    formatFieldLabel,
    slicePage,
} from '../adminUsersModel';
import type { AdminUserChangeEntry } from './useAdminUserDetail';

const ChangeLogEntry: React.FC<{
    entry: AdminUserChangeEntry;
    onOpenFullDiff: (log: AdminUserChangeRecord) => void;
}> = ({ entry: { log, actionPresentation, secondaryFacets, visibleDiffEntries, hiddenDiffCount }, onOpenFullDiff }) => (
    <li className="rounded-md border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-1">
                <AdminStatusBadge dot={false} className={actionPresentation.className} data-tooltip={log.action}>
                    {actionPresentation.label}
                </AdminStatusBadge>
                {secondaryFacets.map((facet, facetIndex) => (
                    <AdminStatusBadge
                        key={`${log.id}-${buildSecondaryFacetRenderKey(facet, facetIndex)}`}
                        dot={false}
                        className={cn('text-[11px]', facet.className)}
                        data-tooltip={facet.code}
                    >
                        {facet.label}
                    </AdminStatusBadge>
                ))}
            </span>
            <AdminRelativeTimestamp value={log.created_at} fallback="Unknown time" className="text-xs text-muted-foreground" />
        </div>
        {(log.source || (log.target_type === 'trip' && log.target_id)) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                {log.source && <span>Source: {log.source}</span>}
                {log.target_type === 'trip' && log.target_id && (
                    <span className="inline-flex min-w-0 items-center">
                        Trip:
                        <CopyableUuid value={log.target_id} textClassName="max-w-[260px] truncate text-[11px]" hintClassName="text-[9px]" />
                    </span>
                )}
            </div>
        )}
        {visibleDiffEntries.length > 0 ? (
            <dl className="mt-2 flex flex-col gap-1.5">
                {visibleDiffEntries.map((diffEntry, entryIndex) => (
                    <div key={`${log.id}-${buildDiffEntryRenderKey(diffEntry, entryIndex)}`} className="grid gap-1 text-xs sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,1fr)]">
                        <dt className="font-medium text-muted-foreground">{formatFieldLabel(diffEntry.key)}</dt>
                        <dd className="break-all rounded-sm bg-red-50 px-1.5 py-0.5 text-red-900 line-through decoration-red-400/60 dark:bg-red-400/12 dark:text-red-200">
                            <span className="sr-only">Before: </span>
                            {formatUserChangeDiffValue(diffEntry, diffEntry.beforeValue)}
                        </dd>
                        <dd className="break-all rounded-sm bg-emerald-50 px-1.5 py-0.5 text-emerald-900 dark:bg-emerald-400/12 dark:text-emerald-200">
                            <span className="sr-only">After: </span>
                            {formatUserChangeDiffValue(diffEntry, diffEntry.afterValue)}
                        </dd>
                    </div>
                ))}
                {hiddenDiffCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                        +{hiddenDiffCount} more changed field{hiddenDiffCount === 1 ? '' : 's'}
                    </p>
                )}
            </dl>
        ) : (
            <p className="mt-2 text-xs text-muted-foreground">No field diff recorded.</p>
        )}
        {canOpenUserChangeFullDiff(log) && (
            <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => onOpenFullDiff(log)}
                className="mt-2"
            >
                Show complete diff
            </Button>
        )}
    </li>
);

/** The latest changes by or to the account, ten per page, each with its field diff. */
export const UserDetailActivityTab: React.FC<{
    userId: string;
    entries: AdminUserChangeEntry[];
    isLoading: boolean;
    errorMessage: string | null;
    page: number;
    onPageChange: (page: number) => void;
    onOpenFullDiff: (log: AdminUserChangeRecord) => void;
}> = ({ userId, entries, isLoading, errorMessage, page, onPageChange, onOpenFullDiff }) => {
    const safePage = clampPage(page, entries.length, USER_DETAIL_LOG_PAGE_SIZE);
    const pagedEntries = slicePage(entries, safePage, USER_DETAIL_LOG_PAGE_SIZE);

    return (
        <section className="flex flex-col gap-3">
            <AdminSectionHeader
                as="h3"
                title="Change log"
                description={`The latest ${USER_CHANGE_LOG_DRAWER_LIMIT} changes by or to this user.`}
                actions={(
                    <Button asChild variant="outline" size="xs">
                        <Link to={`/admin/audit?q=${encodeURIComponent(userId)}`}>
                            Open in Audit log
                        </Link>
                    </Button>
                )}
            />
            {errorMessage && <AdminErrorAlert message={errorMessage} />}
            {isLoading ? (
                <div role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <SpinnerGap size={14} className="animate-spin motion-reduce:animate-none" />
                    Loading change log…
                </div>
            ) : entries.length === 0 ? (
                errorMessage ? null : (
                    <AdminEmptyState
                        className="py-6"
                        title="No changes recorded yet"
                        description="Profile, trip and account changes for this user will appear here."
                    />
                )
            ) : (
                <>
                    <ol className="flex flex-col gap-2">
                        {pagedEntries.map((entry) => (
                            <ChangeLogEntry key={entry.log.id} entry={entry} onOpenFullDiff={onOpenFullDiff} />
                        ))}
                    </ol>
                    <AdminPagination
                        page={safePage}
                        pageSize={USER_DETAIL_LOG_PAGE_SIZE}
                        totalItems={entries.length}
                        onPageChange={onPageChange}
                        noun="changes"
                    />
                </>
            )}
        </section>
    );
};
