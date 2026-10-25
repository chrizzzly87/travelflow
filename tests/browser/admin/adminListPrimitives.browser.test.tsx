// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AdminSelectionBar } from '../../../components/admin/AdminSelectionBar';
import { AdminPagination } from '../../../components/admin/AdminPagination';
import { AdminDetailSheet } from '../../../components/admin/AdminDetailSheet';

const h = React.createElement;

describe('AdminSelectionBar', () => {
  it('renders nothing while nothing is selected', () => {
    const { container } = render(h(AdminSelectionBar, { count: 0, noun: 'user', onClear: vi.fn(), children: h('button', null, 'Delete') }));
    expect(container.innerHTML).toBe('');
  });

  it('names the selection, shows the actions and clears', async () => {
    const onClear = vi.fn();
    render(h(AdminSelectionBar, { count: 3, noun: 'entry', pluralNoun: 'entries', onClear, children: h('button', null, 'Export') }));

    expect(screen.getByRole('region', { name: 'Bulk actions' })).toBeTruthy();
    expect(screen.getByText('3 entries selected')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(onClear).toHaveBeenCalledOnce();
  });
});

describe('AdminPagination', () => {
  it('shows the visible range and moves between pages', async () => {
    const onPageChange = vi.fn();
    render(h(AdminPagination, { page: 2, pageSize: 50, totalItems: 120, onPageChange, noun: 'trips' }));

    expect(screen.getByText('Showing 51–100 of 120 trips')).toBeTruthy();
    expect(screen.getByText('Page 2 of 3')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it('says so when there is nothing to page and hides the controls', () => {
    render(h(AdminPagination, { page: 1, pageSize: 50, totalItems: 0, onPageChange: vi.fn(), noun: 'users' }));
    expect(screen.getByText('No users')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull();
  });

  it('clamps an out-of-range page', () => {
    render(h(AdminPagination, { page: 9, pageSize: 10, totalItems: 25, onPageChange: vi.fn() }));
    expect(screen.getByText('Showing 21–25 of 25 rows')).toBeTruthy();
  });
});

describe('AdminDetailSheet', () => {
  it('renders an accessible panel with header, body and footer, and closes', async () => {
    const onOpenChange = vi.fn();
    render(h(AdminDetailSheet, {
      open: true,
      onOpenChange,
      title: 'Ada Lovelace',
      subtitle: 'ada@example.com',
      footer: h('button', null, 'Save'),
      children: h('p', null, 'Body'),
    }));

    const dialog = await screen.findByRole('dialog', { name: 'Ada Lovelace' });
    expect(dialog).toBeTruthy();
    // Announced once: the visible heading is the dialog title, with no hidden duplicate.
    expect(screen.getAllByText('Ada Lovelace')).toHaveLength(1);
    expect(screen.getByText('Body')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    // A plain click: userEvent's pointer sequence starts Vaul's drag handling,
    // which needs layout APIs jsdom does not have.
    fireEvent.click(screen.getByRole('button', { name: 'Close details' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
