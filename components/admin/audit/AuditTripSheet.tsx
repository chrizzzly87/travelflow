import React from 'react';
import { ArrowSquareOut } from '@phosphor-icons/react';
import { Link } from '@/app/navigation';
import { AdminDetailSheet } from '../AdminDetailSheet';
import { AdminSectionHeader } from '../AdminSectionHeader';
import { AdminStatusBadge } from '../AdminStatusBadge';
import { CopyableUuid } from '../CopyableUuid';
import { Button } from '../../ui/button';
import { adminListTrips, type AdminAuditRecord, type AdminTripRecord } from '../../../services/adminService';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import { buildTripOwnerLog, getSnapshotForTarget, resolveAuditTripIdentity } from './adminAuditModel';
import { formatAuditValue } from './adminAuditPresentation';
import { AuditDetailRow, AuditLoadingStatus, AuditSnapshotDisclosure, AuditWarningAlert } from './AuditDetailParts';
import { useAuditLiveRecord } from './useAuditLiveRecord';

const TRIP_MESSAGES = {
    notFound: 'Live trip not found. Showing audit snapshot only.',
    failed: 'Could not load the live trip details.',
};

const loadTrip = async (tripId: string): Promise<AdminTripRecord | null> => {
    const rows = await adminListTrips({ search: tripId, limit: 20, status: 'all' });
    return rows.find((row) => row.trip_id === tripId) || null;
};

/** The trip behind an audit row, with links to the trip itself, Trips and its owner. */
export const AuditTripSheet: React.FC<{
    log: AdminAuditRecord | null;
    onClose: () => void;
    onOpenOwner: (ownerLog: AdminAuditRecord) => void;
}> = ({ log, onClose, onOpenOwner }) => {
    const live = useAuditLiveRecord<AdminTripRecord>(log, loadTrip, TRIP_MESSAGES);
    const snapshot = getSnapshotForTarget(log);
    const identity = resolveAuditTripIdentity(log, live.record);

    return (
        <AdminDetailSheet
            open={Boolean(log)}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            size="md"
            title={identity.title || 'Trip'}
            accessibleTitle="Trip details"
            subtitle={identity.ownerEmail || undefined}
            meta={identity.status && (
                <AdminStatusBadge
                    tone={identity.status === 'active' ? 'success' : identity.status === 'archived' ? 'neutral' : 'warning'}
                >
                    {identity.status.charAt(0).toUpperCase() + identity.status.slice(1)}
                </AdminStatusBadge>
            )}
            headerActions={identity.tripId !== 'n/a' && (
                <Button asChild variant="outline" size="sm">
                    <a
                        href={`/trip/${encodeURIComponent(identity.tripId)}`}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => trackEvent('admin__audit--open_trip')}
                        {...getAnalyticsDebugAttributes('admin__audit--open_trip')}
                    >
                        Open trip
                        <ArrowSquareOut className="rtl:-scale-x-100" />
                    </a>
                </Button>
            )}
            footer={identity.tripId !== 'n/a' && (
                <>
                    <Button asChild variant="outline" size="sm">
                        <Link
                            to={`/admin/trips?trip=${encodeURIComponent(identity.tripId)}&drawer=trip`}
                            onClick={() => trackEvent('admin__audit--open_in_trips')}
                            {...getAnalyticsDebugAttributes('admin__audit--open_in_trips')}
                        >
                            Open in Trips
                        </Link>
                    </Button>
                    {identity.ownerId && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const ownerLog = buildTripOwnerLog(log, identity);
                                if (!ownerLog) return;
                                trackEvent('admin__audit--open_owner');
                                onOpenOwner(ownerLog);
                            }}
                            {...getAnalyticsDebugAttributes('admin__audit--open_owner')}
                        >
                            Open owner
                        </Button>
                    )}
                </>
            )}
        >
            {live.error && <AuditWarningAlert message={live.error} />}
            {live.isLoading ? (
                <AuditLoadingStatus label="Loading trip details…" />
            ) : (
                <>
                    <section className="flex flex-col gap-2">
                        <AdminSectionHeader as="h3" title="Trip" />
                        <dl className="divide-y divide-border">
                            <AuditDetailRow label="Trip id">
                                <CopyableUuid value={identity.tripId} textClassName="break-all text-xs" />
                            </AuditDetailRow>
                            <AuditDetailRow label="Owner">
                                <div className="flex flex-col gap-0.5">
                                    <span>{identity.ownerEmail || (identity.ownerId ? 'No email' : '—')}</span>
                                    {identity.ownerId && <CopyableUuid value={identity.ownerId} textClassName="break-all text-xs" />}
                                </div>
                            </AuditDetailRow>
                            <AuditDetailRow label="Expires">{identity.expiresAt ? formatAuditValue(identity.expiresAt) : 'Not set'}</AuditDetailRow>
                            <AuditDetailRow label="Source">{identity.sourceKind || '—'}</AuditDetailRow>
                            <AuditDetailRow label="Created">{identity.createdAt ? formatAuditValue(identity.createdAt) : '—'}</AuditDetailRow>
                            <AuditDetailRow label="Updated">{identity.updatedAt ? formatAuditValue(identity.updatedAt) : '—'}</AuditDetailRow>
                        </dl>
                    </section>
                    {Object.keys(snapshot).length > 0 && <AuditSnapshotDisclosure snapshot={snapshot} />}
                </>
            )}
        </AdminDetailSheet>
    );
};
