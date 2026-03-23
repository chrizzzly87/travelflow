import React from 'react';
import {
    CalendarBlank,
    CheckCircle,
    Copy,
    Files,
    GlobeHemisphereWest,
    ShieldCheck,
    SuitcaseRolling,
} from '@phosphor-icons/react';

import type {
    ITrip,
    TripWorkspaceContextSelection,
    TripWorkspacePage,
} from '../../../types';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import {
    type TripWorkspaceDemoDataset,
    type TripWorkspaceDocumentRecord,
    type TripWorkspaceDocumentSectionId,
} from './tripWorkspaceDemoData';
import {
    filterTripWorkspaceEntriesBySelection,
    resolveTripWorkspaceContextSnapshot,
} from './tripWorkspaceContext';
import { resolveTripWorkspaceFallbackTripMeta, useTripWorkspacePageContext } from './tripWorkspacePageContext';
import { TripWorkspaceRouteContextBar } from './TripWorkspaceRouteContextBar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../ui/accordion';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Switch } from '../../ui/switch';
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs';

interface TripMetaSummary {
    dateRange: string;
    totalDaysLabel: string;
    cityCount: number;
    distanceLabel: string | null;
    summaryLine: string;
}

interface TripWorkspaceDocumentsPageProps {
    trip: ITrip;
    tripMeta?: TripMetaSummary;
    dataset?: TripWorkspaceDemoDataset;
    contextSelection?: TripWorkspaceContextSelection;
    onContextSelectionChange?: (next: TripWorkspaceContextSelection) => void;
    onPageChange: (page: TripWorkspacePage) => void;
}

const SECTION_COPY: Record<TripWorkspaceDocumentSectionId, { label: string; detail: string }> = {
    entry: {
        label: 'Entry',
        detail: 'Identity, onward proof, and first-arrival handoff.',
    },
    transport: {
        label: 'Transport',
        detail: 'Flights, trains, buses, and border transfer packets.',
    },
    stays: {
        label: 'Stays',
        detail: 'Hotel details, booking gaps, and arrival backups.',
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

export const TripWorkspaceDocumentsPage: React.FC<TripWorkspaceDocumentsPageProps> = ({
    trip,
    tripMeta = resolveTripWorkspaceFallbackTripMeta(trip),
    dataset,
    contextSelection,
    onContextSelectionChange,
    onPageChange,
}) => {
    const pageTripMeta = React.useMemo(
        () => tripMeta ?? resolveTripWorkspaceFallbackTripMeta(trip),
        [trip, tripMeta],
    );
    const {
        dataset: pageDataset,
        contextSelection: pageContextSelection,
        onContextSelectionChange: handleContextSelectionChange,
    } = useTripWorkspacePageContext({
        trip,
        dataset,
        contextSelection,
        onContextSelectionChange,
    });
    const context = React.useMemo(
        () => resolveTripWorkspaceContextSnapshot(pageDataset, pageContextSelection),
        [pageContextSelection, pageDataset],
    );
    const [activeSection, setActiveSection] = React.useState<TripWorkspaceDocumentSectionId>('entry');
    const [activePacketId, setActivePacketId] = React.useState<string>(() => pageDataset.documentPackets[0]?.id ?? '');
    const [verifiedIds, setVerifiedIds] = React.useState<string[]>(() => (
        pageDataset.documentRecords.filter((record) => record.status === 'Verified').map((record) => record.id)
    ));
    const [offlineFolderReady, setOfflineFolderReady] = React.useState<boolean>(true);
    const [printedBackupReady, setPrintedBackupReady] = React.useState<boolean>(false);
    const [copiedId, setCopiedId] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!copiedId) return undefined;
        const timeout = window.setTimeout(() => setCopiedId(null), 1400);
        return () => window.clearTimeout(timeout);
    }, [copiedId]);

    const visibleRecords = React.useMemo(
        () => filterTripWorkspaceEntriesBySelection(
            pageDataset.documentRecords.filter((record) => record.section === activeSection),
            pageContextSelection,
            activeSection === 'coverage' ? 'country' : 'city',
        ),
        [activeSection, pageContextSelection, pageDataset.documentRecords],
    );
    const activePacket = React.useMemo(
        () => pageDataset.documentPackets.find((packet) => packet.id === activePacketId) ?? pageDataset.documentPackets[0] ?? null,
        [activePacketId, pageDataset.documentPackets],
    );
    const packetRecords = React.useMemo(
        () => pageDataset.documentRecords.filter((record) => activePacket?.documentIds.includes(record.id)),
        [activePacket?.documentIds, pageDataset.documentRecords],
    );
    const verifiedCount = React.useMemo(
        () => pageDataset.documentRecords.filter((record) => getEffectiveStatus(record, verifiedIds) === 'Verified').length,
        [pageDataset.documentRecords, verifiedIds],
    );
    const missingCount = React.useMemo(
        () => pageDataset.documentRecords.filter((record) => getEffectiveStatus(record, verifiedIds) === 'Missing').length,
        [pageDataset.documentRecords, verifiedIds],
    );

    const handleToggleVerified = React.useCallback((recordId: string) => {
        setVerifiedIds((current) => current.includes(recordId)
            ? current.filter((id) => id !== recordId)
            : [...current, recordId]);
    }, []);

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
            <TripWorkspaceRouteContextBar
                tripId={trip.id}
                page="documents"
                dataset={pageDataset}
                tripMeta={pageTripMeta}
                selection={pageContextSelection}
                onSelectionChange={handleContextSelectionChange}
            />

            <Card className="overflow-hidden border-border/80 bg-card/95 shadow-sm">
                <CardHeader className="gap-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary">Documents dossier</Badge>
                        <Badge variant="outline">{context.activeCountry?.name ?? 'Route-wide'}</Badge>
                        <Badge variant="outline">{pageDataset.documentPackets.length} packets</Badge>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
                        <div>
                            <CardDescription>Operational paperwork</CardDescription>
                            <CardTitle>Keep packets grouped by route leg and country, not buried by document type</CardTitle>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                                Documents now follow the route shape. Entry and onward-proof packets stay visible by country leg, while the deeper record list lets you verify references without losing the overview.
                            </p>
                            <div className="mt-5 flex flex-wrap gap-2">
                                <Button type="button" variant="outline" onClick={() => onPageChange('bookings')}>
                                    <SuitcaseRolling data-icon="inline-start" weight="duotone" />
                                    Open bookings
                                </Button>
                                <Button type="button" variant="outline" onClick={() => onPageChange('places')}>
                                    <GlobeHemisphereWest data-icon="inline-start" weight="duotone" />
                                    Open places
                                </Button>
                                <Button type="button" variant="outline" onClick={() => onPageChange('planner')}>
                                    <CalendarBlank data-icon="inline-start" weight="duotone" />
                                    Open planner
                                </Button>
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Verified</p>
                                <p className="mt-2 text-2xl font-semibold text-foreground">{verifiedCount}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Missing</p>
                                <p className="mt-2 text-2xl font-semibold text-foreground">{missingCount}</p>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background/90 px-4 py-3">
                                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Country leg</p>
                                <p className="mt-2 text-sm font-semibold text-foreground">{context.activeCountry?.name ?? 'Route'}</p>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
                <div className="flex flex-col gap-4">
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader className="gap-3">
                            <CardDescription>Packet chooser</CardDescription>
                            <CardTitle>Pick the route-leg packet you want to trust</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="flex flex-wrap gap-2">
                                {pageDataset.documentPackets.map((packet) => (
                                    <button
                                        key={packet.id}
                                        type="button"
                                        onClick={() => setActivePacketId(packet.id)}
                                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                            activePacketId === packet.id
                                                ? 'border-accent-500 bg-accent-50 text-accent-700'
                                                : 'border-border bg-background text-muted-foreground hover:border-accent-300 hover:text-foreground'
                                        }`}
                                    >
                                        {packet.label}
                                    </button>
                                ))}
                            </div>
                            {activePacket ? (
                                <div className="rounded-[1.75rem] border border-border/70 bg-background px-4 py-4">
                                    <div className="flex items-center gap-3">
                                        <Files size={18} weight="duotone" className="text-accent-700" />
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{activePacket.label}</p>
                                            <p className="mt-1 text-sm leading-6 text-muted-foreground">{activePacket.detail}</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid gap-3">
                                        {packetRecords.map((record) => (
                                            <div key={record.id} className="rounded-[1.25rem] border border-border/70 px-4 py-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <p className="text-sm font-medium text-foreground">{record.title}</p>
                                                    <Badge variant={STATUS_VARIANTS[getEffectiveStatus(record, verifiedIds)]}>{getEffectiveStatus(record, verifiedIds)}</Badge>
                                                </div>
                                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{record.detail}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : null}
                        </CardContent>
                    </Card>

                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader className="gap-3">
                            <CardDescription>Record library</CardDescription>
                            <CardTitle>Verify details without losing packet context</CardTitle>
                            <Tabs value={activeSection} onValueChange={(value) => setActiveSection(value as TripWorkspaceDocumentSectionId)}>
                                <TabsList className="flex w-full flex-wrap justify-start">
                                    {Object.entries(SECTION_COPY).map(([id, section]) => (
                                        <TabsTrigger key={id} value={id}>{section.label}</TabsTrigger>
                                    ))}
                                </TabsList>
                            </Tabs>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <p className="text-sm font-medium text-foreground">{SECTION_COPY[activeSection].label}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{SECTION_COPY[activeSection].detail}</p>
                            </div>
                            <Accordion type="multiple" className="grid gap-3">
                                {visibleRecords.map((record) => {
                                    const status = getEffectiveStatus(record, verifiedIds);
                                    const isVerified = status === 'Verified';
                                    return (
                                        <AccordionItem key={record.id} value={record.id} className="rounded-[1.5rem] border border-border/70 bg-background px-4">
                                            <AccordionTrigger>
                                                <div className="min-w-0 flex-1 text-left">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-sm font-semibold text-foreground">{record.title}</p>
                                                        <Badge variant={STATUS_VARIANTS[status]}>{status}</Badge>
                                                        <Badge variant={record.scope === 'Trip-specific' ? 'secondary' : 'outline'}>{record.scope}</Badge>
                                                        <Badge variant={CARRY_MODE_VARIANTS[record.carryMode]}>{record.carryMode}</Badge>
                                                    </div>
                                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{record.detail}</p>
                                                </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="grid gap-3 pb-4">
                                                <div className="flex flex-wrap gap-2">
                                                    <Badge variant="outline">{record.sourceLine}</Badge>
                                                    {record.legLabel ? <Badge variant="outline">{record.legLabel}</Badge> : null}
                                                    {record.referenceLabel && record.referenceValue ? (
                                                        <Badge variant="outline">{record.referenceLabel}: {record.referenceValue}</Badge>
                                                    ) : null}
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {record.tags.map((tag) => (
                                                        <Badge key={tag} variant="outline">{tag}</Badge>
                                                    ))}
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <Button type="button" variant={isVerified ? 'outline' : 'default'} onClick={() => handleToggleVerified(record.id)}>
                                                        <CheckCircle data-icon="inline-start" weight="duotone" />
                                                        {isVerified ? 'Marked verified' : 'Mark verified'}
                                                    </Button>
                                                    {record.referenceValue ? (
                                                        <Button type="button" variant="ghost" onClick={() => void handleCopyReference(record)}>
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
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-col gap-4">
                    <Card className="border-border/80 bg-card/95 shadow-sm">
                        <CardHeader>
                            <CardDescription>Offline readiness</CardDescription>
                            <CardTitle>Keep the dossier usable without signal</CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-3">
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Offline folder ready</p>
                                        <p className="mt-2 text-sm leading-6 text-muted-foreground">Keep the route dossier usable if airports, stations, or border posts get patchy.</p>
                                    </div>
                                    <Switch checked={offlineFolderReady} onCheckedChange={setOfflineFolderReady} />
                                </div>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">Printed backup ready</p>
                                        <p className="mt-2 text-sm leading-6 text-muted-foreground">Printed copies still help on ferry counters, overland borders, and last-minute stays.</p>
                                    </div>
                                    <Switch checked={printedBackupReady} onCheckedChange={setPrintedBackupReady} />
                                </div>
                            </div>
                            <div className="rounded-[1.5rem] border border-border/70 bg-background px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck size={18} weight="duotone" className="text-emerald-700" />
                                    <p className="text-sm font-medium text-foreground">Country-aware packet logic</p>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    {context.activeCountry?.name ?? 'This country'} now gets its own document reading instead of hiding everything in one global packet list.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};
