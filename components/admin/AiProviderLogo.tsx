import React from 'react';
import { AI_MODEL_CATALOG } from '../../config/aiModelCatalog';
import { getAiProviderMetadata } from '../../config/aiProviderCatalog';
import { cn } from '../../lib/utils';

interface AiProviderLogoProps {
    provider: string;
    model?: string | null;
    size?: number;
    className?: string;
}

interface ProviderLogoAsset {
    src: string;
    key: string;
}

const PROVIDER_LOGO_ASSET: Record<string, ProviderLogoAsset> = {
    gemini: { key: 'gemini', src: '/images/ai-providers/google-gemini.svg' },
    google: { key: 'google', src: '/images/ai-providers/google-gemini.svg' },
    openai: { key: 'openai', src: '/images/ai-providers/openai.svg' },
    anthropic: { key: 'anthropic', src: '/images/ai-providers/anthropic.svg' },
    openrouter: { key: 'openrouter', src: '/images/ai-providers/openrouter.png' },
    perplexity: { key: 'perplexity', src: '/images/ai-providers/perplexity.svg' },
    qwen: { key: 'qwen', src: '/images/ai-providers/qwen.png' },
    minimax: { key: 'minimax', src: '/images/ai-providers/minimax.png' },
    'z-ai': { key: 'z-ai', src: '/images/ai-providers/z-ai.png' },
    moonshotai: { key: 'moonshotai', src: '/images/ai-providers/moonshot.png' },
    mistral: { key: 'mistral', src: '/images/ai-providers/mistral.png' },
    mistralai: { key: 'mistralai', src: '/images/ai-providers/mistral.png' },
    deepseek: { key: 'deepseek', src: '/images/ai-providers/deepseek.png' },
    'black-forest-labs': { key: 'black-forest-labs', src: '/images/ai-providers/black-forest-labs.png' },
    bfl: { key: 'bfl', src: '/images/ai-providers/black-forest-labs.png' },
    bytedance: { key: 'bytedance', src: '/images/ai-providers/bytedance.png' },
    'byte-dance': { key: 'byte-dance', src: '/images/ai-providers/bytedance.png' },
};

const normalizeProvider = (provider: string): string => provider.trim().toLowerCase();
const normalizeModel = (model: string | null | undefined): string => (
    typeof model === 'string' ? model.trim().toLowerCase() : ''
);

const resolveModelVendorToken = (model: string | null | undefined): string | null => {
    const normalizedModel = normalizeModel(model);
    if (!normalizedModel) return null;
    if (normalizedModel.includes('/')) return normalizedModel.split('/')[0] || null;
    if (normalizedModel.includes(':')) return normalizedModel.split(':')[0] || null;
    return normalizedModel;
};

const resolveLogoAsset = (provider: string, model?: string | null): ProviderLogoAsset | null => {
    const normalizedProvider = normalizeProvider(provider);
    const modelVendorToken = resolveModelVendorToken(model);
    if (modelVendorToken && PROVIDER_LOGO_ASSET[modelVendorToken]) {
        return PROVIDER_LOGO_ASSET[modelVendorToken];
    }
    if (PROVIDER_LOGO_ASSET[normalizedProvider]) {
        return PROVIDER_LOGO_ASSET[normalizedProvider];
    }
    return null;
};

export const AiProviderLogo: React.FC<AiProviderLogoProps> = ({
    provider,
    model,
    size = 16,
    className,
}) => {
    const normalized = normalizeProvider(provider);
    const metadata = getAiProviderMetadata(normalized);
    const asset = resolveLogoAsset(provider, model);
    const fontSize = Math.max(8, Math.round(size * 0.45));

    return (
        <span
            aria-hidden="true"
            title={`${metadata.label} logo`}
            className={cn(
                // Brand marks are drawn for a light ground, so the badge stays
                // white in dark mode too; otherwise dark logos vanish.
                'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-white',
                className,
            )}
            style={{ width: size, height: size, fontSize, lineHeight: 1 }}
        >
            {asset ? (
                <img
                    src={asset.src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="size-[72%] object-contain"
                />
            ) : (
                <span className="font-semibold tracking-tight text-slate-500">AI</span>
            )}
        </span>
    );
};

/**
 * Logo, provider short name and model label in one line, e.g. "OpenAI / GPT-5".
 * The full provider name and id sit in the tooltip.
 */
export const AiProviderLabel: React.FC<{
    provider: string;
    model?: string | null;
    showModel?: boolean;
    providerClassName?: string;
    modelClassName?: string;
    logoSize?: number;
}> = ({
    provider,
    model,
    showModel = true,
    providerClassName,
    modelClassName,
    logoSize = 14,
}) => {
    const metadata = getAiProviderMetadata(provider);
    const catalogModel = model
        ? AI_MODEL_CATALOG.find((item) => item.provider === provider && item.model === model)
        : null;
    const providerLabel = catalogModel?.providerLabel || metadata.label;
    const providerShortName = catalogModel?.providerShortName || metadata.shortName;
    const modelLabel = catalogModel?.label || model;
    return (
        <span className="inline-flex min-w-0 items-center gap-1.5">
            <AiProviderLogo provider={provider} model={model} size={logoSize} />
            <span className={providerClassName || 'font-semibold text-foreground'} data-tooltip={`${providerLabel} (${provider})`}>
                {providerShortName}
            </span>
            {modelLabel && showModel ? (
                <span className={modelClassName || 'truncate text-muted-foreground'}>
                    / {modelLabel}
                </span>
            ) : null}
        </span>
    );
};
