import React from 'react';
import { WarningCircle } from '@phosphor-icons/react';

// Confirmation copy for the deletion flows. `docs/ADMIN_USER_DELETION_POLICY.md`
// describes what each one does; keep the two in step.

// A plain element rather than a component, so the message stays one tree of
// text nodes (the tests read the dialog copy straight from the element props).
const IRREVERSIBLE_WARNING = (
    <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-800 dark:bg-rose-400/12 dark:text-rose-200 dark:border-rose-400/30">
        <WarningCircle size={16} className="mt-0.5 shrink-0" />
        <span><strong>This action cannot be undone.</strong></span>
    </div>
);

export const buildSingleHardDeleteMessage = (
    userName: string,
    ownedTripCount: number
): React.ReactNode => {
    const tripSuffix = ownedTripCount > 0 ? ` (${ownedTripCount})` : '';
    const tripLine = ownedTripCount > 0
        ? `${ownedTripCount} owned trip${ownedTripCount === 1 ? '' : 's'} will be permanently deleted.`
        : 'No owned trips were found for this user.';
    return (
        <div className="space-y-3">
            <p>
                Are you sure you want to hard-delete <strong>"{userName}"</strong>?
            </p>
            <p>
                Hard delete permanently removes the <strong>auth account</strong>, <strong>profile data</strong>, and <strong>all owned trips{tripSuffix}</strong>.
            </p>
            <ul className="list-disc space-y-1 ps-5">
                <li>Auth account and profile data are permanently removed.</li>
                <li>{tripLine}</li>
                <li>Use soft delete instead if you may need to restore this user later.</li>
            </ul>
            {ownedTripCount > 0 ? (
                <p>
                    To keep trips, cancel and use <strong>Transfer trips + hard delete</strong> first.
                </p>
            ) : null}
            {IRREVERSIBLE_WARNING}
        </div>
    );
};

export const buildSingleSoftDeleteMessage = (userName: string): React.ReactNode => (
    <div className="space-y-3">
        <p>
            Are you sure you want to soft-delete <strong>"{userName}"</strong>?
        </p>
        <p>
            Soft delete keeps the account and related data in the database so this user can be restored later.
        </p>
        <ul className="list-disc space-y-1 ps-5">
            <li>The user cannot sign in while the account is soft-deleted.</li>
            <li>An admin can restore the user later.</li>
        </ul>
        <p>
            Use hard delete only for permanent removal.
        </p>
    </div>
);

export const buildBulkHardDeleteMessage = (
    selectedUsers: number,
    selectedTrips: number
): React.ReactNode => (
    <div className="space-y-3">
        <p>
            Selected users: <strong>{selectedUsers}</strong>
        </p>
        <p>
            Hard delete permanently removes auth accounts and profile data for <strong>{selectedUsers}</strong> user{selectedUsers === 1 ? '' : 's'}.
        </p>
        <p>
            It also permanently removes <strong>{selectedTrips}</strong> owned trip{selectedTrips === 1 ? '' : 's'} in total.
        </p>
        <ul className="list-disc space-y-1 ps-5">
            <li>Use soft delete if these users might need to be restored later.</li>
            {selectedTrips > 0 ? (
                <li>Cancel and transfer trips from each user's details if you need to preserve trip data.</li>
            ) : null}
            {selectedTrips > 0 ? (
                <li>Continue hard delete to permanently remove selected users and owned trips.</li>
            ) : null}
        </ul>
        {IRREVERSIBLE_WARNING}
    </div>
);

export const buildTransferAndHardDeleteMessage = (
    sourceUser: string,
    targetUser: string,
    transferCount: number
): React.ReactNode => (
    <div className="space-y-3">
        <p>
            Transfer <strong>{transferCount}</strong> trip{transferCount === 1 ? '' : 's'} from <strong>{sourceUser}</strong> to <strong>{targetUser}</strong>?
        </p>
        <ul className="list-disc space-y-1 ps-5">
            <li>Step 1: Transfer all owned trips to the target account.</li>
            <li>Step 2: Hard-delete the source user (auth + profile only).</li>
            <li>Result: trips remain accessible under the new owner.</li>
        </ul>
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 dark:bg-amber-400/12 dark:text-amber-200 dark:border-amber-400/30">
            <WarningCircle size={16} className="mt-0.5 shrink-0" />
            <span><strong>Transfer first if you want to preserve trips before hard delete.</strong></span>
        </div>
    </div>
);
