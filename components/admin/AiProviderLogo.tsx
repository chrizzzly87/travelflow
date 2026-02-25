import React from 'react';
import { getAiProviderMetadata } from '../../config/aiProviderCatalog';

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
            className={[
                'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white',
                className || '',
            ].join(' ').trim()}
            style={{ width: size, height: size, fontSize, lineHeight: 1 }}
        >
            {asset ? (
                <img
                    src={asset.src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-[72%] w-[72%] object-contain"
                />
            ) : (
                <span className="font-bold uppercase tracking-tight text-slate-600">AI</span>
            )}
        </span>
    );
};
