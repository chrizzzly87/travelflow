// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminJsonDiffModal } from '../../../components/admin/AdminJsonDiffModal';

describe('components/admin/AdminJsonDiffModal', () => {
  it('renders focused diff by default and can expand full snapshots', async () => {
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

    await user.click(screen.getByRole('button', { name: /Show full previous\/current JSON/i }));
    expect(screen.getByText('Complete snapshots')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Focused changes/i }));
    expect(screen.getByRole('button', { name: /All lines/i })).toBeInTheDocument();
  });
});
