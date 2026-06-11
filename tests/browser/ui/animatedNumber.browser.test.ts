// @vitest-environment jsdom
import * as PreactCompat from 'preact/compat';
import { describe, expect, it } from 'vitest';

import {
  formatAnimatedNumberText,
  isPreactCompatReactModule,
} from '../../../components/ui/animated-number';

describe('components/ui/AnimatedNumber', () => {
  it('detects Preact compat so number-flow custom elements can be bypassed', () => {
    expect(isPreactCompatReactModule(PreactCompat)).toBe(true);
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
