import React from 'react';
import { ArrowsDownUp } from '@phosphor-icons/react';
import { getAnalyticsDebugAttributes, trackEvent } from '../../../services/analyticsService';
import { AiProviderLabel as ProviderLabel } from '../AiProviderLogo';
import type { BenchmarkRunFilters, RunSortDirection } from '../aiBenchmarkRuns';
import { Button } from '../../ui/button';
import { Checkbox } from '../../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';

const FILTER_TOGGLES: Array<{ key: 'hideFailed' | 'onlyWarnings' | 'onlyUnrated'; label: string }> = [
    { key: 'hideFailed', label: 'Hide failed' },
    { key: 'onlyWarnings', label: 'Only warnings' },
    { key: 'onlyUnrated', label: 'Only unrated' },
];

/** Provider and status filters plus the sort toggle above the runs table. */
export const AiBenchmarkRunFilters: React.FC<{
    filters: BenchmarkRunFilters;
    filtersActive: boolean;
    providerOptions: string[];
    sortDirection: RunSortDirection;
    onChange: (patch: Partial<BenchmarkRunFilters>) => void;
    onReset: () => void;
    onToggleSort: () => void;
}> = ({ filters, filtersActive, providerOptions, sortDirection, onChange, onReset, onToggleSort }) => (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Select value={filters.provider} onValueChange={(provider) => onChange({ provider })}>
            <SelectTrigger aria-label="Filter runs by provider" className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="All providers" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All providers</SelectItem>
                {providerOptions.map((provider) => (
                    <SelectItem key={provider} value={provider}>
                        <ProviderLabel
                            provider={provider}
                            providerClassName="text-foreground"
                            logoSize={12}
                        />
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
        {FILTER_TOGGLES.map(({ key, label }) => (
            <label key={key} className="inline-flex items-center gap-2 text-xs font-medium text-foreground">
                <Checkbox
                    aria-label={label}
                    checked={filters[key]}
                    onCheckedChange={(checked) => onChange({ [key]: checked === true })}
                />
                {label}
            </label>
        ))}
        {filtersActive && (
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                    trackEvent('admin__ai_benchmark--reset_filters');
                    onReset();
                }}
                {...getAnalyticsDebugAttributes('admin__ai_benchmark--reset_filters')}
            >
                Reset
            </Button>
        )}
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ms-auto text-muted-foreground"
            onClick={onToggleSort}
            aria-label={sortDirection === 'desc' ? 'Newest first. Switch to oldest first' : 'Oldest first. Switch to newest first'}
        >
            <ArrowsDownUp />
            {sortDirection === 'desc' ? 'Newest first' : 'Oldest first'}
        </Button>
    </div>
);
