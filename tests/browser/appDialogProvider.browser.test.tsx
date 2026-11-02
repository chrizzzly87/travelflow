// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';

import { AppDialogProvider, useAppDialog } from '../../components/AppDialogProvider';

const renderWithApi = () => {
  const ref: { api: ReturnType<typeof useAppDialog> | null } = { api: null };
  const Capture = () => {
    ref.api = useAppDialog();
    return null;
  };
  render(
    <AppDialogProvider>
      <Capture />
    </AppDialogProvider>,
  );
  return ref;
};

describe('components/AppDialogProvider prompt', () => {
  it('labels an input without label or placeholder by the dialog title', async () => {
    const ref = renderWithApi();

    await act(async () => {
      void ref.api?.prompt({ title: 'Rename trip' });
    });

    expect(screen.getByRole('textbox', { name: 'Rename trip' })).toBeInTheDocument();
  });

  it('falls back to the default prompt title when none is given', async () => {
    const ref = renderWithApi();

    await act(async () => {
      void ref.api?.prompt({});
    });

    expect(screen.getByRole('textbox', { name: 'Input Required' })).toBeInTheDocument();
  });
});
