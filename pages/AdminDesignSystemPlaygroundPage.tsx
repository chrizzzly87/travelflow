import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChatCircleDots, CheckCircle, Eye, MagnifyingGlass, MapTrifold, PaintBrush, Plus, SlidersHorizontal, SuitcaseRolling, Trash, UsersThree, WarningCircle } from '@phosphor-icons/react';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminFilterMenu } from '../components/admin/AdminFilterMenu';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { AdminSectionHeader } from '../components/admin/AdminSectionHeader';
import { AdminStatCard } from '../components/admin/AdminStatCard';
import { AdminStatusBadge, type AdminStatusTone } from '../components/admin/AdminStatusBadge';
import { AdminEmptyState } from '../components/admin/AdminEmptyState';
import { AdminErrorAlert } from '../components/admin/AdminErrorAlert';
import { AdminBarChart } from '../components/admin/charts/AdminBarChart';
import { AdminAreaChart } from '../components/admin/charts/AdminAreaChart';
import { AdminDonutChart } from '../components/admin/charts/AdminDonutChart';
import { AdminBarList } from '../components/admin/charts/AdminBarList';
import { AdminDetailSheet } from '../components/admin/AdminDetailSheet';
import { AdminPagination } from '../components/admin/AdminPagination';
import { AdminSelectionBar } from '../components/admin/AdminSelectionBar';
import { AdminReloadButton } from '../components/admin/AdminReloadButton';
import { useAppDialog } from '../components/AppDialogProvider';
import { CountrySelect } from '../components/CountrySelect';
import { DateRangePicker } from '../components/DateRangePicker';
import { ProfileCountryRegionSelect } from '../components/profile/ProfileCountryRegionSelect';
import { AnimatedNumber } from '../components/ui/animated-number';
import { AppModal } from '../components/ui/app-modal';
import { showAppToast } from '../components/ui/appToast';
import { Checkbox } from '../components/ui/checkbox';
import {
    AdminSortHeaderButton,
} from '../components/admin/AdminDataTable';
import {
    ADMIN_TABLE_ROW_SURFACE_CLASS,
    ADMIN_TABLE_SORTED_CELL_CLASS,
    ADMIN_TABLE_SORTED_HEADER_CLASS,
    getAdminStickyBodyCellClass,
    getAdminStickyHeaderCellClass,
} from '../components/admin/AdminDataTableUtils';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../components/ui/dialog';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '../components/ui/drawer';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { SearchInput } from '../components/ui/search-input';
import { SettingsCard, SettingsGroup, SettingsRow } from '../components/ui/settings-panel';
import { NumberInput } from '../components/ui/number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';
import {
    buildDangerConfirmDialog,
    buildDecisionConfirmDialog,
    buildTransferTargetPromptDialog,
    buildUrlPromptDialog,
} from '../services/appDialogPresets';

type ComponentGroupId =
    | 'buttons'
    | 'inputs'
    | 'selects'
    | 'travel_inputs'
    | 'switches'
    | 'tabs'
    | 'dialogs'
    | 'settings'
    | 'cards'
    | 'admin'
    | 'tables'
    | 'tooltips';

type ToastScenarioId =
    | 'trip_archived'
    | 'archive_undo_success'
    | 'batch_archive_completed'
    | 'profile_saved'
    | 'share_link_copied'
    | 'history_undo'
    | 'history_redo'
    | 'generic_warning'
    | 'generic_error'
    | 'loading_sample';

interface ComponentGroupDefinition {
    id: ComponentGroupId;
    title: string;
    description: string;
    sourcePath: string;
    usagePaths: string[];
}

interface ToastScenarioDefinition {
    id: ToastScenarioId;
    label: string;
    helperText: string;
}

type PlaygroundTableSortKey = 'trip' | 'owner' | 'generation' | 'updated';

interface PlaygroundTableRow {
    id: string;
    trip: string;
    owner: string;
    generation: 'succeeded' | 'running' | 'failed';
    updated: string;
    uuid: string;
}

const SAMPLE_MAP_STYLE_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'standard', label: 'Standard (Mapbox)' },
    { value: 'minimal', label: 'Minimal' },
    { value: 'satellite', label: 'Satellite' },
];

const COMPONENT_GROUPS: ComponentGroupDefinition[] = [
    {
        id: 'buttons',
        title: 'Buttons',
        description: 'The shared Button variants and sizes, plus the marketing CTA treatments that live outside admin.',
        sourcePath: 'components/ui/button.tsx',
        usagePaths: ['pages/ProfilePage.tsx', 'components/TripManager.tsx', 'pages/AdminUsersPage.tsx'],
    },
    {
        id: 'inputs',
        title: 'Inputs + textareas',
        description: 'Shared text, numeric, animated-number, multiline, and read-only field treatments.',
        sourcePath: 'components/ui/number-input.tsx',
        usagePaths: ['components/ui/input.tsx', 'components/CountryInfo.tsx', 'components/DetailsPanel.tsx'],
    },
    {
        id: 'selects',
        title: 'Select + dropdown',
        description: 'Shared Radix Select and admin dropdown/filter menu patterns.',
        sourcePath: 'components/ui/select.tsx',
        usagePaths: ['components/admin/AdminShell.tsx', 'pages/ProfileSettingsPage.tsx', 'components/admin/AdminFilterMenu.tsx'],
    },
    {
        id: 'travel_inputs',
        title: 'Country select + calendar',
        description: 'Create-trip destination selector variants and date-range calendar controls.',
        sourcePath: 'components/CountrySelect.tsx',
        usagePaths: ['pages/CreateTripClassicPage.tsx', 'pages/CreateTripV3Page.tsx', 'components/DateRangePicker.tsx'],
    },
    {
        id: 'switches',
        title: 'Switches + checkboxes',
        description: 'Boolean controls used for visibility toggles and batch-selection flows.',
        sourcePath: 'components/ui/switch.tsx',
        usagePaths: ['components/ui/checkbox.tsx', 'pages/ProfilePage.tsx', 'pages/ProfileSettingsPage.tsx'],
    },
    {
        id: 'tabs',
        title: 'Tabs + segmented controls',
        description: 'Tabbed navigation and segmented selectors used across profile and admin surfaces.',
        sourcePath: 'components/ui/tabs.tsx',
        usagePaths: ['pages/ProfilePage.tsx', 'pages/AdminOgToolsPage.tsx', 'components/profile/ProfileTripTabs.tsx'],
    },
    {
        id: 'dialogs',
        title: 'Dialogs + drawers + modals',
        description: 'Overlay primitives for confirmations, detail sheets, and structured modal content.',
        sourcePath: 'components/ui/dialog.tsx',
        usagePaths: ['components/ui/drawer.tsx', 'components/ui/app-modal.tsx', 'components/AppDialogProvider.tsx'],
    },
    {
        id: 'settings',
        title: 'Settings panels',
        description: 'Grouped settings surfaces: a card per product area, one caption column, one control track.',
        sourcePath: 'components/ui/settings-panel.tsx',
        usagePaths: ['pages/AdminGlobalSettingsPage.tsx', 'components/ui/label.tsx', 'docs/DESIGN_SYSTEM_COMPONENTS.md'],
    },
    {
        id: 'cards',
        title: 'Cards + badges + chips',
        description: 'Card containers and metadata badges used in admin and profile areas.',
        sourcePath: 'components/admin/AdminSurfaceCard.tsx',
        usagePaths: ['pages/AdminDashboardPage.tsx', 'components/profile/ProfileTripCard.tsx', 'pages/ProfileStampsPage.tsx'],
    },
    {
        id: 'admin',
        title: 'Admin workspace',
        description: 'The building blocks every admin screen is made from: stat tiles, section headers, status badges, empty and error states, charts and bar lists, the record detail sheet, the bulk-action bar and pagination.',
        sourcePath: 'components/admin/AdminStatCard.tsx',
        usagePaths: ['pages/AdminDashboardPage.tsx', 'components/admin/AdminDetailSheet.tsx', 'components/admin/AdminSelectionBar.tsx', 'docs/DESIGN_SYSTEM_COMPONENTS.md'],
    },
    {
        id: 'tables',
        title: 'Data tables',
        description: 'Shared admin table patterns for sticky columns, sorted-state highlights, and stable fixed-width layouts.',
        sourcePath: 'components/admin/AdminDataTable.tsx',
        usagePaths: ['pages/AdminUsersPage.tsx', 'pages/AdminTripsPage.tsx', 'pages/AdminAuditPage.tsx'],
    },
    {
        id: 'tooltips',
        title: 'Tooltip + popover patterns',
        description: 'Global tooltip layer and anchored popover/dropdown menu patterns.',
        sourcePath: 'components/GlobalTooltipLayer.tsx',
        usagePaths: ['components/profile/ProfileTripCard.tsx', 'components/admin/AdminFilterMenu.tsx', 'components/tripview/TripViewHeader.tsx'],
    },
];

const TOAST_SCENARIOS: ToastScenarioDefinition[] = [
    {
        id: 'trip_archived',
        label: 'Trip archived (remove + undo)',
        helperText: 'Destructive archive confirmation with inline undo action.',
    },
    {
        id: 'archive_undo_success',
        label: 'Archive undo success',
        helperText: 'Positive follow-up after restoring an archived trip.',
    },
    {
        id: 'batch_archive_completed',
        label: 'Batch archive completed',
        helperText: 'Batch destructive result summary with compact trip context.',
    },
    {
        id: 'profile_saved',
        label: 'Profile settings saved',
        helperText: 'Success confirmation for profile update actions.',
    },
    {
        id: 'share_link_copied',
        label: 'Share link copied',
        helperText: 'Informational toast for clipboard actions.',
    },
    {
        id: 'history_undo',
        label: 'History undo feedback',
        helperText: 'Undo feedback with directional icon variant.',
    },
    {
        id: 'history_redo',
        label: 'History redo feedback',
        helperText: 'Redo feedback with directional icon variant.',
    },
    {
        id: 'generic_warning',
        label: 'Generic warning',
        helperText: 'Non-blocking caution state for partial feature limits.',
    },
    {
        id: 'generic_error',
        label: 'Generic error',
        helperText: 'Blocking failure state with concise guidance.',
    },
    {
        id: 'loading_sample',
        label: 'Loading / in-progress',
        helperText: 'Long-running state that resolves into success.',
    },
];

const previewPanelClassName = 'rounded-lg border border-border bg-muted/40 p-4';
const subtleHeadingClassName = 'text-xs font-medium text-muted-foreground';
const sampleTileClassName = 'flex flex-col gap-2 rounded-lg border border-border bg-card p-3';

const ADMIN_STATUS_TONES: Array<{ tone: AdminStatusTone; label: string }> = [
    { tone: 'neutral', label: 'Draft' },
    { tone: 'info', label: 'Queued' },
    { tone: 'success', label: 'Succeeded' },
    { tone: 'warning', label: 'Running' },
    { tone: 'danger', label: 'Failed' },
    { tone: 'accent', label: 'Example' },
];

// Small inline samples so the chart demos never depend on live data.
const SAMPLE_STACKED_CHART_DATA = [
    { day: '2026-10-14', 'New users': 12, 'Returning users': 30 },
    { day: '2026-10-15', 'New users': 18, 'Returning users': 26 },
    { day: '2026-10-16', 'New users': 9, 'Returning users': 34 },
    { day: '2026-10-17', 'New users': 22, 'Returning users': 31 },
    { day: '2026-10-18', 'New users': 15, 'Returning users': 28 },
    { day: '2026-10-19', 'New users': 27, 'Returning users': 36 },
    { day: '2026-10-20', 'New users': 19, 'Returning users': 40 },
];
const SAMPLE_STACKED_CHART_CATEGORIES = ['New users', 'Returning users'] as const;

const SAMPLE_VERTICAL_CHART_DATA = [
    { country: 'Japan', Trips: 48 },
    { country: 'Italy', Trips: 36 },
    { country: 'Thailand', Trips: 29 },
    { country: 'Portugal', Trips: 21 },
    { country: 'Peru', Trips: 12 },
];

const GENERATION_TONE: Record<PlaygroundTableRow['generation'], AdminStatusTone> = {
    succeeded: 'success',
    running: 'warning',
    failed: 'danger',
};
const sampleAdminTableRows: PlaygroundTableRow[] = [
    {
        id: 'row-1',
        trip: 'Historic Rhodes & Lindos Island Escape',
        owner: 'owner@example.com',
        generation: 'succeeded',
        updated: '2026-03-03T09:42:00.000Z',
        uuid: '0bdc8a25-f9a3-4729-92fb-5615d13a79a1',
    },
    {
        id: 'row-2',
        trip: 'European Camino Pilgrimage Loop',
        owner: 'traveler@example.com',
        generation: 'running',
        updated: '2026-03-02T08:05:00.000Z',
        uuid: '116e963d-0de9-4636-83fa-6c6ba59cd568',
    },
    {
        id: 'row-3',
        trip: 'Peruvian Gastronomy & Andean Adventure',
        owner: 'planner@example.com',
        generation: 'failed',
        updated: '2026-03-01T16:18:00.000Z',
        uuid: '1ebf6254-ef71-4ebb-be78-e6fb23e0a481',
    },
];

const formatPlaygroundTimestamp = (value: string): string => new Date(value).toLocaleString();

const SAMPLE_BAR_LIST_ITEMS = [
    { key: 'de', name: 'Germany', value: 412 },
    { key: 'jp', name: 'Japan', value: 287 },
    { key: 'th', name: 'Thailand', value: 164 },
    { key: 'pt', name: 'Portugal', value: 98 },
];

const SAMPLE_SELECTION_ROWS = [
    { id: 'u-1', name: 'Mara Lindqvist', email: 'mara@example.com' },
    { id: 'u-2', name: 'Jonas Weber', email: 'jonas@example.com' },
    { id: 'u-3', name: 'Aiko Tanaka', email: 'aiko@example.com' },
];

const SAMPLE_PAGINATION_TOTAL = 240;
const SAMPLE_PAGINATION_PAGE_SIZE = 50;

const ComponentUsageReferences: React.FC<{ definition: ComponentGroupDefinition }> = ({ definition }) => (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
        <div className={subtleHeadingClassName}>Where used</div>
        <div className="flex flex-col gap-1.5 text-xs text-foreground">
            <p>
                Source component: <code className="rounded-sm bg-secondary px-1 py-0.5 font-mono text-xs">{definition.sourcePath}</code>
            </p>
            <div className="flex flex-wrap gap-1.5">
                {definition.usagePaths.map((usagePath) => (
                    <Badge key={`${definition.id}:${usagePath}`} variant="outline" className="font-mono font-normal text-muted-foreground">
                        {usagePath}
                    </Badge>
                ))}
            </div>
        </div>
    </div>
);

const GroupHeader: React.FC<{ definition: ComponentGroupDefinition }> = ({ definition }) => (
    <AdminSectionHeader title={definition.title} description={definition.description} />
);

export const AdminDesignSystemPlaygroundPage: React.FC = () => {
    const [activeGroup, setActiveGroup] = useState<ComponentGroupId>('buttons');
    const [notificationScenarioId, setNotificationScenarioId] = useState<ToastScenarioId>('trip_archived');
    const [appDialogResult, setAppDialogResult] = useState('No confirm/prompt result yet.');

    const [sampleSearchQuery, setSampleSearchQuery] = useState('');
    const [sampleSettingsChat, setSampleSettingsChat] = useState(true);
    const [sampleSettingsPreview, setSampleSettingsPreview] = useState(false);
    const [sampleSettingsStyle, setSampleSettingsStyle] = useState('standard');
    const [sampleSettingsAge, setSampleSettingsAge] = useState(3);
    const [sampleSelectValue, setSampleSelectValue] = useState('updated');
    const [sampleFilterValues, setSampleFilterValues] = useState<string[]>(['active']);
    const [sampleSwitchEnabled, setSampleSwitchEnabled] = useState(true);
    const [sampleCheckboxEnabled, setSampleCheckboxEnabled] = useState(true);
    const [sampleInnerTab, setSampleInnerTab] = useState<'overview' | 'details' | 'activity'>('overview');
    const [sampleDestinationValue, setSampleDestinationValue] = useState('Japan, Thailand');
    const [sampleCountryCode, setSampleCountryCode] = useState('DE');
    const [sampleStartDate, setSampleStartDate] = useState('2026-04-07');
    const [sampleEndDate, setSampleEndDate] = useState('2026-04-21');
    const [sampleNumberValue, setSampleNumberValue] = useState(12.5);
    const sampleTextInputId = React.useId();
    const sampleReadonlyInputId = React.useId();
    const sampleNumberInputId = React.useId();
    const [sampleTableSortKey, setSampleTableSortKey] = useState<PlaygroundTableSortKey>('updated');
    const [sampleTableSortDirection, setSampleTableSortDirection] = useState<'asc' | 'desc'>('desc');
    const [sampleSelectedTableRows, setSampleSelectedTableRows] = useState<Set<string>>(() => new Set(['row-1']));
    const [isSampleTableScrolledHorizontally, setIsSampleTableScrolledHorizontally] = useState(false);
    const [isSampleDetailSheetOpen, setIsSampleDetailSheetOpen] = useState(false);
    const [sampleBulkSelection, setSampleBulkSelection] = useState<Set<string>>(() => new Set());
    const [samplePaginationPage, setSamplePaginationPage] = useState(2);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { confirm: confirmDialog, prompt: promptDialog } = useAppDialog();

    const trackedGroupRef = useRef<ComponentGroupId | null>(null);
    const loadingToastTimerRef = useRef<number | null>(null);
    const sampleTableScrollRef = useRef<HTMLDivElement | null>(null);

    const activeGroupDefinition = useMemo(
        () => COMPONENT_GROUPS.find((group) => group.id === activeGroup) ?? COMPONENT_GROUPS[0],
        [activeGroup]
    );

    const activeNotificationScenario = useMemo(
        () => TOAST_SCENARIOS.find((scenario) => scenario.id === notificationScenarioId) ?? TOAST_SCENARIOS[0],
        [notificationScenarioId]
    );

    const sortedSampleTableRows = useMemo(() => {
        const compareText = (left: string, right: string): number => left.localeCompare(right, undefined, { sensitivity: 'base' });
        const compareDate = (left: string, right: string): number => {
            const leftMs = Date.parse(left);
            const rightMs = Date.parse(right);
            if (!Number.isFinite(leftMs) && !Number.isFinite(rightMs)) return 0;
            if (!Number.isFinite(leftMs)) return 1;
            if (!Number.isFinite(rightMs)) return -1;
            return leftMs - rightMs;
        };
        const next = Array.from(sampleAdminTableRows).sort((left, right) => {
            let result = 0;
            if (sampleTableSortKey === 'trip') result = compareText(left.trip, right.trip);
            if (sampleTableSortKey === 'owner') result = compareText(left.owner, right.owner);
            if (sampleTableSortKey === 'generation') result = compareText(left.generation, right.generation);
            if (sampleTableSortKey === 'updated') result = compareDate(left.updated, right.updated);
            if (result === 0) return left.id.localeCompare(right.id);
            return sampleTableSortDirection === 'asc' ? result : -result;
        });
        return next;
    }, [sampleTableSortDirection, sampleTableSortKey]);

    const isSampleTableSorted = useCallback((key: PlaygroundTableSortKey) => sampleTableSortKey === key, [sampleTableSortKey]);

    const toggleSampleTableSort = useCallback((key: PlaygroundTableSortKey) => {
        if (sampleTableSortKey !== key) {
            setSampleTableSortKey(key);
            setSampleTableSortDirection(key === 'updated' ? 'desc' : 'asc');
            return;
        }
        setSampleTableSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    }, [sampleTableSortKey]);

    const toggleSampleRowSelection = useCallback((rowId: string, checked: boolean) => {
        setSampleSelectedTableRows((current) => {
            const next = new Set(current);
            if (checked) next.add(rowId);
            else next.delete(rowId);
            return next;
        });
    }, []);

    const areAllSampleRowsSelected = sampleAdminTableRows.every((row) => sampleSelectedTableRows.has(row.id));
    const isSampleSelectionPartial = sampleSelectedTableRows.size > 0 && !areAllSampleRowsSelected;

    const toggleAllSampleRows = useCallback((checked: boolean) => {
        setSampleSelectedTableRows(checked ? new Set(sampleAdminTableRows.map((row) => row.id)) : new Set());
    }, []);

    const handleConfirmDefaultSample = useCallback(async () => {
        const confirmed = await confirmDialog(buildDecisionConfirmDialog({
            title: 'Update Roundtrip Endpoint?',
            message: 'This trip looks like a roundtrip. Also change the final city to "Kyoto"?',
            confirmLabel: 'Yes, Update Last City',
            cancelLabel: 'No, Keep As Is',
        }));
        setAppDialogResult(
            confirmed
                ? 'Default confirm accepted: roundtrip endpoint sync enabled.'
                : 'Default confirm cancelled: roundtrip endpoint remains unchanged.'
        );
    }, [confirmDialog]);

    const handleConfirmDangerSample = useCallback(async () => {
        const confirmed = await confirmDialog(buildDangerConfirmDialog({
            title: 'Hard delete trip',
            message: 'Hard-delete "Kyoto Rail Plan"? This cannot be undone.',
            confirmLabel: 'Hard delete',
        }));
        setAppDialogResult(
            confirmed
                ? 'Danger confirm accepted: destructive action confirmed.'
                : 'Danger confirm cancelled: destructive action aborted.'
        );
    }, [confirmDialog]);

    const handlePromptDangerSample = useCallback(async () => {
        const value = await promptDialog(buildTransferTargetPromptDialog({
            title: 'Transfer trip owner',
            message: 'Enter the target user email or UUID for this trip.',
            label: 'Target owner (email or UUID)',
            confirmLabel: 'Continue',
        }));
        if (value === null) {
            setAppDialogResult('Danger prompt cancelled: no transfer target provided.');
            return;
        }
        setAppDialogResult(`Danger prompt value captured: "${value}".`);
    }, [promptDialog]);

    const handlePromptOptionalSample = useCallback(async () => {
        const value = await promptDialog(buildTransferTargetPromptDialog({
            title: 'Duplicate trip',
            message: 'Optionally enter a target user email or UUID for the duplicated trip.',
            label: 'Target owner (optional)',
            defaultValue: '',
            confirmLabel: 'Duplicate',
            tone: 'default',
        }));
        if (value === null) {
            setAppDialogResult('Optional prompt cancelled: duplicate flow aborted.');
            return;
        }
        const trimmed = value.trim();
        setAppDialogResult(
            trimmed.length > 0
                ? `Optional prompt value captured: "${trimmed}".`
                : 'Optional prompt submitted with empty value (keep existing owner).'
        );
    }, [promptDialog]);

    const handlePromptUrlSample = useCallback(async () => {
        const value = await promptDialog(buildUrlPromptDialog());
        if (value === null) {
            setAppDialogResult('URL prompt cancelled: no link inserted.');
            return;
        }
        setAppDialogResult(`URL prompt accepted with value "${value}".`);
    }, [promptDialog]);

    useEffect(() => {
        trackEvent('admin__design_playground--open');
    }, []);

    useEffect(() => {
        if (trackedGroupRef.current === activeGroup) return;
        trackedGroupRef.current = activeGroup;
        trackEvent('admin__design_playground_component_group--view', { group_id: activeGroup });
    }, [activeGroup]);

    useEffect(() => () => {
        if (loadingToastTimerRef.current !== null) {
            window.clearTimeout(loadingToastTimerRef.current);
            loadingToastTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        const root = sampleTableScrollRef.current;
        const node = root?.querySelector<HTMLElement>('[data-slot="table-container"]');
        if (!node) return undefined;
        const handleScroll = () => {
            setIsSampleTableScrolledHorizontally(node.scrollLeft > 4);
        };
        handleScroll();
        node.addEventListener('scroll', handleScroll, { passive: true });
        return () => node.removeEventListener('scroll', handleScroll);
    }, [activeGroup]);

    const triggerNotificationScenario = useCallback((scenarioId: ToastScenarioId) => {
        trackEvent('admin__design_playground_toast--trigger', { scenario_id: scenarioId });

        if (scenarioId === 'trip_archived') {
            showAppToast({
                tone: 'remove',
                title: 'Trip archived',
                description: 'Your trip "Lisbon + Porto Escape" was archived successfully.',
                action: {
                    label: 'Undo',
                    onClick: () => {
                        showAppToast({
                            tone: 'add',
                            title: 'Archive undone',
                            description: 'Your trip "Lisbon + Porto Escape" was restored.',
                        });
                    },
                },
            });
            return;
        }

        if (scenarioId === 'archive_undo_success') {
            showAppToast({
                tone: 'add',
                title: 'Archive undone',
                description: '2 archived trips were restored to your profile list.',
            });
            return;
        }

        if (scenarioId === 'batch_archive_completed') {
            showAppToast({
                tone: 'remove',
                title: 'Trips archived',
                description: 'Archived 4 trips. "Kyoto Rail Plan", "Iceland Loop" +2.',
                action: {
                    label: 'Undo',
                    onClick: () => {
                        showAppToast({
                            tone: 'add',
                            title: 'Archive undone',
                            description: '4 trips were restored to your recent collection.',
                        });
                    },
                },
            });
            return;
        }

        if (scenarioId === 'profile_saved') {
            showAppToast({
                tone: 'success',
                title: 'Profile saved',
                description: 'Your profile settings were updated successfully.',
            });
            return;
        }

        if (scenarioId === 'share_link_copied') {
            showAppToast({
                tone: 'info',
                title: 'Share link',
                description: 'Link copied to clipboard.',
            });
            return;
        }

        if (scenarioId === 'history_undo') {
            showAppToast({
                tone: 'neutral',
                title: 'Undo',
                description: 'Reverted "Changed city duration in Tokyo".',
                iconVariant: 'undo',
            });
            return;
        }

        if (scenarioId === 'history_redo') {
            showAppToast({
                tone: 'neutral',
                title: 'Redo',
                description: 'Re-applied "Changed transport type".',
                iconVariant: 'redo',
            });
            return;
        }

        if (scenarioId === 'generic_warning') {
            showAppToast({
                tone: 'warning',
                title: 'Partial availability',
                description: 'Some preview assets are still loading. Retry in a moment.',
            });
            return;
        }

        if (scenarioId === 'generic_error') {
            showAppToast({
                tone: 'error',
                title: 'Action failed',
                description: 'Could not load preview data for this component set.',
            });
            return;
        }

        const loadingToastId = showAppToast({
            tone: 'loading',
            title: 'Preparing preview',
            description: 'Loading interaction states for the selected sample...',
            dismissible: false,
        });

        if (loadingToastTimerRef.current !== null) {
            window.clearTimeout(loadingToastTimerRef.current);
        }

        loadingToastTimerRef.current = window.setTimeout(() => {
            showAppToast({
                id: loadingToastId,
                tone: 'success',
                title: 'Preview ready',
                description: 'All sampled states loaded successfully.',
            });
            loadingToastTimerRef.current = null;
        }, 1400);
    }, []);

    const renderActiveGroupPreview = (): React.ReactNode => {
        if (activeGroup === 'buttons') {
            return (
                <div className={`${previewPanelClassName} flex flex-col gap-4`}>
                    <div className="flex flex-col gap-2">
                        <p className={subtleHeadingClassName}>Variants (components/ui/button)</p>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="button">Primary</Button>
                            <Button type="button" variant="outline">Secondary</Button>
                            <Button type="button" variant="secondary">Neutral</Button>
                            <Button type="button" variant="ghost">Ghost</Button>
                            <Button type="button" variant="soft">Soft accent</Button>
                            <Button type="button" variant="destructive">Destructive</Button>
                            <Button type="button" variant="link">Link</Button>
                            <Button type="button" variant="outline" size="icon" aria-label="Open quick action" data-tooltip="Open quick action">
                                <Bell />
                            </Button>
                            <Button type="button" disabled>Disabled</Button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <p className={subtleHeadingClassName}>Sizes for dense admin tables</p>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="button" size="lg">Large</Button>
                            <Button type="button" variant="outline">Default</Button>
                            <Button type="button" variant="outline" size="sm"><Plus /> Small</Button>
                            <Button type="button" variant="outline" size="xs">Extra small</Button>
                            <Button type="button" variant="ghost" size="icon-sm" aria-label="Delete sample row" data-tooltip="Delete sample row">
                                <Trash />
                            </Button>
                            <Button type="button" variant="outline" shortcut="⌘K" aria-keyshortcuts="Meta+K">
                                <MagnifyingGlass /> Search
                            </Button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <p className={subtleHeadingClassName}>Marketing, 404 and inspirations buttons (public pages only, never in admin)</p>
                        {/* Replicas of the public marketing CTAs. Their large radii and
                            shadows are intentional on those pages; they are catalogued
                            here, not reused, so they stay outside the admin geometry rules. */}
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <button
                                type="button"
                                className="rounded-2xl bg-accent-600 px-7 py-3 text-base font-bold text-white shadow-lg shadow-accent-200 transition-all hover:bg-accent-700 hover:shadow-xl hover:shadow-accent-300 hover:scale-[1.02] active:scale-[0.98] dark:shadow-none"
                            >
                                Hero / 404 primary CTA
                            </button>
                            <button
                                type="button"
                                className="rounded-2xl border border-border bg-card px-7 py-3 text-base font-bold text-foreground transition-all hover:border-slate-400 hover:scale-[1.02] active:scale-[0.98] dark:hover:border-slate-500"
                            >
                                Hero secondary action
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center gap-1 rounded-2xl border border-border bg-card px-6 py-3 text-sm font-bold text-foreground transition-all hover:border-accent-300 hover:text-accent-700 dark:hover:text-accent-200 dark:hover:border-accent-400/30"
                            >
                                Inspirations section action
                            </button>
                            <button
                                type="button"
                                className="rounded-2xl bg-card px-8 py-3.5 text-base font-bold text-accent-700 shadow-lg transition-all hover:bg-accent-50 hover:scale-[1.03] hover:shadow-xl active:scale-[0.98] dark:hover:bg-accent-400/12 dark:text-accent-200 dark:shadow-none"
                            >
                                Feature-page highlight CTA
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (activeGroup === 'inputs') {
            return (
                <div className={`${previewPanelClassName} grid gap-4 lg:grid-cols-2`}>
                    <div className="flex flex-col gap-1.5 lg:col-span-2">
                        <div className={subtleHeadingClassName}>Search input (shared)</div>
                        <SearchInput
                            placeholder="Search a provider or model…"
                            value={sampleSearchQuery}
                            onChange={(event) => setSampleSearchQuery(event.currentTarget.value)}
                            onClear={() => setSampleSearchQuery('')}
                        />
                        <p className="text-xs text-muted-foreground">
                            Icon and clear button are flex siblings of the field. Never rebuild this with an
                            absolutely positioned icon over a padded input — see docs/DESIGN_SYSTEM_COMPONENTS.md.
                        </p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <div className={subtleHeadingClassName}>Number input with steppers</div>
                        <NumberInput
                            aria-label="Sample stepper"
                            min={1}
                            max={36}
                            steppers
                            suffix=" months"
                            value={sampleSettingsAge}
                            className="w-40"
                            onChange={(event) => setSampleSettingsAge(Number(event.target.value) || 1)}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor={sampleTextInputId} className={subtleHeadingClassName}>Text input</label>
                        <Input
                            id={sampleTextInputId}
                            defaultValue="Tokyo City Highlights"
                            className="bg-card"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor={sampleReadonlyInputId} className={subtleHeadingClassName}>Readonly input</label>
                        <Input
                            id={sampleReadonlyInputId}
                            value="readonly_handle"
                            readOnly
                            className="bg-muted text-muted-foreground"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label htmlFor={sampleNumberInputId} className={subtleHeadingClassName}>Animated number input</label>
                        <NumberInput
                            id={sampleNumberInputId}
                            value={sampleNumberValue}
                            min="0"
                            step="0.5"
                            onChange={(event) => setSampleNumberValue(Number(event.target.value))}
                            format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
                            className="bg-card"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className={subtleHeadingClassName}>Animated display number</span>
                        <div className="flex h-10 items-center rounded-md border border-border bg-card px-3 text-sm text-foreground">
                            <AnimatedNumber
                                value={sampleNumberValue}
                                format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
                                suffix=" days"
                                className="font-semibold text-foreground"
                            />
                        </div>
                    </div>
                    <label className="flex flex-col gap-1.5 lg:col-span-2">
                        <span className={subtleHeadingClassName}>Textarea</span>
                        <Textarea
                            aria-label="Textarea"
                            rows={3}
                            defaultValue="This sample keeps the same spacing, border, and focus style used in profile/admin forms."
                        />
                    </label>
                </div>
            );
        }

        if (activeGroup === 'selects') {
            return (
                <div className={`${previewPanelClassName} grid gap-4 lg:grid-cols-2`}>
                    <div className="flex flex-col gap-2">
                        <div className={subtleHeadingClassName}>Shared select</div>
                        <Select value={sampleSelectValue} onValueChange={setSampleSelectValue}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choose sort" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="updated">Updated recently</SelectItem>
                                <SelectItem value="created">Created recently</SelectItem>
                                <SelectItem value="favorites">Favorites first</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className={subtleHeadingClassName}>Admin dropdown / popover menu</div>
                        <AdminFilterMenu
                            label="Trip status"
                            options={[
                                { value: 'active', label: 'Active', count: 82 },
                                { value: 'archived', label: 'Archived', count: 14 },
                                { value: 'expired', label: 'Expired', count: 11 },
                            ]}
                            selectedValues={sampleFilterValues}
                            onSelectedValuesChange={setSampleFilterValues}
                        />
                    </div>
                </div>
            );
        }

        if (activeGroup === 'travel_inputs') {
            return (
                <div className={`${previewPanelClassName} grid gap-4 lg:grid-cols-2`}>
                    <div className={sampleTileClassName}>
                        <div className={subtleHeadingClassName}>Create-trip destination select</div>
                        <CountrySelect value={sampleDestinationValue} onChange={setSampleDestinationValue} />
                    </div>
                    <div className={sampleTileClassName}>
                        <div className={subtleHeadingClassName}>Profile/admin country-region select</div>
                        <ProfileCountryRegionSelect
                            value={sampleCountryCode}
                            placeholder="Search country or region"
                            emptyLabel="No countries found"
                            toggleLabel="Toggle country options"
                            onValueChange={setSampleCountryCode}
                        />
                    </div>
                    <div className={`${sampleTileClassName} lg:col-span-2`}>
                        <div className={subtleHeadingClassName}>Create-trip date range calendar</div>
                        <DateRangePicker
                            startDate={sampleStartDate}
                            endDate={sampleEndDate}
                            onChange={(start, end) => {
                                setSampleStartDate(start);
                                setSampleEndDate(end);
                            }}
                        />
                    </div>
                </div>
            );
        }

        if (activeGroup === 'switches') {
            return (
                <div className={`${previewPanelClassName} grid gap-4 md:grid-cols-2`}>
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
                        <span className="text-sm font-medium text-foreground">Show only public trips</span>
                        <Switch checked={sampleSwitchEnabled} onCheckedChange={setSampleSwitchEnabled} aria-label="Show only public trips" />
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                        <Checkbox checked={sampleCheckboxEnabled} onCheckedChange={(value) => setSampleCheckboxEnabled(Boolean(value))} aria-label="Select trip for batch actions" />
                        <span className="text-sm font-medium text-foreground">Select trip for batch actions</span>
                    </label>
                </div>
            );
        }

        if (activeGroup === 'tabs') {
            return (
                <div className={previewPanelClassName}>
                    <Tabs value={sampleInnerTab} onValueChange={(value) => setSampleInnerTab(value as 'overview' | 'details' | 'activity')}>
                        <TabsList>
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="details">Details</TabsTrigger>
                            <TabsTrigger value="activity">Activity</TabsTrigger>
                        </TabsList>
                        <TabsContent value="overview" className="mt-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
                            Overview tab content sample.
                        </TabsContent>
                        <TabsContent value="details" className="mt-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
                            Details tab content sample.
                        </TabsContent>
                        <TabsContent value="activity" className="mt-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">
                            Activity tab content sample.
                        </TabsContent>
                    </Tabs>
                </div>
            );
        }

        if (activeGroup === 'dialogs') {
            return (
                <div className={`${previewPanelClassName} flex flex-col gap-3`}>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsDialogOpen(true)}
                        >
                            Open dialog
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsDrawerOpen(true)}
                        >
                            Open drawer
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsSidePanelOpen(true)}
                        >
                            Open side panel
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsModalOpen(true)}
                        >
                            Open app modal
                        </Button>
                    </div>

                    <div className={sampleTileClassName}>
                        <p className={subtleHeadingClassName}>Shared app dialog provider (confirm + prompt)</p>
                        <div className="grid gap-2 md:grid-cols-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    void handleConfirmDefaultSample();
                                }}
                            >
                                Open confirm dialog (default)
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => {
                                    void handleConfirmDangerSample();
                                }}
                            >
                                Open confirm dialog (danger)
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    void handlePromptDangerSample();
                                }}
                            >
                                Open prompt dialog (danger text)
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    void handlePromptOptionalSample();
                                }}
                            >
                                Open prompt dialog (optional text)
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="md:col-span-2"
                                onClick={() => {
                                    void handlePromptUrlSample();
                                }}
                            >
                                Open prompt dialog (URL + validate)
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {appDialogResult}
                        </p>
                    </div>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogContent size="md" showCloseButton>
                            <DialogHeader divided>
                                <DialogTitle>Dialog sample</DialogTitle>
                                <DialogDescription>
                                    Header, body and footer share one gutter. Only the body scrolls; the footer stays pinned.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogBody className="space-y-2 py-4">
                                {Array.from({ length: 30 }, (_, index) => (
                                    <p key={`dialog-sample-line-${index}`} className="text-sm text-muted-foreground">
                                        Line {index + 1} — scroll to see the footer hold its place while this region moves.
                                    </p>
                                ))}
                            </DialogBody>
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsDialogOpen(false)}
                                >
                                    Close
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                        <DrawerContent accessibleTitle="Drawer sample" accessibleDescription="Shared drawer primitive sample.">
                            <DrawerHeader>
                                <DrawerTitle>Drawer sample</DrawerTitle>
                                <DrawerDescription>Bottom sheet behavior from the shared drawer wrapper.</DrawerDescription>
                            </DrawerHeader>
                            <DrawerFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsDrawerOpen(false)}
                                >
                                    Close
                                </Button>
                            </DrawerFooter>
                        </DrawerContent>
                    </Drawer>

                    <Drawer open={isSidePanelOpen} onOpenChange={setIsSidePanelOpen} direction="right">
                        <DrawerContent
                            side="right"
                            className="w-[min(96vw,680px)] p-0"
                            accessibleTitle="Admin sidepanel sample"
                            accessibleDescription="Right-side panel used in admin detail workflows."
                        >
                            <div className="flex h-full flex-col">
                                <DrawerHeader className="border-b border-border">
                                    <DrawerTitle>Admin sidepanel sample</DrawerTitle>
                                    <DrawerDescription>Same right-side drawer pattern used by admin user and trip detail panes.</DrawerDescription>
                                </DrawerHeader>
                                <div className="flex-1 overflow-y-auto p-4 text-sm text-foreground">
                                    This sample mirrors the admin right-side detail panel behavior.
                                </div>
                                <DrawerFooter className="border-t border-border">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setIsSidePanelOpen(false)}
                                    >
                                        Close
                                    </Button>
                                </DrawerFooter>
                            </div>
                        </DrawerContent>
                    </Drawer>

                    <AppModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        title="App modal sample"
                        description="Modal shell wrapper with consistent desktop/mobile sizing behavior."
                        mobileSheet={false}
                    >
                        <p className="text-sm text-foreground">This modal preview is read-only and does not persist data.</p>
                    </AppModal>
                </div>
            );
        }

        if (activeGroup === 'settings') {
            return (
                <div className={`${previewPanelClassName} flex flex-col gap-4`}>
                    <SettingsGroup>
                        <SettingsCard
                            icon={<ChatCircleDots weight="duotone" />}
                            title="Trip Agent"
                            description="The planning chat inside a trip."
                        >
                            <SettingsRow label="Open to everyone" description="Every account whose plan allows the chat.">
                                <Switch
                                    checked={sampleSettingsChat}
                                    onCheckedChange={setSampleSettingsChat}
                                    aria-label="Open to everyone"
                                />
                            </SettingsRow>
                            <SettingsRow label="Administrator preview" description="Administrators keep access while it is off.">
                                <Switch
                                    checked={sampleSettingsPreview}
                                    onCheckedChange={setSampleSettingsPreview}
                                    aria-label="Administrator preview"
                                />
                            </SettingsRow>
                        </SettingsCard>

                        <SettingsCard
                            icon={<MapTrifold weight="duotone" />}
                            title="Map"
                            description="Which stack renders the map, and the style a visitor starts on."
                        >
                            <SettingsRow
                                label="Default style"
                                note="Anyone who picks a style themselves keeps their choice."
                            >
                                <Select value={sampleSettingsStyle} onValueChange={setSampleSettingsStyle}>
                                    <SelectTrigger className="w-full" aria-label="Default style">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SAMPLE_MAP_STYLE_OPTIONS.map((option) => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </SettingsRow>
                            <SettingsRow label="Age limit" description="Short inputs keep their own width and right-align.">
                                <NumberInput
                                    aria-label="Age limit"
                                    min={1}
                                    max={36}
                                    steppers
                                    suffix=" months"
                                    value={sampleSettingsAge}
                                    className="w-36"
                                    onChange={(event) => setSampleSettingsAge(Number(event.target.value) || 1)}
                                />
                            </SettingsRow>
                        </SettingsCard>
                    </SettingsGroup>

                    <div className="flex flex-col gap-2">
                        <div className={subtleHeadingClassName}>Alert tones</div>
                        <Alert variant="success">
                            <CheckCircle weight="duotone" />
                            <AlertDescription>Saved. Visitors pick the change up on their next page load.</AlertDescription>
                        </Alert>
                        <Alert variant="warning">
                            <WarningCircle weight="duotone" />
                            <AlertTitle>Migration pending</AlertTitle>
                            <AlertDescription>No deploy applies this; run it from the runbook.</AlertDescription>
                        </Alert>
                        <Alert variant="danger">
                            <WarningCircle weight="duotone" />
                            <AlertDescription>The save was refused.</AlertDescription>
                        </Alert>
                    </div>
                </div>
            );
        }

        if (activeGroup === 'cards') {
            return (
                <div className={`${previewPanelClassName} grid gap-4 lg:grid-cols-2`}>
                    <AdminSurfaceCard>
                        <AdminSectionHeader
                            as="h3"
                            title="Trip summary card"
                            description="One flat panel: rounded-lg, a one-pixel border, no shadow."
                            actions={<AdminStatusBadge tone="success">Active</AdminStatusBadge>}
                        />
                    </AdminSurfaceCard>
                    <AdminSurfaceCard className="flex flex-col gap-3">
                        <p className="text-sm font-semibold text-foreground">Badge + chip stack</p>
                        <div className="flex flex-wrap gap-2">
                            <AdminStatusBadge tone="accent">Example</AdminStatusBadge>
                            <AdminStatusBadge tone="danger">Archived</AdminStatusBadge>
                            <AdminStatusBadge tone="neutral" dot={false}>Private</AdminStatusBadge>
                            <Badge variant="secondary">Badge secondary</Badge>
                            <Badge variant="outline">Badge outline</Badge>
                        </div>
                    </AdminSurfaceCard>
                </div>
            );
        }

        if (activeGroup === 'admin') {
            return (
                <div className={`${previewPanelClassName} flex flex-col gap-6`}>
                    <div className="flex flex-col gap-2">
                        <p className={subtleHeadingClassName}>AdminStatCard</p>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <AdminStatCard
                                label="Total users"
                                value="1,284"
                                icon={<UsersThree />}
                                hint="+48 in the last 7 days"
                                hintTone="positive"
                            />
                            <AdminStatCard
                                label="Trips created"
                                value="3,912"
                                icon={<SuitcaseRolling />}
                                hint="12% fewer than last week"
                                hintTone="negative"
                            />
                            <AdminStatCard
                                label="Pending renders"
                                value="27"
                                hint="Queue above the usual 10"
                                hintTone="warning"
                            />
                            <AdminStatCard label="Plan mix" value="64%" hint="On the free tier">
                                <div className="flex flex-col gap-1.5">
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                                        <div className="h-full w-[64%] rounded-full bg-accent-500" />
                                    </div>
                                    <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                                        <span>Free 64%</span>
                                        <span>Paid 36%</span>
                                    </div>
                                </div>
                            </AdminStatCard>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <p className={subtleHeadingClassName}>AdminSectionHeader with actions</p>
                        <AdminSurfaceCard>
                            <AdminSectionHeader
                                as="h3"
                                title="Recent trips"
                                description="The latest trips across every account."
                                actions={(
                                    <>
                                        <AdminReloadButton onClick={() => undefined} />
                                        <Button type="button"><Plus /> New trip</Button>
                                    </>
                                )}
                            />
                        </AdminSurfaceCard>
                    </div>

                    <div className="flex flex-col gap-2">
                        <p className={subtleHeadingClassName}>AdminStatusBadge tones</p>
                        <div className="flex flex-wrap gap-2">
                            {ADMIN_STATUS_TONES.map(({ tone, label }) => (
                                <AdminStatusBadge key={tone} tone={tone}>{label} · {tone}</AdminStatusBadge>
                            ))}
                        </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <p className={subtleHeadingClassName}>AdminEmptyState</p>
                            <AdminEmptyState
                                className="bg-card"
                                icon={<SuitcaseRolling />}
                                title="No trips in this range"
                                description="Widen the date range or clear the search to see more trips."
                                action={<Button type="button" variant="outline" size="sm">Clear filters</Button>}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <p className={subtleHeadingClassName}>AdminErrorAlert</p>
                            <AdminErrorAlert
                                title="Could not load trips"
                                message="The trip list did not load. Reload to try again."
                                action={<Button type="button" variant="outline" size="xs">Retry</Button>}
                            />
                            <AdminErrorAlert message="The settings were not saved. Your changes are still here." />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <p className={subtleHeadingClassName}>AdminDetailSheet</p>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button type="button" variant="outline" onClick={() => setIsSampleDetailSheetOpen(true)}>
                                Open sample detail sheet
                            </Button>
                            <span className="text-xs text-muted-foreground">The one inspector for a record: fixed header, scrolling body, pinned footer.</span>
                        </div>
                        <AdminDetailSheet
                            open={isSampleDetailSheetOpen}
                            onOpenChange={setIsSampleDetailSheetOpen}
                            title="Mara Lindqvist"
                            subtitle="mara@example.com"
                            meta={<AdminStatusBadge tone="success">Active</AdminStatusBadge>}
                            footer={(
                                <>
                                    <Button type="button" onClick={() => setIsSampleDetailSheetOpen(false)}>Save changes</Button>
                                    <Button type="button" variant="outline" onClick={() => setIsSampleDetailSheetOpen(false)}>Cancel</Button>
                                    <Button type="button" variant="ghost" className="ms-auto text-destructive" onClick={() => setIsSampleDetailSheetOpen(false)}>Soft-delete user</Button>
                                </>
                            )}
                        >
                            <section className="flex flex-col gap-2">
                                <AdminSectionHeader as="h3" title="Account" description="Plan, sign-in method and activity." />
                                <dl className="grid grid-cols-2 gap-2 text-sm">
                                    <dt className="text-muted-foreground">Plan</dt><dd className="text-foreground">Explorer</dd>
                                    <dt className="text-muted-foreground">Sign-in</dt><dd className="text-foreground">Google</dd>
                                    <dt className="text-muted-foreground">Trips</dt><dd className="text-foreground tabular-nums">12</dd>
                                </dl>
                            </section>
                            <section className="flex flex-col gap-2 border-t border-border pt-4">
                                <AdminSectionHeader as="h3" title="Recent trips" />
                                <p className="text-sm text-muted-foreground">Sections stack with an <code className="font-mono text-xs">h3</code> header each; actions live in the footer.</p>
                            </section>
                        </AdminDetailSheet>
                    </div>

                    <div className="flex flex-col gap-2">
                        <p className={subtleHeadingClassName}>AdminSelectionBar + AdminPagination</p>
                        <AdminSurfaceCard className="flex flex-col gap-3 p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-10 ps-4">
                                            <Checkbox
                                                checked={sampleBulkSelection.size === SAMPLE_SELECTION_ROWS.length
                                                    ? true
                                                    : (sampleBulkSelection.size > 0 ? 'indeterminate' : false)}
                                                onCheckedChange={(checked) => setSampleBulkSelection(checked
                                                    ? new Set(SAMPLE_SELECTION_ROWS.map((row) => row.id))
                                                    : new Set())}
                                                aria-label="Select all sample users"
                                            />
                                        </TableHead>
                                        <TableHead>User</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {SAMPLE_SELECTION_ROWS.map((row) => {
                                        const isSelected = sampleBulkSelection.has(row.id);
                                        return (
                                            <TableRow key={row.id} data-state={isSelected ? 'selected' : undefined}>
                                                <TableCell className="ps-4">
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={(checked) => setSampleBulkSelection((current) => {
                                                            const next = new Set(current);
                                                            if (checked) next.add(row.id);
                                                            else next.delete(row.id);
                                                            return next;
                                                        })}
                                                        aria-label={`Select ${row.name}`}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm font-medium text-foreground">{row.name}</div>
                                                    <div className="text-xs text-muted-foreground">{row.email}</div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                            <AdminPagination
                                className="px-4 pb-3"
                                page={samplePaginationPage}
                                pageSize={SAMPLE_PAGINATION_PAGE_SIZE}
                                totalItems={SAMPLE_PAGINATION_TOTAL}
                                onPageChange={setSamplePaginationPage}
                                noun="users"
                            />
                        </AdminSurfaceCard>
                        <AdminSelectionBar
                            count={sampleBulkSelection.size}
                            noun="user"
                            onClear={() => setSampleBulkSelection(new Set())}
                        >
                            <Button type="button" variant="outline" size="sm">Export</Button>
                            <Button type="button" variant="destructive" size="sm">Soft-delete</Button>
                        </AdminSelectionBar>
                        <p className="text-xs text-muted-foreground">Select a row: the bar appears only while something is selected.</p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <AdminSurfaceCard className="flex flex-col gap-3">
                            <AdminSectionHeader as="h3" title="AdminBarChart, stacked" description="Daily signups split by new and returning users." />
                            <AdminBarChart
                                data={SAMPLE_STACKED_CHART_DATA}
                                index="day"
                                categories={SAMPLE_STACKED_CHART_CATEGORIES}
                                colors={['indigo', 'emerald']}
                                stack
                                className="h-56"
                                ariaLabel="Sample stacked bar chart of daily new and returning users"
                            />
                        </AdminSurfaceCard>
                        <AdminSurfaceCard className="flex flex-col gap-3">
                            <AdminSectionHeader as="h3" title="AdminAreaChart" description="New users per day as a trend." />
                            <AdminAreaChart
                                data={SAMPLE_STACKED_CHART_DATA}
                                index="day"
                                categories={['New users']}
                                colors={['violet']}
                                showLegend={false}
                                className="h-56"
                                ariaLabel="Sample area chart of new users per day"
                            />
                        </AdminSurfaceCard>
                        <AdminSurfaceCard className="flex flex-col gap-3 lg:col-span-2">
                            <AdminSectionHeader as="h3" title="AdminDonutChart" description="Trips per destination country." />
                            <AdminDonutChart
                                data={SAMPLE_VERTICAL_CHART_DATA}
                                index="country"
                                category="Trips"
                                className="h-56"
                                ariaLabel="Sample donut chart of trips per country"
                            />
                        </AdminSurfaceCard>
                    </div>

                    <AdminSurfaceCard className="flex max-w-xl flex-col gap-3">
                        <AdminSectionHeader as="h3" title="AdminBarList" description="Top destination countries, each row's share of the leader." />
                        <AdminBarList data={SAMPLE_BAR_LIST_ITEMS} ariaLabel="Sample bar list of trips per country" sortOrder="descending" />
                    </AdminSurfaceCard>
                </div>
            );
        }

        if (activeGroup === 'tables') {
            return (
                <div className={`${previewPanelClassName} flex flex-col gap-3`}>
                    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                        Reference wrapper: `Table` provides `overflow-x-auto` + `overscroll-behavior: none`; admin list tables keep explicit sticky key-column widths while non-sticky columns auto-size from content.
                    </div>
                    <div ref={sampleTableScrollRef} className="overflow-hidden rounded-lg border border-border bg-card">
                        <Table className="w-[max(100%,980px)]">
                            <TableHeader className="bg-secondary">
                                <TableRow>
                                    <TableHead
                                        className={`sticky left-0 z-40 w-[56px] min-w-[56px] max-w-[56px] px-2 py-3 ${getAdminStickyHeaderCellClass({
                                            isScrolled: isSampleTableScrolledHorizontally,
                                            isFirst: true,
                                        })}`}
                                        style={{ width: 56, minWidth: 56, maxWidth: 56 }}
                                    >
                                        <Checkbox
                                            checked={areAllSampleRowsSelected ? true : (isSampleSelectionPartial ? 'indeterminate' : false)}
                                            onCheckedChange={(checked) => toggleAllSampleRows(Boolean(checked))}
                                            aria-label="Select all sample rows"
                                        />
                                    </TableHead>
                                    <TableHead
                                        className={`sticky left-[56px] z-30 w-[320px] min-w-[320px] max-w-[320px] px-4 py-3 font-medium text-muted-foreground ${getAdminStickyHeaderCellClass({
                                            isScrolled: isSampleTableScrolledHorizontally,
                                            isFirst: false,
                                            isSorted: isSampleTableSorted('trip'),
                                        })}`}
                                        style={{ width: 320, minWidth: 320, maxWidth: 320 }}
                                    >
                                        <AdminSortHeaderButton
                                            label="Trip"
                                            isActive={isSampleTableSorted('trip')}
                                            direction={sampleTableSortDirection}
                                            onClick={() => toggleSampleTableSort('trip')}
                                        />
                                    </TableHead>
                                    <TableHead className={`px-4 py-3 font-medium text-muted-foreground ${isSampleTableSorted('owner') ? ADMIN_TABLE_SORTED_HEADER_CLASS : ''}`}>
                                        <AdminSortHeaderButton
                                            label="Owner"
                                            isActive={isSampleTableSorted('owner')}
                                            direction={sampleTableSortDirection}
                                            onClick={() => toggleSampleTableSort('owner')}
                                        />
                                    </TableHead>
                                    <TableHead className={`px-4 py-3 font-medium text-muted-foreground ${isSampleTableSorted('generation') ? ADMIN_TABLE_SORTED_HEADER_CLASS : ''}`}>
                                        <AdminSortHeaderButton
                                            label="Generation"
                                            isActive={isSampleTableSorted('generation')}
                                            direction={sampleTableSortDirection}
                                            onClick={() => toggleSampleTableSort('generation')}
                                        />
                                    </TableHead>
                                    <TableHead className={`px-4 py-3 font-medium text-muted-foreground ${isSampleTableSorted('updated') ? ADMIN_TABLE_SORTED_HEADER_CLASS : ''}`}>
                                        <AdminSortHeaderButton
                                            label="Last update"
                                            isActive={isSampleTableSorted('updated')}
                                            direction={sampleTableSortDirection}
                                            onClick={() => toggleSampleTableSort('updated')}
                                        />
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedSampleTableRows.map((row) => {
                                    const isSelected = sampleSelectedTableRows.has(row.id);
                                    return (
                                        <TableRow
                                            key={row.id}
                                            className={ADMIN_TABLE_ROW_SURFACE_CLASS}
                                            data-state={isSelected ? 'selected' : undefined}
                                        >
                                            <TableCell
                                                className={`sticky left-0 z-40 w-[56px] min-w-[56px] max-w-[56px] px-2 py-3 ${getAdminStickyBodyCellClass({
                                                    isSelected,
                                                    isScrolled: isSampleTableScrolledHorizontally,
                                                    isFirst: true,
                                                })}`}
                                                style={{ width: 56, minWidth: 56, maxWidth: 56 }}
                                            >
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={(checked) => toggleSampleRowSelection(row.id, Boolean(checked))}
                                                    aria-label={`Select sample row ${row.trip}`}
                                                />
                                            </TableCell>
                                            <TableCell
                                                className={`sticky left-[56px] z-30 w-[320px] min-w-[320px] max-w-[320px] px-4 py-3 ${getAdminStickyBodyCellClass({
                                                    isSelected,
                                                    isScrolled: isSampleTableScrolledHorizontally,
                                                    isFirst: false,
                                                    isSorted: isSampleTableSorted('trip'),
                                                })}`}
                                                style={{ width: 320, minWidth: 320, maxWidth: 320 }}
                                            >
                                                <div className="truncate text-sm font-semibold text-foreground">{row.trip}</div>
                                                <div className="truncate text-xs text-muted-foreground">{row.uuid}</div>
                                            </TableCell>
                                            <TableCell className={`px-4 py-3 text-sm text-foreground ${isSampleTableSorted('owner') ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                                {row.owner}
                                            </TableCell>
                                            <TableCell className={`px-4 py-3 ${isSampleTableSorted('generation') ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                                <AdminStatusBadge tone={GENERATION_TONE[row.generation]}>
                                                    {row.generation}
                                                </AdminStatusBadge>
                                            </TableCell>
                                            <TableCell className={`px-4 py-3 text-sm text-foreground ${isSampleTableSorted('updated') ? ADMIN_TABLE_SORTED_CELL_CLASS : ''}`}>
                                                {formatPlaygroundTimestamp(row.updated)}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            );
        }

        return (
            <div className={`${previewPanelClassName} grid gap-4 lg:grid-cols-2`}>
                <div className={sampleTileClassName}>
                    <p className={subtleHeadingClassName}>Global tooltip sample</p>
                    <Button
                        type="button"
                        variant="outline"
                        className="w-fit"
                        data-tooltip="Shows destination metadata"
                    >
                        Hover me (tooltip)
                    </Button>
                </div>
                <div className={sampleTileClassName}>
                    <p className={subtleHeadingClassName}>Popover / anchored menu sample</p>
                    <AdminFilterMenu
                        label="Team members"
                        options={[
                            { value: 'design', label: 'Design', count: 4 },
                            { value: 'product', label: 'Product', count: 3 },
                            { value: 'engineering', label: 'Engineering', count: 7 },
                        ]}
                        selectedValues={sampleFilterValues}
                        onSelectedValuesChange={setSampleFilterValues}
                    />
                </div>
            </div>
        );
    };

    return (
        <AdminShell
            title="Design system"
            description="Read-only lab for shared components, interaction states and notification QA."
            showGlobalSearch={false}
            showDateRange={false}
        >
            <div className="flex flex-col gap-6">
                <AdminSurfaceCard className="flex flex-col gap-4">
                    <AdminSectionHeader
                        title="Shared UI inventory"
                        description="Preview component families and states side by side. Nothing on this page persists."
                        actions={(
                            <AdminStatusBadge tone="neutral" dot={false}>
                                <Eye size={12} weight="duotone" aria-hidden="true" />
                                Admin-only preview lab
                            </AdminStatusBadge>
                        )}
                    />

                    <Tabs value={activeGroup} onValueChange={(value) => setActiveGroup(value as ComponentGroupId)}>
                        <TabsList className="h-auto w-full flex-wrap justify-start">
                            {COMPONENT_GROUPS.map((group) => (
                                <TabsTrigger
                                    key={group.id}
                                    value={group.id}
                                    className="flex-none"
                                    {...getAnalyticsDebugAttributes('admin__design_playground_component_group--view', {
                                        group_id: group.id,
                                    })}
                                >
                                    {group.title}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        {COMPONENT_GROUPS.map((group) => (
                            <TabsContent key={`group:${group.id}`} value={group.id} className="flex flex-col gap-4 pt-2">
                                <GroupHeader definition={group} />
                                <ComponentUsageReferences definition={group} />
                                {group.id === activeGroupDefinition.id && renderActiveGroupPreview()}
                            </TabsContent>
                        ))}
                    </Tabs>
                </AdminSurfaceCard>

                <AdminSurfaceCard className="flex flex-col gap-4">
                    <AdminSectionHeader
                        title="Toast scenario trigger"
                        description={<>Trigger canonical toast variants through the shared <code className="font-mono text-xs">showAppToast(...)</code> pipeline for manual QA.</>}
                    />

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                        <div className="flex flex-col gap-1.5">
                            <Select
                                value={notificationScenarioId}
                                onValueChange={(value) => setNotificationScenarioId(value as ToastScenarioId)}
                            >
                                <SelectTrigger aria-label="Notification scenario">
                                    <SelectValue placeholder="Choose a scenario" />
                                </SelectTrigger>
                                <SelectContent>
                                    {TOAST_SCENARIOS.map((scenario) => (
                                        <SelectItem key={scenario.id} value={scenario.id}>
                                            {scenario.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">{activeNotificationScenario.helperText}</p>
                        </div>

                        <Button
                            type="button"
                            onClick={() => triggerNotificationScenario(notificationScenarioId)}
                            {...getAnalyticsDebugAttributes('admin__design_playground_toast--trigger', {
                                scenario_id: notificationScenarioId,
                            })}
                        >
                            <Bell weight="duotone" aria-hidden="true" />
                            Trigger toast
                        </Button>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {TOAST_SCENARIOS.map((scenario) => (
                            <Button
                                key={`quick-toast:${scenario.id}`}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="justify-start text-start"
                                onClick={() => {
                                    setNotificationScenarioId(scenario.id);
                                    triggerNotificationScenario(scenario.id);
                                }}
                            >
                                <Bell weight="duotone" className="text-muted-foreground" aria-hidden="true" />
                                <span className="truncate">{scenario.label}</span>
                            </Button>
                        ))}
                    </div>
                </AdminSurfaceCard>

                <AdminSurfaceCard className="flex flex-col gap-3">
                    <AdminSectionHeader title="Current playground intent" />
                    <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                        <li className="flex items-start gap-2"><PaintBrush size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" /> Mirrors the shared component patterns that screens actually use.</li>
                        <li className="flex items-start gap-2"><SlidersHorizontal size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" /> Keeps interactions local only; no backend writes, no profile or trip persistence side effects.</li>
                        <li className="flex items-start gap-2"><Bell size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" /> The notification lab fires only through <code className="font-mono text-xs">showAppToast(...)</code> for consistent UX and QA parity.</li>
                        <li className="flex items-start gap-2"><Eye size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" /> New shared components land in this playground before broad rollout, and are listed here when added.</li>
                        <li className="flex items-start gap-2"><PaintBrush size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" /> Public-site sections and cards (globe, CTA, trip and blog cards) are tuned in the unlisted component playground at <code className="font-mono text-xs">/admin/component-playground</code>, which copies their settings back into code.</li>
                    </ul>
                </AdminSurfaceCard>
            </div>
        </AdminShell>
    );
};
