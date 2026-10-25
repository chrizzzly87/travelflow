// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
    adminGetDestinationCatalog: vi.fn(),
    adminSaveDestinationOverride: vi.fn(),
    adminDeleteDestinationOverride: vi.fn(),
    confirm: vi.fn(),
    showAppToast: vi.fn(),
}));

vi.mock('../../../components/admin/AdminShell', () => ({
    AdminShell: ({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) => (
        <section>
            <h1>{title}</h1>
            {actions}
            {children}
        </section>
    ),
}));

vi.mock('../../../components/AppDialogProvider', () => ({
    useAppDialog: () => ({ confirm: mocks.confirm }),
}));

vi.mock('../../../components/ui/appToast', () => ({ showAppToast: mocks.showAppToast }));

vi.mock('../../../services/adminService', () => ({
    adminGetDestinationCatalog: mocks.adminGetDestinationCatalog,
    adminSaveDestinationOverride: mocks.adminSaveDestinationOverride,
    adminDeleteDestinationOverride: mocks.adminDeleteDestinationOverride,
}));

import { AdminDestinationsPage } from '../../../pages/AdminDestinationsPage';

const guide = (id: string, name: string, kind = 'country') => ({
    id, name, slug: name.toLowerCase(), kind, country_code: 'TW', region: 'Asia', parent_id: null,
    payload: { summary: `${name} summary` },
});

const catalog = () => ({
    guides: [guide('g-tw', 'Taiwan'), guide('g-tpe', 'Taipei', 'city')],
    profiles: [{
        country_code: 'TW', name: 'Taiwan profile', slug: 'taiwan', region: 'Asia', source_provider: 'wikivoyage',
        origin_url: 'https://example.test/taiwan', source_fetched_at: '2026-10-01T10:00:00.000Z',
    }],
    overrides: [{
        id: 'o-1', target_kind: 'guide', target_id: 'g-tw', status: 'published',
        patch: { summary: 'Edited summary' }, note: 'Copy fix', updated_at: '2026-10-20T10:00:00.000Z',
    }],
    importRuns: [{ provider: 'wikivoyage', status: 'completed', started_at: '2026-10-01T09:00:00.000Z', completed_at: '2026-10-01T10:00:00.000Z' }],
    referralCount: 12,
});

const patchField = () => screen.getByLabelText('Override patch') as HTMLTextAreaElement;

describe('AdminDestinationsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        for (const name of ['hasPointerCapture', 'setPointerCapture', 'releasePointerCapture', 'scrollIntoView'] as const) {
            if (!(name in Element.prototype)) {
                Object.defineProperty(Element.prototype, name, { configurable: true, value: () => false });
            }
        }
        mocks.adminGetDestinationCatalog.mockResolvedValue(catalog());
        mocks.confirm.mockResolvedValue(true);
        mocks.adminSaveDestinationOverride.mockImplementation(async (input: Record<string, unknown>) => ({
            id: 'o-2', target_kind: input.targetKind, target_id: input.targetId, status: input.status,
            patch: input.patch, note: input.note, updated_at: '2026-10-24T10:00:00.000Z',
        }));
    });

    it('opens the first guide with its saved override instead of an empty patch', async () => {
        render(<AdminDestinationsPage />);

        expect(await screen.findByRole('heading', { name: 'Taiwan' })).toBeInTheDocument();
        // Regression: the first guide used to open with `{}`, so saving wiped its patch.
        expect(JSON.parse(patchField().value)).toEqual({ summary: 'Edited summary' });
        expect(screen.getByLabelText('Editor note')).toHaveValue('Copy fix');
        expect(screen.getByRole('button', { name: /Publish override/ })).toBeInTheDocument();
    });

    it('selects another item from the list and saves a new draft for it', async () => {
        const user = userEvent.setup();
        render(<AdminDestinationsPage />);

        await user.click(await screen.findByRole('button', { name: /Taipei/ }));
        expect(await screen.findByRole('heading', { name: 'Taipei' })).toBeInTheDocument();
        expect(JSON.parse(patchField().value)).toEqual({});

        fireEvent.change(patchField(), { target: { value: '{"summary":"New"}' } });
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /Save draft/ }));

        await waitFor(() => {
            expect(mocks.adminSaveDestinationOverride).toHaveBeenCalledWith(expect.objectContaining({
                targetKind: 'guide', targetId: 'g-tpe', status: 'draft', patch: { summary: 'New' },
            }));
        });
        expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
    });

    it('blocks saving while the patch is not valid JSON', async () => {
        render(<AdminDestinationsPage />);
        await screen.findByRole('heading', { name: 'Taiwan' });

        fireEvent.change(patchField(), { target: { value: '{ broken' } });

        expect(screen.getByText('The override must be valid JSON.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Publish override/ })).toBeDisabled();
    });

    it('asks before discarding unsaved edits when switching items', async () => {
        const user = userEvent.setup();
        mocks.confirm.mockResolvedValue(false);
        render(<AdminDestinationsPage />);
        await screen.findByRole('heading', { name: 'Taiwan' });

        await user.type(screen.getByLabelText('Editor note'), ' more');
        await user.click(screen.getByRole('button', { name: /Taipei/ }));

        expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Discard unsaved changes?' }));
        expect(screen.getByRole('heading', { name: 'Taiwan' })).toBeInTheDocument();
    });

    it('switches to country profiles and shows their provenance', async () => {
        const user = userEvent.setup();
        render(<AdminDestinationsPage />);
        await screen.findByRole('heading', { name: 'Taiwan' });

        await user.click(screen.getByRole('tab', { name: /Country profiles/ }));
        await user.click(await screen.findByRole('button', { name: /Taiwan profile/ }));

        expect(await screen.findByText('Source provenance')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'https://example.test/taiwan' })).toBeInTheDocument();
    });

    it('shows an authored error when the catalog fails to load', async () => {
        mocks.adminGetDestinationCatalog.mockRejectedValue(new Error('relation "x" does not exist'));
        render(<AdminDestinationsPage />);

        expect(await screen.findByText('Could not load destination content.')).toBeInTheDocument();
        expect(screen.queryByText(/relation/)).not.toBeInTheDocument();
    });
});
