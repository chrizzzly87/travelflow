import { describe, expect, it } from 'vitest';
import { getAiProviderMetadata, getAiProviderSortOrder } from '../../config/aiProviderCatalog';

describe('config/aiProviderCatalog', () => {
  it('returns known provider labels and short names', () => {
    expect(getAiProviderMetadata('perplexity')).toMatchObject({
      label: 'Perplexity',
      shortName: 'PPLX',
      shortCode: 'PPLX',
      isKnown: true,
    });

    expect(getAiProviderMetadata('qwen')).toMatchObject({
      label: 'Qwen',
      shortName: 'Qwen',
      shortCode: 'QWEN',
      isKnown: true,
    });
  });

  it('derives sensible fallback metadata for unknown providers', () => {
    expect(getAiProviderMetadata('custom_provider')).toMatchObject({
      label: 'Custom Provider',
      shortName: 'Custom Provider',
      isKnown: false,
    });
  });

  it('sorts known providers before unknown providers', () => {
    const geminiOrder = getAiProviderSortOrder('gemini');
    const openrouterOrder = getAiProviderSortOrder('openrouter');
    const unknownOrder = getAiProviderSortOrder('custom');

    expect(geminiOrder).toBeLessThan(openrouterOrder);
    expect(openrouterOrder).toBeLessThan(unknownOrder);
  });
});
