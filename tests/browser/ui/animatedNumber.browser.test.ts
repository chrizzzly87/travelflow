// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { formatAnimatedNumberText } from '../../../components/ui/animatedNumberFormat';
import {
  AnimatedNumber,
} from '../../../components/ui/animated-number';

describe('components/ui/AnimatedNumber', () => {
  it('renders a readable number before animated custom elements are available', () => {
    render(React.createElement(AnimatedNumber, { value: 42, suffix: ' km' }));
    expect(screen.getByText('42 km')).toBeVisible();
  });

  it('updates readable text when custom animation elements are unavailable', () => {
    const view = render(React.createElement(AnimatedNumber, { value: 12, suffix: ' km' }));
    view.rerender(React.createElement(AnimatedNumber, { value: 13, suffix: ' km' }));
    expect(screen.getByText('13 km')).toBeVisible();
  });

  it('formats fallback text with locale, prefix, and suffix', () => {
    expect(formatAnimatedNumberText(1234.5, {
      locales: 'de-DE',
      format: { minimumFractionDigits: 1, maximumFractionDigits: 1 },
      prefix: '~',
      suffix: ' km',
    })).toBe('~1.234,5 km');
  });
});
