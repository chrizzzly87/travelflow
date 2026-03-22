// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { TripWorkspacePhrasesPage } from '../../../components/tripview/workspace/TripWorkspacePhrasesPage';
import type { ITrip } from '../../../types';

const analyticsMocks = vi.hoisted(() => ({
    trackEvent: vi.fn(),
    getAnalyticsDebugAttributes: vi.fn(() => ({})),
}));

vi.mock('../../../services/analyticsService', () => analyticsMocks);

const buildTrip = (): ITrip => ({
    id: 'trip-thailand',
    title: 'Thailand Highlights',
    startDate: '2026-04-10',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    items: [
        {
            id: 'city-bangkok',
            type: 'city',
            title: 'Bangkok',
            startDateOffset: 0,
            duration: 3,
            color: 'bg-amber-500',
            coordinates: { lat: 13.7563, lng: 100.5018 },
        },
        {
            id: 'city-chiang-mai',
            type: 'city',
            title: 'Chiang Mai',
            startDateOffset: 3,
            duration: 4,
            color: 'bg-emerald-500',
            coordinates: { lat: 18.7883, lng: 98.9853 },
        },
        {
            id: 'city-krabi',
            type: 'city',
            title: 'Krabi',
            startDateOffset: 7,
            duration: 4,
            color: 'bg-sky-500',
            coordinates: { lat: 8.0863, lng: 98.9063 },
        },
    ],
});

describe('components/tripview/workspace/TripWorkspacePhrasesPage', () => {
    const clipboardWriteText = vi.fn();
    const speechCancel = vi.fn();
    const speechSpeak = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: clipboardWriteText,
            },
        });
        Object.defineProperty(window, 'speechSynthesis', {
            configurable: true,
            value: {
                cancel: speechCancel,
                speak: speechSpeak,
            },
        });
        Object.defineProperty(window, 'SpeechSynthesisUtterance', {
            configurable: true,
            value: class SpeechSynthesisUtteranceMock {
                text: string;
                constructor(text: string) {
                    this.text = text;
                }
            },
        });
        clipboardWriteText.mockResolvedValue(undefined);
    });

    afterEach(() => {
        cleanup();
    });

    it('supports flip, save, copy, speak, and review interactions', async () => {
        render(React.createElement(TripWorkspacePhrasesPage, { trip: buildTrip() }));

        const helloCard = screen.getByText('Hello').closest('[data-slot="card"]');
        expect(helloCard).not.toBeNull();
        const helloCardQueries = within(helloCard as HTMLElement);

        fireEvent.click(screen.getByText('Hello'));
        expect(screen.getByText('Sawasdee krap / ka')).toBeInTheDocument();

        fireEvent.click(helloCardQueries.getByRole('button', { name: 'Save to flashcards' }));
        expect(helloCardQueries.getByRole('button', { name: 'Saved to flashcards' })).toBeInTheDocument();

        fireEvent.click(helloCardQueries.getByRole('button', { name: 'Copy' }));
        await waitFor(() => {
            expect(clipboardWriteText).toHaveBeenCalledWith('Hello — Sawasdee krap / ka');
        });

        fireEvent.click(helloCardQueries.getByRole('button', { name: 'Speak' }));
        expect(speechCancel).toHaveBeenCalled();
        expect(speechSpeak).toHaveBeenCalledTimes(1);

        fireEvent.click(helloCardQueries.getByRole('button', { name: 'Practice again' }));
        fireEvent.click(helloCardQueries.getByRole('button', { name: 'Easy' }));

        expect(analyticsMocks.trackEvent).toHaveBeenCalledWith('trip_workspace__phrase_review--rate', expect.objectContaining({
            trip_id: 'trip-thailand',
            phrase_id: 'hello',
            rating: 'easy',
        }));
    });
});
