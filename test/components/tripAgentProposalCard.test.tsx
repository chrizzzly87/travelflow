// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string | string[]) => (Array.isArray(key) ? key[0] : key),
        i18n: { language: 'en' },
    }),
}));

const applyTripAgentProposalMock = vi.fn();
const rejectTripAgentProposalMock = vi.fn();

vi.mock('../../services/tripAgentService', async () => {
    const actual = await vi.importActual<typeof import('../../services/tripAgentService')>('../../services/tripAgentService');
    return {
        ...actual,
        applyTripAgentProposal: (...args: unknown[]) => applyTripAgentProposalMock(...args),
        rejectTripAgentProposal: (...args: unknown[]) => rejectTripAgentProposalMock(...args),
    };
});

vi.mock('../../services/analyticsService', () => ({
    trackEvent: vi.fn(),
    getAnalyticsDebugAttributes: () => ({}),
}));

import { TripAgentProposalCard } from '../../components/trip-agent/TripAgentProposalCard';
import type { ITrip } from '../../types';
import type { TripAgentChangeSetV1 } from '../../shared/tripAgent';

const trip = {
    id: 'trip-1',
    title: 'Portugal',
    updatedAt: 10,
    startDate: '2026-05-01',
    items: [
        { id: 'lisbon', type: 'city', title: 'Lisbon', startDateOffset: 0, duration: 3, color: '#111111' },
        { id: 'activity-1', type: 'activity', title: 'Alfama walk', startDateOffset: 1, duration: 0.25, color: '#222222' },
    ],
} as unknown as ITrip;

const changeSet = {
    schemaVersion: 1,
    id: '4f1c9d5e-0000-4000-8000-000000000000',
    tripId: 'trip-1',
    threadId: '5f1c9d5e-0000-4000-8000-000000000000',
    runId: '6f1c9d5e-0000-4000-8000-000000000000',
    baseTripUpdatedAt: 10,
    summary: 'Relax the first days',
    operations: [{
        id: 'op-1',
        kind: 'remove_item',
        itemId: 'activity-1',
        rationale: 'The first day is too tight',
        targetLabel: 'Alfama walk',
    }],
    sources: [],
    status: 'pending',
    selectedOperationIds: [],
    appliedVersionId: null,
    createdAt: '2026-09-03T11:00:00.000Z',
    appliedAt: null,
} as unknown as TripAgentChangeSetV1;

afterEach(cleanup);

describe('TripAgentProposalCard', () => {
    it('requires a preview step before anything is applied', async () => {
        const user = userEvent.setup();
        applyTripAgentProposalMock.mockResolvedValue({
            trip,
            versionId: 'version-1',
            status: 'applied',
            appliedOperationIds: ['op-1'],
            noOpOperationIds: [],
        });

        render(<TripAgentProposalCard trip={trip} changeSet={changeSet} onApplied={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'tripAgent.preview' }));
        expect(applyTripAgentProposalMock).not.toHaveBeenCalled();
        expect(screen.getByText('tripAgent.previewLive')).toBeTruthy();

        await user.click(screen.getByRole('button', { name: 'tripAgent.applyCount' }));
        await waitFor(() => expect(applyTripAgentProposalMock).toHaveBeenCalledWith(
            'trip-1',
            '4f1c9d5e-0000-4000-8000-000000000000',
            ['op-1'],
        ));
    });

    it('shows the proposed trip in the planner while previewing and clears it after apply', async () => {
        const user = userEvent.setup();
        const onPreviewTrip = vi.fn();
        applyTripAgentProposalMock.mockResolvedValue({
            trip,
            versionId: 'version-1',
            status: 'applied',
            appliedOperationIds: ['op-1'],
            noOpOperationIds: [],
        });

        render(<TripAgentProposalCard trip={trip} changeSet={changeSet} onApplied={vi.fn()} onPreviewTrip={onPreviewTrip} />);

        await user.click(screen.getByRole('button', { name: 'tripAgent.preview' }));
        await waitFor(() => expect(onPreviewTrip).toHaveBeenCalledWith(expect.objectContaining({ id: 'trip-1' })));

        await user.click(screen.getByRole('button', { name: 'tripAgent.applyCount' }));
        await waitFor(() => expect(onPreviewTrip).toHaveBeenLastCalledWith(null));
        expect(screen.getByText('tripAgent.appliedCount')).toBeTruthy();
    });

    it('publishes the preview once per selection, not once per render', async () => {
        const user = userEvent.setup();
        const onPreviewTrip = vi.fn();

        const view = render(
            <TripAgentProposalCard trip={trip} changeSet={changeSet} onApplied={vi.fn()} onPreviewTrip={onPreviewTrip} />,
        );

        await user.click(screen.getByRole('button', { name: 'tripAgent.preview' }));
        await waitFor(() => expect(onPreviewTrip).toHaveBeenCalledWith(expect.objectContaining({ id: 'trip-1' })));
        const callsAfterPreview = onPreviewTrip.mock.calls.length;

        // A re-render with an equal-but-new trip object is what the planner does
        // while it shows the preview; it must not feed a new preview back in.
        view.rerender(
            <TripAgentProposalCard
                trip={JSON.parse(JSON.stringify(trip))}
                changeSet={changeSet}
                onApplied={vi.fn()}
                onPreviewTrip={onPreviewTrip}
            />,
        );
        view.rerender(
            <TripAgentProposalCard
                trip={JSON.parse(JSON.stringify(trip))}
                changeSet={changeSet}
                onApplied={vi.fn()}
                onPreviewTrip={onPreviewTrip}
            />,
        );

        expect(onPreviewTrip.mock.calls.length).toBe(callsAfterPreview);
    });

    it('keeps a failed apply retryable and names the failure', async () => {
        const user = userEvent.setup();
        applyTripAgentProposalMock.mockRejectedValue(Object.assign(new Error('Version conflict'), {
            code: 'TRIP_AGENT_PROPOSAL_STALE',
            detail: 'This proposal is based on an older trip version.',
        }));

        render(<TripAgentProposalCard trip={trip} changeSet={changeSet} onApplied={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'tripAgent.preview' }));
        await user.click(screen.getByRole('button', { name: 'tripAgent.applyCount' }));

        await waitFor(() => expect(screen.getByRole('alert').textContent)
            .toContain('tripAgent.errors.TRIP_AGENT_PROPOSAL_STALE'));
        expect(screen.getByRole('button', { name: 'tripAgent.retryApply' })).toBeTruthy();
    });
});

describe('TripAgentProposalCard superseding', () => {
    it('closes an older proposal once a newer one exists', () => {
        render(
            <TripAgentProposalCard trip={trip} changeSet={changeSet} onApplied={vi.fn()} isSuperseded />,
        );

        expect(screen.getByText('tripAgent.superseded')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'tripAgent.preview' })).toBeNull();
    });
});

describe('TripAgentProposalCard per-operation review', () => {
    const twoOperationSet = {
        ...changeSet,
        operations: [
            changeSet.operations[0],
            {
                id: 'op-2',
                kind: 'move_item',
                itemId: 'activity-1',
                startDateOffset: 2,
                rationale: 'Shifted by the removal',
                targetLabel: 'Alfama walk',
            },
        ],
    } as unknown as TripAgentChangeSetV1;

    it('lets a single change inside a group be deselected', async () => {
        const user = userEvent.setup();
        applyTripAgentProposalMock.mockResolvedValue({
            trip,
            versionId: 'version-1',
            status: 'applied_partial',
            appliedOperationIds: ['op-1'],
            noOpOperationIds: [],
        });

        render(<TripAgentProposalCard trip={trip} changeSet={twoOperationSet} onApplied={vi.fn()} />);

        await user.click(screen.getByRole('button', { name: 'tripAgent.showOperations' }));
        const checkboxes = screen.getAllByRole('checkbox');
        await user.click(checkboxes[checkboxes.length - 1]);

        await user.click(screen.getByRole('button', { name: 'tripAgent.preview' }));
        await user.click(screen.getByRole('button', { name: 'tripAgent.applyCount' }));

        await waitFor(() => expect(applyTripAgentProposalMock).toHaveBeenCalledWith(
            'trip-1',
            '4f1c9d5e-0000-4000-8000-000000000000',
            ['op-1'],
        ));
    });
});
