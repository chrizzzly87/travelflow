import type { TripGenerationFlow } from '../types';

const normalizeEnvFlag = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    return value.trim().toLowerCase();
};

const isEnabled = (value: unknown): boolean => {
    const normalized = normalizeEnvFlag(value);
    return normalized === '1'
        || normalized === 'true'
        || normalized === 'yes'
        || normalized === 'on';
};

export const isClassicAsyncGenerationEnabled = (): boolean => {
    return isEnabled((import.meta as any)?.env?.VITE_AI_GENERATION_ASYNC_FLOW_CLASSIC_ENABLED);
};

export const isWizardAsyncGenerationEnabled = (): boolean => {
    return isEnabled((import.meta as any)?.env?.VITE_AI_GENERATION_ASYNC_FLOW_WIZARD_ENABLED);
};

export const isSurpriseAsyncGenerationEnabled = (): boolean => {
    return isEnabled((import.meta as any)?.env?.VITE_AI_GENERATION_ASYNC_FLOW_SURPRISE_ENABLED);
};

export const isFlowAsyncGenerationEnabled = (flow: TripGenerationFlow): boolean => {
    if (flow === 'classic') return isClassicAsyncGenerationEnabled();
    if (flow === 'wizard') return isWizardAsyncGenerationEnabled();
    return isSurpriseAsyncGenerationEnabled();
};
