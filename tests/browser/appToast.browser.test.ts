// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { Toaster } from '../../components/ui/sonner';
import { showAppToast } from '../../components/ui/appToast';
import { setPreference } from '../../contexts/theme/themeStore';

describe('components/ui/appToast', () => {
  afterEach(() => {
    act(() => setPreference('light'));
  });

  // Regression: Sonner defaulted to its light theme, so dark mode showed a white
  // toast under dark-mode title and icon colours.
  it('follows the app theme instead of Sonner\'s light default', async () => {
    act(() => setPreference('dark'));
    const { container } = render(React.createElement(Toaster));
    showAppToast({ tone: 'info', title: 'Sync status', description: 'Queued trip changes synced.' });

    await waitFor(() => {
      expect(container.ownerDocument.querySelector('[data-sonner-toaster]'))
        .toHaveAttribute('data-sonner-theme', 'dark');
    });

    act(() => setPreference('light'));
    await waitFor(() => {
      expect(container.ownerDocument.querySelector('[data-sonner-toaster]'))
        .toHaveAttribute('data-sonner-theme', 'light');
    });
  });

  it('renders custom toast content through sonner', async () => {
    render(React.createElement(Toaster));

    showAppToast({
      tone: 'success',
      title: 'Saved profile.',
      description: 'Your changes were stored.',
    });

    await waitFor(() => {
      expect(screen.getByText('Saved profile')).toBeInTheDocument();
      expect(screen.queryByText('Saved profile.')).not.toBeInTheDocument();
      expect(screen.getByText('Your changes were stored.')).toBeInTheDocument();
    });
  });

  it('styles quoted description segments with semibold emphasis', async () => {
    render(React.createElement(Toaster));

    showAppToast({
      tone: 'remove',
      title: 'Trip archived.',
      description: 'Your trip "Albanian Heritage & Riviera Loop" was archived successfully.',
    });

    await waitFor(() => {
      const quoted = screen.getByText('"Albanian Heritage & Riviera Loop"');
      expect(quoted).toHaveClass('font-semibold');
    });
  });
});
