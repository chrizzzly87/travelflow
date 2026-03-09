// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Toaster } from '../../components/ui/sonner';
import { showAppToast } from '../../components/ui/appToast';

describe('components/ui/appToast', () => {
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
