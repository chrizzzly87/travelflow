// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SettingsPanel, SettingsRow, SettingsSection } from '../../../components/ui/settings-panel';
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
