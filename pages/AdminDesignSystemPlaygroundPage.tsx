import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Eye, PaintBrush, SlidersHorizontal } from '@phosphor-icons/react';
import { AdminShell } from '../components/admin/AdminShell';
import { AdminFilterMenu } from '../components/admin/AdminFilterMenu';
import { AdminSurfaceCard } from '../components/admin/AdminSurfaceCard';
import { CountrySelect } from '../components/CountrySelect';
import { DateRangePicker } from '../components/DateRangePicker';
import { ProfileCountryRegionSelect } from '../components/profile/ProfileCountryRegionSelect';
import { AppModal } from '../components/ui/app-modal';
import { showAppToast } from '../components/ui/appToast';
import { Checkbox } from '../components/ui/checkbox';
import {
    Dialog,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { getAnalyticsDebugAttributes, trackEvent } from '../services/analyticsService';

type ComponentGroupId =
    | 'buttons'
    | 'inputs'
    | 'selects'
    | 'travel_inputs'
    | 'switches'
    | 'tabs'
    | 'dialogs'
    | 'cards'
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

const COMPONENT_GROUPS: ComponentGroupDefinition[] = [
    {
        id: 'buttons',
        title: 'Buttons',
        description: 'Primary, secondary, neutral, destructive, and icon-only button treatments currently in use.',
        sourcePath: 'components/navigation/SiteHeader.tsx',
        usagePaths: ['pages/ProfilePage.tsx', 'components/TripManager.tsx', 'pages/AdminUsersPage.tsx'],
    },
    {
        id: 'inputs',
        title: 'Inputs + Textareas',
        description: 'Shared form field styles for text, multiline, and read-only states.',
        sourcePath: 'pages/ProfileSettingsPage.tsx',
        usagePaths: ['pages/ProfileSettingsPage.tsx', 'pages/AdminTripsPage.tsx', 'pages/AdminOgToolsPage.tsx'],
    },
    {
        id: 'selects',
        title: 'Select + Dropdown',
        description: 'Shared Radix Select and admin dropdown/filter menu patterns.',
        sourcePath: 'components/ui/select.tsx',
        usagePaths: ['components/admin/AdminShell.tsx', 'pages/ProfileSettingsPage.tsx', 'components/admin/AdminFilterMenu.tsx'],
    },
    {
        id: 'travel_inputs',
        title: 'Country Select + Calendar',
        description: 'Create-trip destination selector variants and date-range calendar controls.',
        sourcePath: 'components/CountrySelect.tsx',
        usagePaths: ['pages/CreateTripV1Page.tsx', 'pages/CreateTripV3Page.tsx', 'components/DateRangePicker.tsx'],
    },
    {
        id: 'switches',
        title: 'Switches + Checkboxes',
        description: 'Boolean controls used for visibility toggles and batch-selection flows.',
        sourcePath: 'components/ui/switch.tsx',
        usagePaths: ['components/ui/checkbox.tsx', 'pages/ProfilePage.tsx', 'pages/ProfileSettingsPage.tsx'],
    },
    {
        id: 'tabs',
        title: 'Tabs + Segmented Controls',
        description: 'Tabbed navigation and segmented selectors used across profile and admin surfaces.',
        sourcePath: 'components/ui/tabs.tsx',
        usagePaths: ['pages/ProfilePage.tsx', 'pages/AdminOgToolsPage.tsx', 'components/profile/ProfileTripTabs.tsx'],
    },
    {
        id: 'dialogs',
        title: 'Dialogs + Drawers + Modals',
        description: 'Overlay primitives for confirmations, detail sheets, and structured modal content.',
        sourcePath: 'components/ui/dialog.tsx',
        usagePaths: ['components/ui/drawer.tsx', 'components/ui/app-modal.tsx', 'components/DeleteCityModal.tsx'],
    },
    {
        id: 'cards',
        title: 'Cards + Badges + Chips',
        description: 'Card containers and metadata badges used in admin and profile areas.',
        sourcePath: 'components/admin/AdminSurfaceCard.tsx',
        usagePaths: ['pages/AdminDashboardPage.tsx', 'components/profile/ProfileTripCard.tsx', 'pages/ProfileStampsPage.tsx'],
    },
    {
        id: 'tooltips',
        title: 'Tooltip + Popover Patterns',
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

const usagePillClassName = 'rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600';
const previewPanelClassName = 'rounded-2xl border border-slate-200 bg-slate-50 p-4';
const subtleHeadingClassName = 'text-xs font-semibold uppercase tracking-[0.12em] text-slate-500';

const ComponentUsageReferences: React.FC<{ definition: ComponentGroupDefinition }> = ({ definition }) => (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white px-3 py-3">
        <div className={subtleHeadingClassName}>Where used</div>
        <div className="space-y-1.5 text-xs text-slate-700">
            <p>
                Source component: <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">{definition.sourcePath}</code>
            </p>
            <div className="flex flex-wrap gap-1.5">
                {definition.usagePaths.map((usagePath) => (
                    <span key={`${definition.id}:${usagePath}`} className={usagePillClassName}>
                        {usagePath}
                    </span>
                ))}
            </div>
        </div>
    </div>
);

const GroupHeader: React.FC<{ definition: ComponentGroupDefinition }> = ({ definition }) => (
    <header className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">{definition.title}</h2>
        <p className="text-sm text-slate-600">{definition.description}</p>
    </header>
);

export const AdminDesignSystemPlaygroundPage: React.FC = () => {
    const [activeGroup, setActiveGroup] = useState<ComponentGroupId>('buttons');
    const [notificationScenarioId, setNotificationScenarioId] = useState<ToastScenarioId>('trip_archived');

    const [sampleSelectValue, setSampleSelectValue] = useState('updated');
    const [sampleFilterValues, setSampleFilterValues] = useState<string[]>(['active']);
    const [sampleSwitchEnabled, setSampleSwitchEnabled] = useState(true);
    const [sampleCheckboxEnabled, setSampleCheckboxEnabled] = useState(true);
    const [sampleInnerTab, setSampleInnerTab] = useState<'overview' | 'details' | 'activity'>('overview');
    const [sampleDestinationValue, setSampleDestinationValue] = useState('Japan, Thailand');
    const [sampleCountryCode, setSampleCountryCode] = useState('DE');
    const [sampleStartDate, setSampleStartDate] = useState('2026-04-07');
    const [sampleEndDate, setSampleEndDate] = useState('2026-04-21');

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const trackedGroupRef = useRef<ComponentGroupId | null>(null);
    const loadingToastTimerRef = useRef<number | null>(null);

    const activeGroupDefinition = useMemo(
        () => COMPONENT_GROUPS.find((group) => group.id === activeGroup) ?? COMPONENT_GROUPS[0],
        [activeGroup]
    );

    const activeNotificationScenario = useMemo(
        () => TOAST_SCENARIOS.find((scenario) => scenario.id === notificationScenarioId) ?? TOAST_SCENARIOS[0],
        [notificationScenarioId]
    );

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
                <div className={`${previewPanelClassName} space-y-4`}>
                    <div className="space-y-2">
                        <p className={subtleHeadingClassName}>Product buttons (app surfaces)</p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <button type="button" className="rounded-lg bg-accent-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-accent-700">
                                Primary
                            </button>
                            <button type="button" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                                Secondary
                            </button>
                            <button type="button" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800 transition hover:bg-rose-100">
                                Destructive
                            </button>
                            <button type="button" className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50" aria-label="Open quick action" title="Open quick action">
                                <Bell size={16} />
                            </button>
                            <button type="button" disabled className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-400">
                                Disabled
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className={subtleHeadingClassName}>Marketing + 404 + inspirations buttons</p>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <button
                                type="button"
                                className="rounded-2xl bg-accent-600 px-7 py-3 text-base font-bold text-white shadow-lg shadow-accent-200 transition-all hover:bg-accent-700 hover:shadow-xl hover:shadow-accent-300 hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Hero / 404 primary CTA
                            </button>
                            <button
                                type="button"
                                className="rounded-2xl border border-slate-300 bg-white px-7 py-3 text-base font-bold text-slate-700 transition-all hover:border-slate-400 hover:text-slate-900 hover:shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Hero secondary action
                            </button>
                            <button
                                type="button"
                                className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-accent-300 hover:text-accent-700 hover:shadow-md"
                            >
                                Inspirations section action
                            </button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <p className={subtleHeadingClassName}>Feature-page highlight CTA</p>
                        <button
                            type="button"
                            className="rounded-2xl bg-white px-8 py-3.5 text-base font-bold text-accent-700 shadow-lg transition-all hover:bg-accent-50 hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]"
                        >
                            Primary
                        </button>
                    </div>
                </div>
            );
        }

        if (activeGroup === 'inputs') {
            return (
                <div className={`${previewPanelClassName} grid gap-3 lg:grid-cols-2`}>
                    <label className="space-y-1">
                        <span className={subtleHeadingClassName}>Text input</span>
                        <input
                            defaultValue="Tokyo City Highlights"
                            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                        />
                    </label>
                    <label className="space-y-1">
                        <span className={subtleHeadingClassName}>Readonly input</span>
                        <input
                            value="readonly_handle"
                            readOnly
                            className="h-10 w-full rounded-md border border-slate-200 bg-slate-100 px-3 text-sm text-slate-600"
                        />
                    </label>
                    <label className="space-y-1 lg:col-span-2">
                        <span className={subtleHeadingClassName}>Textarea</span>
                        <textarea
                            rows={3}
                            defaultValue="This sample keeps the same spacing, border, and focus style used in profile/admin forms."
                            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent-400 focus:ring-2 focus:ring-accent-200"
                        />
                    </label>
                </div>
            );
        }

        if (activeGroup === 'selects') {
            return (
                <div className={`${previewPanelClassName} grid gap-4 lg:grid-cols-2`}>
                    <div className="space-y-2">
                        <div className={subtleHeadingClassName}>Shared Select</div>
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

                    <div className="space-y-2">
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
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                        <div className={subtleHeadingClassName}>Create-trip destination select</div>
                        <CountrySelect value={sampleDestinationValue} onChange={setSampleDestinationValue} />
                    </div>
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                        <div className={subtleHeadingClassName}>Profile/admin country-region select</div>
                        <ProfileCountryRegionSelect
                            value={sampleCountryCode}
                            placeholder="Search country or region"
                            emptyLabel="No countries found"
                            toggleLabel="Toggle country options"
                            onValueChange={setSampleCountryCode}
                        />
                    </div>
                    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 lg:col-span-2">
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
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <span className="text-sm font-medium text-slate-700">Show only public trips</span>
                        <Switch checked={sampleSwitchEnabled} onCheckedChange={setSampleSwitchEnabled} />
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <Checkbox checked={sampleCheckboxEnabled} onCheckedChange={(value) => setSampleCheckboxEnabled(Boolean(value))} />
                        <span className="text-sm font-medium text-slate-700">Select trip for batch actions</span>
                    </div>
                </div>
            );
        }

        if (activeGroup === 'tabs') {
            return (
                <div className={previewPanelClassName}>
                    <Tabs value={sampleInnerTab} onValueChange={(value) => setSampleInnerTab(value as 'overview' | 'details' | 'activity')}>
                        <TabsList variant="default" className="border border-slate-200 bg-white p-1">
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="details">Details</TabsTrigger>
                            <TabsTrigger value="activity">Activity</TabsTrigger>
                        </TabsList>
                        <TabsContent value="overview" className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                            Overview tab content sample.
                        </TabsContent>
                        <TabsContent value="details" className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                            Details tab content sample.
                        </TabsContent>
                        <TabsContent value="activity" className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                            Activity tab content sample.
                        </TabsContent>
                    </Tabs>
                </div>
            );
        }

        if (activeGroup === 'dialogs') {
            return (
                <div className={`${previewPanelClassName} space-y-3`}>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setIsDialogOpen(true)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            Open Dialog
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsDrawerOpen(true)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            Open Drawer
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsSidePanelOpen(true)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            Open Sidepanel
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(true)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                            Open App Modal
                        </button>
                    </div>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Dialog sample</DialogTitle>
                                <DialogDescription>Shared dialog primitive used by multiple admin and app overlays.</DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <button
                                    type="button"
                                    onClick={() => setIsDialogOpen(false)}
                                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700"
                                >
                                    Close
                                </button>
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
                                <button
                                    type="button"
                                    onClick={() => setIsDrawerOpen(false)}
                                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700"
                                >
                                    Close
                                </button>
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
                                <DrawerHeader className="border-b border-slate-200">
                                    <DrawerTitle>Admin sidepanel sample</DrawerTitle>
                                    <DrawerDescription>Same right-side drawer pattern used by admin user and trip detail panes.</DrawerDescription>
                                </DrawerHeader>
                                <div className="flex-1 overflow-y-auto p-4 text-sm text-slate-700">
                                    This sample mirrors the admin right-side detail panel behavior.
                                </div>
                                <DrawerFooter className="border-t border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => setIsSidePanelOpen(false)}
                                        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700"
                                    >
                                        Close
                                    </button>
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
                        <p className="text-sm text-slate-700">This modal preview is read-only and does not persist data.</p>
                    </AppModal>
                </div>
            );
        }

        if (activeGroup === 'cards') {
            return (
                <div className={`${previewPanelClassName} grid gap-4 lg:grid-cols-2`}>
                    <AdminSurfaceCard>
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-sm font-semibold text-slate-900">Trip summary card</p>
                                <p className="mt-1 text-xs text-slate-600">Card container with consistent admin border/shadow treatment.</p>
                            </div>
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">Active</span>
                        </div>
                    </AdminSurfaceCard>
                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-sm font-semibold text-slate-900">Badge + chip stack</p>
                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-accent-200 bg-accent-50 px-2 py-1 text-[11px] font-semibold text-accent-800">Example</span>
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-800">Archived</span>
                            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">Private</span>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className={`${previewPanelClassName} grid gap-4 lg:grid-cols-2`}>
                <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                    <p className={subtleHeadingClassName}>Global tooltip sample</p>
                    <button
                        type="button"
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                        aria-label="Shows destination metadata"
                        title="Shows destination metadata"
                    >
                        Hover me (tooltip)
                    </button>
                </div>
                <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
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
            title="Design System Playground"
            description="Read-only admin lab for shared components, interaction states, and notification QA."
            showGlobalSearch={false}
            showDateRange={false}
        >
            <section className="space-y-4">
                <AdminSurfaceCard className="space-y-4">
                    <header className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                            <p className={subtleHeadingClassName}>Component groups</p>
                            <h1 className="text-xl font-semibold text-slate-900">Shared UI inventory</h1>
                            <p className="max-w-3xl text-sm text-slate-600">
                                Preview component families and states side-by-side. This page is read-only and does not persist changes.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                            <Eye size={14} weight="duotone" />
                            Admin-only preview lab
                        </div>
                    </header>

                    <Tabs value={activeGroup} onValueChange={(value) => setActiveGroup(value as ComponentGroupId)}>
                        <TabsList variant="default" className="w-full flex-wrap border border-slate-200 bg-slate-50 p-1">
                            {COMPONENT_GROUPS.map((group) => (
                                <TabsTrigger
                                    key={group.id}
                                    value={group.id}
                                    {...getAnalyticsDebugAttributes('admin__design_playground_component_group--view', {
                                        group_id: group.id,
                                    })}
                                >
                                    {group.title}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        {COMPONENT_GROUPS.map((group) => (
                            <TabsContent key={`group:${group.id}`} value={group.id} className="space-y-4 pt-2">
                                <GroupHeader definition={group} />
                                <ComponentUsageReferences definition={group} />
                                {group.id === activeGroupDefinition.id && renderActiveGroupPreview()}
                            </TabsContent>
                        ))}
                    </Tabs>
                </AdminSurfaceCard>
            </section>

            <section className="mt-6">
                <AdminSurfaceCard className="space-y-4">
                    <header className="space-y-2">
                        <p className={subtleHeadingClassName}>Notification lab</p>
                        <h2 className="text-xl font-semibold text-slate-900">Toast scenario trigger</h2>
                        <p className="text-sm text-slate-600">
                            Trigger canonical toast variants through the shared `showAppToast(...)` pipeline for manual QA checks.
                        </p>
                    </header>

                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="space-y-1.5">
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
                            <p className="text-xs text-slate-500">{activeNotificationScenario.helperText}</p>
                        </div>

                        <button
                            type="button"
                            onClick={() => triggerNotificationScenario(notificationScenarioId)}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-accent-600 bg-accent-600 px-4 text-sm font-semibold text-white transition hover:bg-accent-700"
                            {...getAnalyticsDebugAttributes('admin__design_playground_toast--trigger', {
                                scenario_id: notificationScenarioId,
                            })}
                        >
                            <Bell size={16} weight="duotone" />
                            Trigger toast
                        </button>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {TOAST_SCENARIOS.map((scenario) => (
                            <button
                                key={`quick-toast:${scenario.id}`}
                                type="button"
                                onClick={() => {
                                    setNotificationScenarioId(scenario.id);
                                    triggerNotificationScenario(scenario.id);
                                }}
                                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                <Bell size={14} weight="duotone" className="shrink-0 text-slate-500" />
                                {scenario.label}
                            </button>
                        ))}
                    </div>
                </AdminSurfaceCard>
            </section>

            <section className="mt-6">
                <AdminSurfaceCard className="space-y-3">
                    <header className="space-y-2">
                        <p className={subtleHeadingClassName}>Coverage notes</p>
                        <h2 className="text-base font-semibold text-slate-900">Current playground intent</h2>
                    </header>
                    <ul className="space-y-2 text-sm text-slate-600">
                        <li className="flex items-start gap-2"><PaintBrush size={16} className="mt-0.5 shrink-0 text-slate-500" /> Mirrors existing shared component patterns before larger design-system consolidation.</li>
                        <li className="flex items-start gap-2"><SlidersHorizontal size={16} className="mt-0.5 shrink-0 text-slate-500" /> Keeps interactions local only; no backend writes, no profile/trip persistence side effects.</li>
                        <li className="flex items-start gap-2"><Bell size={16} className="mt-0.5 shrink-0 text-slate-500" /> Notification lab fires only through `showAppToast(...)` for consistent UX + QA parity.</li>
                        <li className="flex items-start gap-2"><Eye size={16} className="mt-0.5 shrink-0 text-slate-500" /> New shared components should be introduced in this playground before broad rollout and listed here when added.</li>
                    </ul>
                </AdminSurfaceCard>
            </section>
        </AdminShell>
    );
};
