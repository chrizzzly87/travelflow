import React from 'react';
import {
    Backpack,
    CalendarBlank,
    CheckCircle,
    Copy,
    Files,
    GlobeHemisphereWest,
    ShieldCheck,
    SuitcaseRolling,
} from '@phosphor-icons/react';

import type { ITrip, TripWorkspacePage } from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import {
    THAILAND_DOCUMENT_PACKETS,
    THAILAND_DOCUMENT_RECORDS,
    type TripWorkspaceDocumentPacket,
    type TripWorkspaceDocumentRecord,
    type TripWorkspaceDocumentSectionId,
} from './tripWorkspaceDemoData';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../ui/accordion';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Switch } from '../../ui/switch';
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs';

interface TripWorkspaceDocumentsPageProps {
    trip: ITrip;
    onPageChange: (page: TripWorkspacePage) => void;
}

const SECTION_COPY: Record<TripWorkspaceDocumentSectionId, { label: string; detail: string }> = {
    entry: {
        label: 'Entry',
        detail: 'Identity, onward proof, and first-arrival handoff.',
    },
    transport: {
        label: 'Transport',
        detail: 'Flights, ferries, and the references that keep transfers calm.',
    },
    stays: {
        label: 'Stays',
        detail: 'Hotel details, booking gaps, and first-night backups.',
    },
    coverage: {
        label: 'Coverage',
        detail: 'Insurance and emergency support references worth keeping close.',
    },
};

const STATUS_VARIANTS: Record<TripWorkspaceDocumentRecord['status'], 'secondary' | 'outline'> = {
    Verified: 'secondary',
    Review: 'outline',
    Missing: 'outline',
};

const CARRY_MODE_VARIANTS: Record<TripWorkspaceDocumentRecord['carryMode'], 'secondary' | 'outline'> = {
    Offline: 'secondary',
    Printed: 'outline',
    Either: 'outline',
};

const getEffectiveStatus = (record: TripWorkspaceDocumentRecord, verifiedIds: string[]): TripWorkspaceDocumentRecord['status'] => {
    if (verifiedIds.includes(record.id)) return 'Verified';
    if (record.status === 'Verified') return 'Review';
    return record.status;
};

const DocumentsQuickLink: React.FC<{
    icon: React.ReactNode;
    label: string;
    page: TripWorkspacePage;
    tripId: string;
    onPageChange: (page: TripWorkspacePage) => void;
}> = ({ icon, label, page, tripId, onPageChange }) => (
    <Button
        type="button"
        variant="outline"
        onClick={() => {
            trackEvent('trip_workspace__documents_link--open', {
                trip_id: tripId,
                target_page: page,
            });
            onPageChange(page);
        }}
        {...getAnalyticsDebugAttributes('trip_workspace__documents_link--open', {
            trip_id: tripId,
            target_page: page,
        })}
    >
        {icon}
        {label}
    </Button>
);

const DocumentsPacketChooser: React.FC<{
    activePacketId: string;
    onSelect: (packetId: string) => void;
    tripId: string;
}> = ({ activePacketId, onSelect, tripId }) => (
    <div className="flex flex-wrap gap-2">
        {THAILAND_DOCUMENT_PACKETS.map((packet) => (
            <button
                key={packet.id}
                type="button"
                onClick={() => {
                    trackEvent('trip_workspace__documents_packet--select', {
                        trip_id: tripId,
                        packet_id: packet.id,
                    });
                    onSelect(packet.id);
                }}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    activePacketId === packet.id
                        ? 'border-accent-500 bg-accent-50 text-accent-700'
                        : 'border-border bg-background text-muted-foreground hover:border-accent-300 hover:text-foreground'
                }`}
                {...getAnalyticsDebugAttributes('trip_workspace__documents_packet--select', {
                    trip_id: tripId,
                    packet_id: packet.id,
                })}
            >
                {packet.label}
            </button>
        ))}
    </div>
);

const DocumentsRecordAccordion: React.FC<{
    records: TripWorkspaceDocumentRecord[];
    verifiedIds: string[];
    copiedId: string | null;
    tripId: string;
    onToggleVerified: (recordId: string) => void;
    onCopyReference: (record: TripWorkspaceDocumentRecord) => void;
}> = ({ records, verifiedIds, copiedId, tripId, onToggleVerified, onCopyReference }) => (
    <Accordion type="single" collapsible className="rounded-[1.5rem] border border-border/70 bg-background px-4">
        {records.map((record) => {
            const status = getEffectiveStatus(record, verifiedIds);
            const isVerified = status === 'Verified';
            return (
                <AccordionItem key={record.id} value={record.id} className="border-border/60">
                    <AccordionTrigger className="py-4">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">{record.title}</p>
                                <Badge variant={STATUS_VARIANTS[status]}>{status}</Badge>
                                <Badge variant={record.scope === 'Trip-specific' ? 'secondary' : 'outline'}>{record.scope}</Badge>
                                <Badge variant={CARRY_MODE_VARIANTS[record.carryMode]}>{record.carryMode}</Badge>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{record.detail}</p>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4">
                        <div className="rounded-[1.25rem] border border-border/70 bg-card/70 px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">{record.sourceLine}</Badge>
                                {record.referenceLabel && record.referenceValue ? (
                                    <Badge variant="outline">{record.referenceLabel}: {record.referenceValue}</Badge>
                                ) : null}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {record.tags.map((tag) => (
                                    <Badge key={tag} variant="outline">{tag}</Badge>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant={isVerified ? 'outline' : 'default'}
                                onClick={() => onToggleVerified(record.id)}
                                {...getAnalyticsDebugAttributes('trip_workspace__documents_verify--toggle', {
                                    trip_id: tripId,
                                    record_id: record.id,
                                    active: !isVerified,
                                })}
                            >
                                <CheckCircle data-icon="inline-start" weight="duotone" />
                                {isVerified ? 'Marked verified' : 'Mark verified'}
                            </Button>
                            {record.referenceValue ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => void onCopyReference(record)}
                                    {...getAnalyticsDebugAttributes('trip_workspace__documents_reference--copy', {
                                        trip_id: tripId,
                                        record_id: record.id,
                                    })}
                                >
                                    <Copy data-icon="inline-start" weight="duotone" />
                                    {copiedId === record.id ? 'Copied' : 'Copy reference'}
                                </Button>
                            ) : null}
                        </div>
                    </AccordionContent>
                </AccordionItem>
            );
        })}
    </Accordion>
);

export const TripWorkspaceDocumentsPage: React.FC<TripWorkspaceDocumentsPageProps> = ({
    trip,
    onPageChange,
}) => {
    const [activeSection, setActiveSection] = React.useState<TripWorkspaceDocumentSectionId>('entry');
    const [activePacketId, setActivePacketId] = React.useState<string>('entry-file');
    const [verifiedIds, setVerifiedIds] = React.useState<string[]>(() => (
        THAILAND_DOCUMENT_RECORDS.filter((record) => record.status === 'Verified').map((record) => record.id)
    ));
    const [offlineFolderReady, setOfflineFolderReady] = React.useState<boolean>(true);
    const [printedBackupReady, setPrintedBackupReady] = React.useState<boolean>(false);
    const [copiedId, setCopiedId] = React.useState<string | null>(null);

    const visibleRecords = React.useMemo(
        () => THAILAND_DOCUMENT_RECORDS.filter((record) => record.section === activeSection),
        [activeSection],
    );
    const activePacket = React.useMemo<TripWorkspaceDocumentPacket>(
        () => THAILAND_DOCUMENT_PACKETS.find((packet) => packet.id === activePacketId) ?? THAILAND_DOCUMENT_PACKETS[0],
        [activePacketId],
    );
    const packetRecords = React.useMemo(
        () => THAILAND_DOCUMENT_RECORDS.filter((record) => activePacket.documentIds.includes(record.id)),
        [activePacket.documentIds],
    );
    const verifiedCount = React.useMemo(
        () => THAILAND_DOCUMENT_RECORDS.filter((record) => getEffectiveStatus(record, verifiedIds) === 'Verified').length,
        [verifiedIds],
    );
    const missingCount = React.useMemo(
        () => THAILAND_DOCUMENT_RECORDS.filter((record) => getEffectiveStatus(record, verifiedIds) === 'Missing').length,
        [verifiedIds],
    );

    React.useEffect(() => {
        if (!copiedId) return undefined;
        const timeout = window.setTimeout(() => setCopiedId(null), 1400);
        return () => window.clearTimeout(timeout);
    }, [copiedId]);

    const handleToggleVerified = React.useCallback((recordId: string) => {
        setVerifiedIds((current) => {
            const next = current.includes(recordId)
                ? current.filter((id) => id !== recordId)
                : [...current, recordId];
            trackEvent('trip_workspace__documents_verify--toggle', {
                trip_id: trip.id,
                record_id: recordId,
                active: next.includes(recordId),
            });
            return next;
        });
    }, [trip.id]);

    const handleCopyReference = React.useCallback(async (record: TripWorkspaceDocumentRecord) => {
        if (!record.referenceValue || typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return;
        await navigator.clipboard.writeText(record.referenceValue);
        setCopiedId(record.id);
        trackEvent('trip_workspace__documents_reference--copy', {
            trip_id: trip.id,
            record_id: record.id,
        });
    }, [trip.id]);

    return (
        <div className="flex flex-col gap-4">
            <Card className="overflow-hidden border-border/80 bg-linear-to-br from-amber-50 via-background to-stone-100 shadow-sm">
                <CardHeader className="gap-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">Demo dossier</Badge>
                        <Badge variant="outline">Trip file</Badge>
                        <Badge variant="outline">Thailand route</Badge>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr] lg:items-start">
                        <div>
                            <CardDescription>Document control room</CardDescription>
                            <CardTitle>Keep the trip paperwork feeling calm, visible, and ready to hand off</CardTitle>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                                This page turns the messy travel dossier into one readable surface: entry proof,
                                insurance, flight codes, ferry backups, hotel references, and the packets you want ready offline.
                            </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Verified</p>
                                <p className="mt-2 text-2xl font-semibold text-foreground">{verifiedCount}/{THAILAND_DOCUMENT_RECORDS.length}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Missing</p>
                                <p className="mt-2 text-2xl font-semibold text-foreground">{missingCount}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Active packet</p>
                                <p className="mt-2 text-sm font-semibold leading-6 text-foreground">{activePacket.label}</p>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                    <DocumentsQuickLink icon={<SuitcaseRolling data-icon="inline-start" weight="duotone" />} label="Open bookings" page="bookings" tripId={trip.id} onPageChange={onPageChange} />
                    <DocumentsQuickLink icon={<Backpack data-icon="inline-start" weight="duotone" />} label="Open travel kit" page="travel-kit" tripId={trip.id} onPageChange={onPageChange} />
                    <DocumentsQuickLink icon={<GlobeHemisphereWest data-icon="inline-start" weight="duotone" />} label="Open places" page="places" tripId={trip.id} onPageChange={onPageChange} />
                    <DocumentsQuickLink icon={<CalendarBlank data-icon="inline-start" weight="duotone" />} label="Open planner" page="planner" tripId={trip.id} onPageChange={onPageChange} />
                </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
                <div className="flex flex-col gap-4">
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader className="gap-3">
                            <CardDescription>Document sections</CardDescription>
                            <CardTitle>Read the route like a dossier instead of a pile of confirmations</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <Tabs value={activeSection} onValueChange={(value) => setActiveSection(value as TripWorkspaceDocumentSectionId)}>
                                <TabsList className="w-full justify-start overflow-x-auto">
                                    {Object.entries(SECTION_COPY).map(([id, section]) => (
                                        <TabsTrigger key={id} value={id}>{section.label}</TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <p className="text-sm font-medium text-foreground">{SECTION_COPY[activeSection].label}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{SECTION_COPY[activeSection].detail}</p>
                            </div>
                            <DocumentsRecordAccordion
                                records={visibleRecords}
                                verifiedIds={verifiedIds}
                                copiedId={copiedId}
                                tripId={trip.id}
                                onToggleVerified={handleToggleVerified}
                                onCopyReference={handleCopyReference}
                            />
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Trip packet presets</CardDescription>
                            <CardTitle>Use packets so the right proofs travel together</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <DocumentsPacketChooser activePacketId={activePacketId} onSelect={setActivePacketId} tripId={trip.id} />
                            <div className="rounded-[1.75rem] border border-border/70 bg-background px-4 py-4">
                                <div className="flex items-center gap-2">
                                    <Files size={18} weight="duotone" className="text-accent-700" />
                                    <p className="text-sm font-medium text-foreground">{activePacket.label}</p>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{activePacket.detail}</p>
                                <div className="mt-4 grid gap-3">
                                    {packetRecords.map((record) => (
                                        <div key={record.id} className="rounded-[1.25rem] border border-border/70 bg-card/70 px-4 py-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="text-sm font-medium text-foreground">{record.title}</p>
                                                <Badge variant={STATUS_VARIANTS[getEffectiveStatus(record, verifiedIds)]}>
                                                    {getEffectiveStatus(record, verifiedIds)}
                                                </Badge>
                                            </div>
                                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{record.referenceValue ?? record.detail}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-col gap-4">
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Dossier readiness</CardDescription>
                            <CardTitle>Make the carry format as explicit as the document</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="grid gap-3">
                                <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Offline folder ready</p>
                                            <p className="mt-1 text-sm leading-6 text-muted-foreground">Keep the full arrival packet on-device, not only in email search.</p>
                                        </div>
                                        <Switch
                                            checked={offlineFolderReady}
                                            onCheckedChange={(checked) => {
                                                setOfflineFolderReady(checked);
                                                trackEvent('trip_workspace__documents_toggle--toggle', {
                                                    trip_id: trip.id,
                                                    toggle_id: 'offline_folder',
                                                    active: checked,
                                                });
                                            }}
                                            {...getAnalyticsDebugAttributes('trip_workspace__documents_toggle--toggle', {
                                                trip_id: trip.id,
                                                toggle_id: 'offline_folder',
                                                active: !offlineFolderReady,
                                            })}
                                        />
                                    </div>
                                </div>
                                <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Printed transfer backup</p>
                                            <p className="mt-1 text-sm leading-6 text-muted-foreground">Use one printed fallback for ferry days and any weather-sensitive transfer chain.</p>
                                        </div>
                                        <Switch
                                            checked={printedBackupReady}
                                            onCheckedChange={(checked) => {
                                                setPrintedBackupReady(checked);
                                                trackEvent('trip_workspace__documents_toggle--toggle', {
                                                    trip_id: trip.id,
                                                    toggle_id: 'printed_backup',
                                                    active: checked,
                                                });
                                            }}
                                            {...getAnalyticsDebugAttributes('trip_workspace__documents_toggle--toggle', {
                                                trip_id: trip.id,
                                                toggle_id: 'printed_backup',
                                                active: !printedBackupReady,
                                            })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-[1.75rem] border border-border/70 bg-background px-4 py-4">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck size={18} weight="duotone" className="text-accent-700" />
                                    <p className="text-sm font-medium text-foreground">Carry-mode split</p>
                                </div>
                                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                    <div className="rounded-[1.25rem] border border-border/70 bg-card/70 px-4 py-3">
                                        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Offline</p>
                                        <p className="mt-2 text-2xl font-semibold text-foreground">
                                            {THAILAND_DOCUMENT_RECORDS.filter((record) => record.carryMode === 'Offline').length}
                                        </p>
                                    </div>
                                    <div className="rounded-[1.25rem] border border-border/70 bg-card/70 px-4 py-3">
                                        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Printed</p>
                                        <p className="mt-2 text-2xl font-semibold text-foreground">
                                            {THAILAND_DOCUMENT_RECORDS.filter((record) => record.carryMode === 'Printed').length}
                                        </p>
                                    </div>
                                    <div className="rounded-[1.25rem] border border-border/70 bg-card/70 px-4 py-3">
                                        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Either</p>
                                        <p className="mt-2 text-2xl font-semibold text-foreground">
                                            {THAILAND_DOCUMENT_RECORDS.filter((record) => record.carryMode === 'Either').length}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Why this page belongs in the workspace</CardDescription>
                            <CardTitle>Documents should feel deliberate, not like hidden admin debris</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
                            <div className="flex items-center gap-2 rounded-[1.5rem] border border-border/70 bg-background px-4 py-3 text-foreground">
                                <Files size={18} weight="duotone" className="text-accent-700" />
                                Proofs, codes, and support refs are easier to trust when they live in one visible dossier.
                            </div>
                            <div className="flex items-center gap-2 rounded-[1.5rem] border border-border/70 bg-background px-4 py-3 text-foreground">
                                <ShieldCheck size={18} weight="duotone" className="text-accent-700" />
                                This is the right home for future passport, visa, insurance, and PDF ingestion.
                            </div>
                            <div className="flex items-center gap-2 rounded-[1.5rem] border border-dashed border-border bg-background/70 px-4 py-3 text-foreground">
                                <Backpack size={18} weight="duotone" className="text-accent-700" />
                                Demo dossier note: references and codes are intentionally mocked until live document storage exists.
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
