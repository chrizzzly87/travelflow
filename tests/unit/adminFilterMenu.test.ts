// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminFilterMenu } from '../../components/admin/AdminFilterMenu';

afterEach(() => {
  cleanup();
});

describe('components/admin/AdminFilterMenu', () => {
  it('keeps select-all and deselect-all actions inside the menu', async () => {
    const user = userEvent.setup();
    const onSelectedValuesChange = vi.fn();

    render(
      React.createElement(AdminFilterMenu, {
        label: 'Action',
        options: [
          { value: 'admin.user.update_profile', label: 'Updated user', group: 'Admin users' },
          { value: 'admin.trip.update', label: 'Updated trip', group: 'Admin trips' },
          { value: 'admin.audit.export', label: 'Exported audit replay bundle', group: 'Audit & tooling' },
        ],
        selectedValues: [],
        onSelectedValuesChange,
        selectAllLabel: 'Select all actions',
        clearLabel: 'Deselect all actions',
      })
    );

    await user.click(screen.getByRole('button', { name: /filter by action/i }));

    expect(screen.getByText('Admin users')).toBeInTheDocument();
    expect(screen.getByText('Admin trips')).toBeInTheDocument();
    expect(screen.getByText('Audit & tooling')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Select all actions' }));

    expect(onSelectedValuesChange).toHaveBeenCalledWith([
      'admin.user.update_profile',
      'admin.trip.update',
      'admin.audit.export',
    ]);
  });

  it('supports deselect-all without external buttons', async () => {
    const user = userEvent.setup();
    const onSelectedValuesChange = vi.fn();

    render(
      React.createElement(AdminFilterMenu, {
        label: 'Action',
        options: [
          { value: 'admin.user.update_profile', label: 'Updated user' },
          { value: 'admin.trip.update', label: 'Updated trip' },
        ],
        selectedValues: ['admin.user.update_profile'],
        onSelectedValuesChange,
        selectAllLabel: 'Select all actions',
        clearLabel: 'Deselect all actions',
      })
    );

    await user.click(screen.getByRole('button', { name: /filter by action/i }));
    await user.click(screen.getByRole('button', { name: 'Deselect all actions' }));

    expect(onSelectedValuesChange).toHaveBeenCalledWith([]);
  });

  it('lets keyboard users reach and toggle options, and returns focus on Escape', async () => {
    const user = userEvent.setup();
    const onSelectedValuesChange = vi.fn();

    render(
      React.createElement(AdminFilterMenu, {
        label: 'Status',
        options: [
          { value: 'active', label: 'Active', count: 3 },
          { value: 'archived', label: 'Archived', count: 1 },
        ],
        selectedValues: [],
        onSelectedValuesChange,
      })
    );

    const trigger = screen.getByRole('button', { name: /filter by status/i });
    await user.click(trigger);

    const options = screen.getAllByRole('checkbox');
    expect(options).toHaveLength(2);
    for (const option of options) {
      expect(option).not.toHaveAttribute('tabindex', '-1');
    }
    await waitFor(() => expect(options[0]).toHaveFocus());

    await user.keyboard(' ');
    expect(onSelectedValuesChange).toHaveBeenCalledWith(['active']);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Status filter' })).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('draws the trigger dashed while empty and solid once it filters', () => {
    const options = [{ value: 'active', label: 'Active' }];
    const { rerender } = render(
      React.createElement(AdminFilterMenu, { label: 'Status', options, selectedValues: [], onSelectedValuesChange: vi.fn() })
    );
    const trigger = screen.getByRole('button', { name: /filter by status/i });
    expect(trigger.className).toContain('border-dashed');

    rerender(
      React.createElement(AdminFilterMenu, { label: 'Status', options, selectedValues: ['active'], onSelectedValuesChange: vi.fn() })
    );
    expect(trigger.className).toContain('border-solid');
    expect(trigger.className).not.toContain('border-dashed');
  });
});
