// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AiBenchmarkRunSheet, RunRatingButtons, type AiBenchmarkRunSheetProps } from '../../../components/admin/AiBenchmarkRunSheet';
import type { BenchmarkRun } from '../../../components/admin/aiBenchmarkRuns';

const h = React.createElement;

const makeRun = (overrides: Partial<BenchmarkRun> = {}): BenchmarkRun => ({
    id: 'run-42',
    session_id: 'session-1',
    provider: 'openai',
    model: 'gpt-5',
    label: 'GPT-5',
    run_index: 3,
    status: 'completed',
    latency_ms: 2400,
    schema_valid: true,
    usage: { totalTokens: 1234 },
    cost_usd: 0.012,
    trip_id: 'trip-9',
    error_message: null,
    run_comment: 'Solid route',
    created_at: '2026-10-24T10:00:00.000Z',
    ...overrides,
});

const baseProps = (overrides: Partial<AiBenchmarkRunSheetProps> = {}): AiBenchmarkRunSheetProps => ({
    run: makeRun(),
    onOpenChange: vi.fn(),
    costEstimateLabel: null,
    commentDraft: 'Solid route',
    onCommentDraftChange: vi.fn(),
    onSaveComment: vi.fn(),
    commentSaving: false,
    onRate: vi.fn(),
    ratingSaving: false,
    busy: false,
    cancelling: false,
    onRerun: vi.fn(),
    onAbort: vi.fn(),
    onDownload: vi.fn(),
    ...overrides,
});

describe('AiBenchmarkRunSheet', () => {
    it('renders nothing visible while no run is inspected', () => {
        render(h(AiBenchmarkRunSheet, baseProps({ run: null })));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    // fireEvent, not userEvent: vaul's drawer reads a CSS transform on pointerup that jsdom does not compute.
    it('shows the run summary, the note and the footer actions', () => {
        const props = baseProps();
        render(h(AiBenchmarkRunSheet, props));

        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(screen.getByText('Completed')).toBeTruthy();
        expect(screen.getByText('1,234')).toBeTruthy();
        expect(screen.getByText('$0.012000')).toBeTruthy();
        expect((screen.getByRole('textbox', { name: 'Comment for run run-42' }) as HTMLTextAreaElement).value).toBe('Solid route');
        // An unchanged note has nothing to save.
        expect((screen.getByRole('button', { name: 'Save note' }) as HTMLButtonElement).disabled).toBe(true);
        expect(screen.queryByRole('button', { name: /Abort run/ })).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: /Rerun model/ }));
        fireEvent.click(screen.getByRole('button', { name: /Download JSON/ }));
        expect(props.onRerun).toHaveBeenCalledOnce();
        expect(props.onDownload).toHaveBeenCalledOnce();
    });

    it('keeps the provider error and validation payloads that used to live in separate modals', () => {
        render(h(AiBenchmarkRunSheet, baseProps({
            run: makeRun({
                status: 'failed',
                schema_valid: false,
                error_message: 'Provider request failed: {"error":"rate limited"}',
                validation_errors: ['missing days'],
            }),
        })));

        expect(screen.getByText('Provider request failed')).toBeTruthy();
        expect(screen.getByLabelText('Provider error JSON').textContent).toContain('rate limited');
        expect(screen.getByText('Validation failed')).toBeTruthy();
        expect(screen.getByLabelText('Validation JSON').textContent).toContain('missing days');
    });

    it('offers abort for a running run and locks the note until it finishes', () => {
        const props = baseProps({ run: makeRun({ status: 'running', latency_ms: null, started_at: new Date().toISOString() }) });
        render(h(AiBenchmarkRunSheet, props));

        expect((screen.getByRole('textbox', { name: 'Comment for run run-42' }) as HTMLTextAreaElement).disabled).toBe(true);
        fireEvent.click(screen.getByRole('button', { name: /Abort run/ }));
        expect(props.onAbort).toHaveBeenCalledOnce();
    });

    it('saves an edited note', () => {
        const props = baseProps({ commentDraft: 'Better than last time' });
        render(h(AiBenchmarkRunSheet, props));
        fireEvent.click(screen.getByRole('button', { name: 'Save note' }));
        expect(props.onSaveComment).toHaveBeenCalledOnce();
    });
});

describe('RunRatingButtons', () => {
    it('sets a rating and clears the active one', async () => {
        const onRate = vi.fn();
        render(h(RunRatingButtons, { run: makeRun({ satisfaction_rating: 'good' }), disabled: false, onRate }));

        expect(screen.getByRole('button', { name: 'Mark run run-42 as Good' }).getAttribute('aria-pressed')).toBe('true');
        await userEvent.click(screen.getByRole('button', { name: 'Mark run run-42 as Good' }));
        await userEvent.click(screen.getByRole('button', { name: 'Mark run run-42 as Bad' }));
        expect(onRate.mock.calls).toEqual([[null], ['bad']]);
    });
});
