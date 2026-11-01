import React from 'react';
import { Crosshair, Info, User, X } from '@phosphor-icons/react';
import { AdminFilterMenu, type AdminFilterMenuOption } from '../AdminFilterMenu';
import { DateRangePicker } from '../../DateRangePicker';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import {
    AUDIT_COLUMN_OPTIONS,
    formatAuditCustomRangeLabel,
    type AuditTimePreset,
} from './adminAuditModel';
import type { AdminAuditStateApi } from './useAdminAuditState';

const COLUMN_OPTIONS: AdminFilterMenuOption[] = AUDIT_COLUMN_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
}));

const TIME_PRESET_LABELS: Array<{ value: AuditTimePreset; label: string }> = [
    { value: '24h', label: 'Last 24 hours' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: 'all', label: 'All time' },
    { value: 'custom', label: 'Custom range' },
];

/** The toolbar row above the table: time range, Action, Target, Actor, Columns, Reset. */
export const AuditFilterBar: React.FC<{ audit: AdminAuditStateApi }> = ({ audit }) => {
    const { state, actions } = audit;

    const resetFilters = () => {
        trackEvent('admin__audit--reset_filters');
        actions.resetFilters();
    };

    return (
        <>
            <section className="flex flex-wrap items-center gap-2" aria-label="Audit filters">
                <Select value={state.timePreset} onValueChange={(value) => actions.setTimePreset(value as AuditTimePreset)}>
                    <SelectTrigger className="h-8 w-[160px]" aria-label="Time range">
                        <SelectValue placeholder="Time range" />
                    </SelectTrigger>
                    <SelectContent>
                        {TIME_PRESET_LABELS.map((preset) => (
                            <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {state.timePreset === 'custom' && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => actions.setCustomRangeDialogOpen(true)}
                        className="tabular-nums"
                    >
                        {formatAuditCustomRangeLabel(state.customStartDate, state.customEndDate)}
                    </Button>
                )}
                <AdminFilterMenu
                    label="Action"
                    icon={<Info size={14} className="me-2 shrink-0 text-muted-foreground" weight="duotone" />}
                    options={audit.actionFilterOptions}
                    selectedValues={state.actionFilters}
                    onSelectedValuesChange={actions.setActionFilters}
                    selectAllLabel="Select all actions"
                    clearLabel="Clear action filter"
                />
                <AdminFilterMenu
                    label="Target"
                    icon={<Crosshair size={14} className="me-2 shrink-0 text-muted-foreground" weight="duotone" />}
                    options={audit.targetFilterOptions}
                    selectedValues={state.targetFilters}
                    onSelectedValuesChange={actions.setTargetFilters}
                />
                <AdminFilterMenu
                    label="Actor"
                    icon={<User size={14} className="me-2 shrink-0 text-muted-foreground" weight="duotone" />}
                    options={audit.actorFilterOptions}
                    selectedValues={state.actorFilters}
                    onSelectedValuesChange={actions.setActorFilters}
                />
                <AdminFilterMenu
                    label="Columns"
                    options={COLUMN_OPTIONS}
                    selectedValues={state.visibleColumns}
                    onSelectedValuesChange={actions.setVisibleColumns}
                />
                {audit.hasActiveFilters && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={resetFilters}
                        {...getAnalyticsDebugAttributes('admin__audit--reset_filters')}
                    >
                        <X />
                        Reset
                    </Button>
                )}
            </section>

            <Dialog open={state.isCustomRangeDialogOpen} onOpenChange={actions.setCustomRangeDialogOpen}>
                <DialogContent className="w-[min(96vw,640px)] overflow-hidden rounded-lg p-0">
                    <DialogHeader className="border-b border-border">
                        <DialogTitle className="text-base font-semibold text-foreground">Custom time range</DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                            Pick the start and end date used by the audit filters and replay export.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                        <DateRangePicker
                            startDate={state.customStartDate}
                            endDate={state.customEndDate}
                            onChange={actions.setCustomRange}
                            showLabel={false}
                        />
                    </div>
                    <DialogFooter className="border-t border-border">
                        <Button type="button" onClick={() => actions.setCustomRangeDialogOpen(false)}>
                            Apply range
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
