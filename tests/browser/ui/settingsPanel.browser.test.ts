// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  SettingsCard,
  SettingsGroup,
  SettingsPanel,
  SettingsRow,
  SettingsSection,
} from '../../../components/ui/settings-panel';
import { Switch } from '../../../components/ui/switch';

const h = React.createElement;

afterEach(cleanup);

describe('SettingsPanel', () => {
  it('renders one surface holding its sections and rows', () => {
    const { container } = render(
      h(SettingsPanel, null,
        h(SettingsSection, { title: 'Rollout', description: 'Who can reach a feature.' },
          h(SettingsRow, { label: 'Trip Agent', description: 'The planning chat.' },
            h(Switch, { checked: false, onCheckedChange: () => {}, 'aria-label': 'Trip Agent' })))),
    );

    expect(container.querySelectorAll('[data-slot="settings-panel"]')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2, name: 'Rollout' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Trip Agent' })).toBeTruthy();
  });

  it('marks the row layout so a wide control gets its own line', () => {
    const { container } = render(
      h(SettingsPanel, null,
        h(SettingsSection, { title: 'AI model' },
          h(SettingsRow, { label: 'Age limit' }, h('input', { 'aria-label': 'Age limit control' })),
          h(SettingsRow, { label: 'Default model', layout: 'stacked' },
            h('input', { 'aria-label': 'Default model control' })))),
    );

    const layouts = Array.from(container.querySelectorAll('[data-slot="settings-row"]'))
      .map((row) => row.getAttribute('data-layout'));
    expect(layouts).toEqual(['inline', 'stacked']);
  });

  it('captions a real form control with a label that focuses it', async () => {
    render(
      h(SettingsPanel, null,
        h(SettingsSection, { title: 'AI model' },
          h(SettingsRow, { label: 'Age limit', htmlFor: 'age-limit' },
            h('input', { id: 'age-limit' })))),
    );

    await userEvent.click(screen.getByText('Age limit'));
    expect(document.activeElement).toBe(document.getElementById('age-limit'));
  });

  it('never wraps a Radix trigger in a label, so one click is one toggle', async () => {
    const onCheckedChange = vi.fn();
    render(
      h(SettingsPanel, null,
        h(SettingsSection, { title: 'Rollout' },
          h(SettingsRow, { label: 'Planner beta' },
            h(Switch, { checked: false, onCheckedChange, 'aria-label': 'Planner beta' })))),
    );

    // A <label> around a Radix trigger forwards a second click to the control,
    // so the value toggles twice. The row must caption it with a <span>.
    expect(document.querySelector('label')).toBeNull();
    await userEvent.click(screen.getByRole('switch', { name: 'Planner beta' }));
    expect(onCheckedChange).toHaveBeenCalledTimes(1);
  });

  it('stacks each card in a group so none inherits a sibling height', () => {
    const { container } = render(
      h(SettingsGroup, null,
        h(SettingsCard, { title: 'Trip Agent' },
          h(SettingsRow, { label: 'Open to everyone' },
            h(Switch, { checked: true, onCheckedChange: () => {}, 'aria-label': 'Open to everyone' }))),
        h(SettingsCard, { title: 'Planner' },
          h(SettingsRow, { label: 'Planner beta' },
            h(Switch, { checked: false, onCheckedChange: () => {}, 'aria-label': 'Planner beta' })))),
    );

    const group = container.querySelector('[data-slot="settings-group"]');
    const cards = container.querySelectorAll('[data-slot="settings-card"]');
    expect(cards).toHaveLength(2);
    // A column, never a grid: a grid track is what stretched every card to the
    // tallest sibling and left the dead whitespace.
    expect(group?.className).toContain('flex-col');
    expect(group?.className).not.toContain('grid-cols');
    expect(Array.from(cards).every((card) => card.tagName === 'SECTION')).toBe(true);
  });

  it('gives every inline row the same control track, whatever the control is', () => {
    const { container } = render(
      h(SettingsGroup, null,
        h(SettingsCard, { title: 'Map' },
          h(SettingsRow, { label: 'Provider' }, h('button', { 'aria-label': 'Provider' })),
          h(SettingsRow, { label: 'Default style' }, h('button', { 'aria-label': 'Default style' })))),
    );

    // A fixed track, not `auto` - an auto track sizes to its own content, so
    // two selects in one card came out at different widths.
    const rows = Array.from(container.querySelectorAll('[data-slot="settings-row"][data-layout="inline"]'));
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.className).toContain('sm:grid-cols-[minmax(0,1fr)_18rem]');
    }
  });

  it('shows the consequence of the current value as a row note', () => {
    render(
      h(SettingsPanel, null,
        h(SettingsSection, { title: 'Map' },
          h(SettingsRow, { label: 'Provider', note: 'Routing stays on Google.' },
            h('input', { 'aria-label': 'Provider control' })))),
    );

    expect(screen.getByText('Routing stays on Google.')).toBeTruthy();
  });
});
