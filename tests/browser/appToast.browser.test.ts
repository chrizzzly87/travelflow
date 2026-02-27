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
      title: 'Saved profile',
      description: 'Your changes were stored.',
    });

    await waitFor(() => {
      expect(screen.getByText('Saved profile')).toBeInTheDocument();
      expect(screen.getByText('Your changes were stored.')).toBeInTheDocument();
    });
  });
});
