// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

import { TripAgentQuestionCard } from '../../components/trip-agent/TripAgentQuestionCard';

const options = [
    { id: 'extend', label: 'Extend nearby stays', prompt: 'Extend the stays around the gap.' },
    { id: 'shorten', label: 'Shorten the trip', detail: 'End earlier', prompt: 'Shorten the whole trip instead.' },
];

afterEach(cleanup);

describe('TripAgentQuestionCard', () => {
    it('continues the conversation with the chosen option prompt', async () => {
        const user = userEvent.setup();
        const onAnswer = vi.fn();

        render(<TripAgentQuestionCard question="What should happen to the free days?" options={options} allowCustom onAnswer={onAnswer} />);

        await user.click(screen.getByText('Shorten the trip'));

        expect(onAnswer).toHaveBeenCalledWith('Shorten the whole trip instead.');
        expect(screen.getByText('Shorten the trip')).toBeTruthy();
    });

    it('sends a custom answer typed by the traveller', async () => {
        const user = userEvent.setup();
        const onAnswer = vi.fn();

        render(<TripAgentQuestionCard question="What now?" options={options} allowCustom onAnswer={onAnswer} />);

        await user.type(screen.getByPlaceholderText('tripAgent.questionCustom'), 'Add two days in Hanoi');
        await user.click(screen.getByRole('button', { name: 'tripAgent.questionSend' }));

        expect(onAnswer).toHaveBeenCalledWith('Add two days in Hanoi');
    });

    it('hides the custom field when the agent did not allow one', () => {
        render(<TripAgentQuestionCard question="Pick one" options={options} allowCustom={false} onAnswer={vi.fn()} />);

        expect(screen.queryByPlaceholderText('tripAgent.questionCustom')).toBeNull();
    });
});
