// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AiProviderLogo } from '../../components/admin/AiProviderLogo';

describe('components/admin/AiProviderLogo', () => {
  it('uses provider logo for direct providers', () => {
    const { container } = render(<AiProviderLogo provider="openai" size={20} />);
    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('src')).toBe('/images/ai-providers/openai.svg');
  });

  it('uses model-vendor logo for openrouter-routed models', () => {
    const { container } = render(
      <AiProviderLogo
        provider="openrouter"
        model="minimax/minimax-m2.5"
        size={20}
      />,
    );
    const image = container.querySelector('img');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('src')).toBe('/images/ai-providers/minimax.png');
  });

  it('falls back to text badge when no logo mapping exists', () => {
    render(<AiProviderLogo provider="unknown-provider" size={20} />);
    expect(screen.getByText('AI')).toBeTruthy();
  });
});
