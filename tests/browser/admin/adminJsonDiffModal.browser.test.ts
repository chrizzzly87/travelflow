// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
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
    expect(screen.getByText(/Showing focused context around changed lines/i)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Show full diff/i }));
    expect(screen.queryByText(/Showing focused context around changed lines/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /Show full diff/i }));
    expect(screen.getByText(/Showing focused context around changed lines/i)).toBeInTheDocument();
  });

  it('highlights JSON properties and values without a global JSON language plugin', () => {
    render(React.createElement(AdminJsonDiffModal, {
      isOpen: true,
      onClose: () => undefined,
      title: 'JSON syntax',
      beforeValue: { enabled: true },
      afterValue: { enabled: false },
    }));
    expect(document.querySelector('.token.property')?.textContent).toBe('"enabled"');
    expect(document.querySelector('.token.boolean')?.textContent).toBe('true');
  });
});
