import React from 'react';
import type { AiModelCatalogItem } from '../../../config/aiModelCatalog';
import { AI_REASONING_EFFORTS } from '../../../shared/aiReasoning';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../../ui/select';
import { REASONING_MODE_LABELS, type BenchmarkReasoningMode } from './aiBenchmarkModel';

/** A model's own reasoning setting; "Run default" leaves it to the execution setting. */
export const ModelReasoningSelect: React.FC<{
    model: AiModelCatalogItem;
    runDefault: BenchmarkReasoningMode;
    value?: BenchmarkReasoningMode;
    onChange: (value: BenchmarkReasoningMode | undefined) => void;
}> = ({ model, runDefault, value, onChange }) => {
    const isConfigurable = model.provider === 'openrouter' && model.supportsReasoning === true;
    if (!isConfigurable) {
        return <span className="text-xs text-muted-foreground">Not configurable</span>;
    }

    const supportedEfforts = (model.reasoningEfforts?.length ? model.reasoningEfforts : AI_REASONING_EFFORTS)
        .filter((effort) => !model.reasoningMandatory || effort !== 'none');

    return (
        <Select value={value || 'inherit'} onValueChange={(nextValue) => onChange(nextValue === 'inherit' ? undefined : nextValue as BenchmarkReasoningMode)}>
            <SelectTrigger aria-label={`${model.label} reasoning`} className="h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
                <SelectGroup>
                    <SelectItem value="inherit">Run default · {REASONING_MODE_LABELS[runDefault]}</SelectItem>
                    <SelectItem value="provider-default">Model default</SelectItem>
                    {supportedEfforts.map((effort) => (
                        <SelectItem key={effort} value={effort}>{REASONING_MODE_LABELS[effort]}</SelectItem>
                    ))}
                </SelectGroup>
            </SelectContent>
        </Select>
    );
};
