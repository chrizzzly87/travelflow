// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
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
});
