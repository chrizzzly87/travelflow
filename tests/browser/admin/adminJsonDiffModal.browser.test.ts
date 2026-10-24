// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminJsonDiffModal } from '../../../components/admin/AdminJsonDiffModal';

describe('components/admin/AdminJsonDiffModal', () => {
  it('renders focused diff by default and can toggle full diff mode in-place', async () => {
    const user = userEvent.setup();
    render(
      React.createElement(AdminJsonDiffModal, {
        isOpen: true,
        onClose: () => undefined,
        title: 'Trip update diff',
        description: 'Compare before and after snapshots.',
        beforeValue: { id: 'trip-1', mode: 'train', nested: { keep: true } },
        afterValue: { id: 'trip-1', mode: 'bus', nested: { keep: true } },
      })
    );

    expect(screen.getAllByText(/changed lines?/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Unchanged runs are collapsed/i)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Show unchanged lines/i }));
    expect(screen.queryByText(/Unchanged runs are collapsed/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Show unchanged lines/i }));
    expect(screen.getByText(/Unchanged runs are collapsed/i)).toBeInTheDocument();
  });

  it('resets to the collapsed view when the modal is closed and reopened', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const props = {
      onClose,
      title: 'Trip update diff',
      beforeValue: { id: 'trip-1', mode: 'train' },
      afterValue: { id: 'trip-1', mode: 'bus' },
    };
    const { rerender } = render(React.createElement(AdminJsonDiffModal, { ...props, isOpen: true }));

    await user.click(screen.getByRole('checkbox', { name: /Show unchanged lines/i }));
    expect(screen.queryByText(/Unchanged runs are collapsed/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Close diff modal/i }));
    expect(onClose).toHaveBeenCalled();
    rerender(React.createElement(AdminJsonDiffModal, { ...props, isOpen: false }));
    rerender(React.createElement(AdminJsonDiffModal, { ...props, isOpen: true }));
    expect(screen.getByText(/Unchanged runs are collapsed/i)).toBeInTheDocument();
  });

  it('says so when both snapshots are identical', () => {
    render(
      React.createElement(AdminJsonDiffModal, {
        isOpen: true,
        onClose: () => undefined,
        title: 'No-op diff',
        beforeValue: { id: 'trip-1' },
        afterValue: { id: 'trip-1' },
      })
    );
    expect(screen.getByText(/Both snapshots are identical/i)).toBeInTheDocument();
  });

  it('ensures Prism is defined on window and contains the json language definition', () => {
    expect(window).toBeDefined();
    expect((window as any).Prism).toBeDefined();
    expect((window as any).Prism.languages.json).toBeDefined();
  });
});
