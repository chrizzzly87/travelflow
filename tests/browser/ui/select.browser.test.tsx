// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Select, SelectTrigger, SelectValue } from '../../../components/ui/select';

const h = React.createElement;

describe('components/ui/select trigger classes', () => {
  // The trigger joined classes as a plain string, so a caller's `w-[160px]` sat
  // beside the base `w-full` and stylesheet order decided the winner: the
  // Audit log time-range select stretched across the whole toolbar.
  it('lets a caller override the base width and height', () => {
    render(h(Select, null, h(SelectTrigger, { className: 'h-8 w-[160px]', 'aria-label': 'Time range' }, h(SelectValue, null))));
    const classes = screen.getByRole('combobox', { name: 'Time range' }).className.split(/\s+/);

    expect(classes).toContain('w-[160px]');
    expect(classes).toContain('h-8');
    expect(classes).not.toContain('w-full');
    expect(classes).not.toContain('h-10');
  });
});
