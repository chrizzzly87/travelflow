import React from 'react';
import type { BenchmarkMaskScenario, BenchmarkPresetConfig } from '../../../services/aiBenchmarkPreferencesService';
import { AdminSectionHeader } from '../AdminSectionHeader';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { CUSTOM_JSON_PRESET_ID, CUSTOM_JSON_PRESET_NAME } from './aiBenchmarkModel';

/** Setup: the trip template picker and a summary of the mask it applied. */
export const AiBenchmarkTemplateSection: React.FC<{
    presetConfigs: BenchmarkPresetConfig[];
    selectedPresetId: string;
    selectedPreset: BenchmarkPresetConfig | null;
    mask: BenchmarkMaskScenario;
    onSelectPreset: (presetId: string) => void;
    onOpenDetails: () => void;
}> = ({ presetConfigs, selectedPresetId, selectedPreset, mask, onSelectPreset, onOpenDetails }) => (
    <section className="flex flex-col gap-3 p-4 md:p-6">
        <AdminSectionHeader
            title="Trip template"
            description="The trip request every model receives."
            actions={(
                <Button type="button" variant="outline" size="sm" onClick={onOpenDetails}>
                    Details and prompt
                </Button>
            )}
        />
        <div className="grid gap-3 md:grid-cols-[minmax(220px,0.8fr)_minmax(300px,1.6fr)]">
            <Select value={selectedPresetId} onValueChange={onSelectPreset}>
                <SelectTrigger aria-label="Trip template" className="h-9">
                    <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        {presetConfigs.map((preset) => (
                            <SelectItem key={preset.id} value={preset.id}>{preset.name}</SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_JSON_PRESET_ID}>{CUSTOM_JSON_PRESET_NAME}</SelectItem>
                    </SelectGroup>
                </SelectContent>
            </Select>
            <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <Badge variant="outline">{selectedPreset?.kind === 'custom' ? 'Custom' : 'System'}</Badge>
                    <Badge variant="secondary" className="max-w-full truncate">{mask.destinations || 'No destination'}</Badge>
                    <Badge variant="outline">{mask.dateInputMode === 'flex' ? `${mask.flexWeeks} week flexible` : `${mask.startDate} → ${mask.endDate}`}</Badge>
                    <Badge variant="outline">{mask.budget}</Badge>
                    <Badge variant="outline">{mask.pace}</Badge>
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                    {selectedPreset?.description || 'No description saved for this template.'}
                </p>
            </div>
        </div>
    </section>
);
