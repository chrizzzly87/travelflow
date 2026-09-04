// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('TripAgentProposalCard revert', () => {
    it('restores the trip as it stood before the apply, not the last history entry', async () => {
        const user = userEvent.setup();
        const onRevertAgentChange = vi.fn();
        const appliedTrip = { ...trip, title: 'Portugal, revised' } as ITrip;
        applyTripAgentProposalMock.mockResolvedValue({
            trip: appliedTrip,
            versionId: 'version-1',
            status: 'applied',
            appliedOperationIds: ['op-1'],
            noOpOperationIds: [],
        });

        render(
            <TripAgentProposalCard
                trip={trip}
                changeSet={changeSet}
                onApplied={vi.fn()}
                onRevertAgentChange={onRevertAgentChange}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'tripAgent.preview' }));
        await user.click(screen.getByRole('button', { name: 'tripAgent.applyCount' }));
        await waitFor(() => expect(screen.getByText('tripAgent.appliedCount')).toBeTruthy());

        await user.click(screen.getByRole('button', { name: 'tripAgent.revert' }));

        expect(onRevertAgentChange).toHaveBeenCalledTimes(1);
        const [{ trip: restored }] = onRevertAgentChange.mock.calls[0];
        expect(restored.title).toBe('Portugal');
        expect(restored.items.some((item: { id: string }) => item.id === 'activity-1')).toBe(true);
    });

    it('offers no revert until something was applied', () => {
        render(
            <TripAgentProposalCard
                trip={trip}
                changeSet={changeSet}
                onApplied={vi.fn()}
                onRevertAgentChange={vi.fn()}
                serverStatus="applied"
            />,
        );

        // Reloaded as applied: this session has no pre-apply snapshot to restore.
        expect(screen.queryByRole('button', { name: 'tripAgent.revert' })).toBeNull();
    });
});

describe('TripAgentProposalCard reopen and reapply', () => {
    it('reopens an applied set and applies it again locally, without a second server call', async () => {
        const user = userEvent.setup();
        const onReapplyAgentChange = vi.fn();
        applyTripAgentProposalMock.mockResolvedValue({
            trip,
            versionId: 'version-1',
            status: 'applied',
            appliedOperationIds: ['op-1'],
            noOpOperationIds: [],
        });

        render(
            <TripAgentProposalCard
                trip={trip}
                changeSet={changeSet}
                onApplied={vi.fn()}
                onRevertAgentChange={vi.fn()}
                onReapplyAgentChange={onReapplyAgentChange}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'tripAgent.preview' }));
        await user.click(screen.getByRole('button', { name: 'tripAgent.applyCount' }));
        await waitFor(() => expect(screen.getByText('tripAgent.appliedCount')).toBeTruthy());
        expect(applyTripAgentProposalMock).toHaveBeenCalledTimes(1);

        await user.click(screen.getByRole('button', { name: 'tripAgent.reviewAgain' }));
        await user.click(screen.getByRole('button', { name: 'tripAgent.preview' }));
        await user.click(screen.getByRole('button', { name: 'tripAgent.applyAgainCount' }));

        // The change set is no longer pending on the server, so a reapply is a
        // local adoption of the recomputed trip.
        expect(applyTripAgentProposalMock).toHaveBeenCalledTimes(1);
        expect(onReapplyAgentChange).toHaveBeenCalledTimes(1);
        expect(onReapplyAgentChange.mock.calls[0][0].trip.items.some(
            (item: { id: string }) => item.id === 'activity-1',
        )).toBe(false);
    });

    it('hands the redo snapshot to the reverting caller', async () => {
        const user = userEvent.setup();
        const onRevertAgentChange = vi.fn();
        const appliedTrip = { ...trip, title: 'Portugal, revised' } as ITrip;
        applyTripAgentProposalMock.mockResolvedValue({
            trip: appliedTrip,
            versionId: 'version-1',
            status: 'applied',
            appliedOperationIds: ['op-1'],
            noOpOperationIds: [],
        });

        render(
            <TripAgentProposalCard
                trip={trip}
                changeSet={changeSet}
                onApplied={vi.fn()}
                onRevertAgentChange={onRevertAgentChange}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'tripAgent.preview' }));
        await user.click(screen.getByRole('button', { name: 'tripAgent.applyCount' }));
        await waitFor(() => expect(screen.getByText('tripAgent.appliedCount')).toBeTruthy());
        await user.click(screen.getByRole('button', { name: 'tripAgent.revert' }));

        const [payload] = onRevertAgentChange.mock.calls[0];
        expect(payload.trip.title).toBe('Portugal');
        expect(payload.redoTrip.title).toBe('Portugal, revised');
    });
});

describe('TripAgentProposalCard never traps the reviewer', () => {
    const applyOnce = async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(screen.getByRole('button', { name: 'tripAgent.preview' }));
        await user.click(screen.getByRole('button', { name: 'tripAgent.applyCount' }));
        await waitFor(() => expect(screen.getByText('tripAgent.appliedCount')).toBeTruthy());
    };

    beforeEach(() => {
        applyTripAgentProposalMock.mockResolvedValue({
            trip,
            versionId: 'version-1',
            status: 'applied',
            appliedOperationIds: ['op-1'],
            noOpOperationIds: [],
        });
    });

    it('lets a reopened card be discarded again', async () => {
        const user = userEvent.setup();
        render(
            <TripAgentProposalCard
                trip={trip}
                changeSet={changeSet}
                onApplied={vi.fn()}
                onReapplyAgentChange={vi.fn()}
            />,
        );

        await applyOnce(user);
        await user.click(screen.getByRole('button', { name: 'tripAgent.reviewAgain' }));
        await user.click(screen.getByRole('button', { name: 'tripAgent.discard' }));

        expect(screen.getByText('tripAgent.discarded')).toBeTruthy();
    });

    it('offers redo and review on a reverted card', async () => {
        const user = userEvent.setup();
        const onReapplyAgentChange = vi.fn();
        render(
            <TripAgentProposalCard
                trip={trip}
                changeSet={changeSet}
                onApplied={vi.fn()}
                onRevertAgentChange={vi.fn()}
                onReapplyAgentChange={onReapplyAgentChange}
            />,
        );

        await applyOnce(user);
        await user.click(screen.getByRole('button', { name: 'tripAgent.revert' }));
        expect(screen.getByText('tripAgent.revertedHint')).toBeTruthy();

        await user.click(screen.getByRole('button', { name: 'tripAgent.redo' }));

        expect(onReapplyAgentChange).toHaveBeenCalledTimes(1);
        expect(screen.getByText('tripAgent.appliedCount')).toBeTruthy();
    });

    it('explains rather than silently failing when a reapply has nowhere to go', async () => {
        const user = userEvent.setup();
        render(<TripAgentProposalCard trip={trip} changeSet={changeSet} onApplied={vi.fn()} />);

        await applyOnce(user);
        await user.click(screen.getByRole('button', { name: 'tripAgent.reviewAgain' }));
        await user.click(screen.getByRole('button', { name: 'tripAgent.preview' }));
        await user.click(screen.getByRole('button', { name: 'tripAgent.applyAgainCount' }));

        expect(screen.getByRole('alert').textContent).toContain('tripAgent.reapplyUnavailable');
        // and the card can still be closed
        await user.click(screen.getByRole('button', { name: 'tripAgent.discard' }));
        expect(screen.getByText('tripAgent.discarded')).toBeTruthy();
    });
});
