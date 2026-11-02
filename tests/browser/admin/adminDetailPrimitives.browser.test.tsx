// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AdminDetailField } from '../../../components/admin/AdminDetailField';
import { AdminRelativeTimestamp } from '../../../components/admin/AdminRelativeTimestamp';
import { formatAdminAbsoluteTime } from '../../../components/admin/adminRelativeTime';

const h = React.createElement;
const NOW = Date.parse('2026-10-24T12:00:00.000Z');

describe('AdminDetailField', () => {
  it('renders a dt/dd pair with a node label', () => {
    const { container } = render(h('dl', null, h(AdminDetailField, { label: h('strong', null, 'Owner'), children: 'Ana' })));
    expect(container.querySelector('dt strong')?.textContent).toBe('Owner');
    const value = container.querySelector('dd');
    expect(value?.textContent).toBe('Ana');
    expect(value?.className).toContain('break-words');
    expect(value?.className).toContain('text-sm');
    expect(container.firstElementChild?.firstElementChild?.className).not.toContain('sm:col-span-2');
  });

  it('spans both columns when wide and merges a custom class', () => {
    const { container } = render(h('dl', null, h(AdminDetailField, { label: 'Notes', wide: true, className: 'mt-2', children: 'x' })));
    const field = container.querySelector('dl > div');
    expect(field?.className).toContain('sm:col-span-2');
    expect(field?.className).toContain('mt-2');
  });

  it('sets ids in a breakable monospace value', () => {
    const { container } = render(h('dl', null, h(AdminDetailField, { label: 'Request ID', mono: true, children: 'req_123' })));
    const value = container.querySelector('dd');
    expect(value?.className).toContain('font-mono');
    expect(value?.className).toContain('break-all');
    expect(value?.className).not.toContain('text-sm');
  });
});

describe('AdminRelativeTimestamp', () => {
  it('shows the relative time with the absolute time in the tooltip', () => {
    const value = '2026-10-24T09:00:00.000Z';
    render(h(AdminRelativeTimestamp, { value, nowMs: NOW, className: 'text-xs' }));
    const node = screen.getByText('3 hours ago');
    expect(node.getAttribute('data-tooltip')).toBe(formatAdminAbsoluteTime(value));
    expect(node.className).toContain('tabular-nums');
    expect(node.className).toContain('text-xs');
  });

  it('shows the fallback and no tooltip for a missing or invalid value', () => {
    render(h('div', null,
      h(AdminRelativeTimestamp, { value: null, fallback: 'Never', nowMs: NOW }),
      h(AdminRelativeTimestamp, { value: 'not a date', nowMs: NOW }),
    ));
    expect(screen.getByText('Never').hasAttribute('data-tooltip')).toBe(false);
    expect(screen.getByText('—').hasAttribute('data-tooltip')).toBe(false);
  });
});
