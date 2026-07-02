// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddActivityModal } from '../../components/AddActivityModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

const generateActivityProposalsMock = vi.fn();

vi.mock('../../services/aiService', () => ({
  generateActivityProposals: (...args: unknown[]) => generateActivityProposalsMock(...args),
}));

const PROPOSAL = {
  title: 'Sunset River Cruise',
  description: 'A relaxed evening cruise.',
  activityTypes: ['general'],
  cost: '$$',
  bestTime: 'Evening',
  tips: 'Book ahead',
};

const renderModal = () => {
  return render(
    React.createElement(AddActivityModal, {
      isOpen: true,
      onClose: vi.fn(),
      dayOffset: 0,
      location: 'Paris',
      onAdd: vi.fn(),
      trip: null,
    })
  );
};

const openAiModeAndTypePrompt = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /ai suggestion/i }));
  await user.type(screen.getByLabelText('What are you looking for?'), 'romantic dinner');
};

afterEach(() => {
  cleanup();
  generateActivityProposalsMock.mockReset();
});

describe('components/AddActivityModal AI generation errors', () => {
  it('shows an inline error with retry when generation rejects, and retry re-invokes generation', async () => {
    const user = userEvent.setup();
    generateActivityProposalsMock.mockRejectedValueOnce(new Error('network down'));
    renderModal();

    await openAiModeAndTypePrompt(user);
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('tripView.addActivity.aiError');
    expect(generateActivityProposalsMock).toHaveBeenCalledTimes(1);
    // Idle empty state must not be shown alongside the error.
    expect(screen.queryByText(/enter a wish above/i)).not.toBeInTheDocument();

    generateActivityProposalsMock.mockResolvedValueOnce([PROPOSAL]);
    await user.click(screen.getByRole('button', { name: 'tripView.addActivity.aiRetry' }));

    expect(await screen.findByText('Sunset River Cruise')).toBeInTheDocument();
    expect(generateActivityProposalsMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the error state when generation resolves with an empty result', async () => {
    const user = userEvent.setup();
    generateActivityProposalsMock.mockResolvedValueOnce([]);
    renderModal();

    await openAiModeAndTypePrompt(user);
    await user.click(screen.getByRole('button', { name: 'Generate' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('tripView.addActivity.aiError');
    expect(screen.queryByText(/enter a wish above/i)).not.toBeInTheDocument();
  });

  it('does not re-fire generation when Enter is pressed while a request is in flight', async () => {
    const user = userEvent.setup();
    let resolveGeneration: (value: unknown[]) => void = () => {};
    generateActivityProposalsMock.mockImplementationOnce(
      () => new Promise((resolve) => { resolveGeneration = resolve; })
    );
    renderModal();

    await openAiModeAndTypePrompt(user);
    const input = screen.getByLabelText('What are you looking for?');
    await user.type(input, '{Enter}');
    expect(generateActivityProposalsMock).toHaveBeenCalledTimes(1);

    await user.type(input, '{Enter}');
    await user.type(input, '{Enter}');
    expect(generateActivityProposalsMock).toHaveBeenCalledTimes(1);

    resolveGeneration([PROPOSAL]);
    expect(await screen.findByText('Sunset River Cruise')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the success path unchanged: proposals render without any error message', async () => {
    const user = userEvent.setup();
    generateActivityProposalsMock.mockResolvedValueOnce([PROPOSAL]);
    renderModal();

    await openAiModeAndTypePrompt(user);
    await user.type(screen.getByLabelText('What are you looking for?'), '{Enter}');

    expect(await screen.findByText('Sunset River Cruise')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(generateActivityProposalsMock).toHaveBeenCalledWith(
      'romantic dinner',
      'Paris',
      expect.objectContaining({ tripTitle: 'My Trip' })
    );
  });
});
