// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { SpeculationRulesManager } from '../../components/SpeculationRulesManager';

describe('components/SpeculationRulesManager', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    document.getElementById('tf-speculation-rules')?.remove();
  });

  it('cleans up safely even if the speculation rules script was already detached', () => {
    vi.stubEnv('VITE_SPECULATION_RULES_ENABLED', 'true');

    Object.defineProperty(HTMLScriptElement, 'supports', {
      configurable: true,
      value: vi.fn(() => true),
    });

    const { unmount } = render(React.createElement(SpeculationRulesManager, { enabled: true }));
    const script = document.getElementById('tf-speculation-rules');

    expect(script).not.toBeNull();
    script?.remove();

    expect(() => {
      unmount();
    }).not.toThrow();
  });
});
