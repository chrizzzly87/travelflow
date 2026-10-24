// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Alert, AlertDescription } from '../../../components/ui/alert';

const h = React.createElement;

describe('components/ui/alert tones', () => {
  // The tone variants once set a light-theme `-800` description ink with no
  // dark pair, so in dark mode the description was dark red on a dark wash.
  it.each([
    ['success', 'emerald'],
    ['warning', 'amber'],
    ['danger', 'red'],
  ] as const)('gives the %s description its own dark-mode ink', (variant, colour) => {
    render(h(Alert, { variant }, h(AlertDescription, null, 'Body')));
    const className = screen.getByRole('alert').className;
    expect(className).toContain(`*:data-[slot=alert-description]:text-${colour}-800`);
    expect(className).toContain(`dark:*:data-[slot=alert-description]:text-${colour}-200/85`);
  });
});
