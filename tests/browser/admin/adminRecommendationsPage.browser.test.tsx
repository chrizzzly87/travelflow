// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mocks = vi.hoisted(() => ({
    adminGetRecommendationCatalog: vi.fn(),
    adminSaveRecommendation: vi.fn(),
    adminSetRecommendationStatus: vi.fn(),
    adminDeleteRecommendation: vi.fn(),
    adminImportRecommendations: vi.fn(),
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
    adminGetRecommendationCatalog: mocks.adminGetRecommendationCatalog,
    adminSaveRecommendation: mocks.adminSaveRecommendation,
    adminSetRecommendationStatus: mocks.adminSetRecommendationStatus,
    adminDeleteRecommendation: mocks.adminDeleteRecommendation,
    adminImportRecommendations: mocks.adminImportRecommendations,
}));

import { AdminRecommendationsPage } from '../../../pages/AdminRecommendationsPage';

const row = (id: string, title: string, status = 'in_review', extra: Record<string, unknown> = {}) => ({
    id, slug: id, country_code: 'TW', city_name: 'Taipei', title, summary: '', description: '',
    highlights: [], activity_types: [], tags: [], cost_band: null, typical_duration_minutes: null,
    address: '', lat: null, lng: null, google_place_id: '', image: null, status,
    updated_at: '2026-10-20T10:00:00.000Z', ...extra,
});

describe('AdminRecommendationsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        for (const name of ['hasPointerCapture', 'setPointerCapture', 'releasePointerCapture', 'scrollIntoView'] as const) {
            if (!(name in Element.prototype)) {
                Object.defineProperty(Element.prototype, name, { configurable: true, value: () => false });
            }
        }
        mocks.confirm.mockResolvedValue(true);
        mocks.adminGetRecommendationCatalog.mockResolvedValue({
            rows: [row('r-1', 'Din Tai Fung'), row('r-2', 'Taipei 101', 'published', { image: { url: '/x' } })],
            countries: ['TW', 'JP'],
        });
        mocks.adminSaveRecommendation.mockImplementation(async (payload: Record<string, unknown>) => (
            row(String(payload.id || 'r-new'), String(payload.title), String(payload.status))
        ));
        mocks.adminSetRecommendationStatus.mockImplementation(async (id: string, status: string) => row(id, 'Din Tai Fung', status));
    });

    it('lists rows, opens one in the editor and saves an edit', async () => {
        const user = userEvent.setup();
        render(<AdminRecommendationsPage />);

        const rows = await screen.findAllByTestId('admin-recommendation-row');
        expect(rows).toHaveLength(2);
        await user.click(rows[0]);

        const title = screen.getByLabelText('Title');
        expect(title).toHaveValue('Din Tai Fung');
        await user.clear(title);
        await user.type(title, 'Din Tai Fung Xinsheng');
        expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: /Save changes/ }));

        await waitFor(() => {
            expect(mocks.adminSaveRecommendation).toHaveBeenCalledWith(expect.objectContaining({
                id: 'r-1', title: 'Din Tai Fung Xinsheng', countryCode: 'TW',
            }));
        });
    });

    it('publishes the saved row without throwing away unsaved edits', async () => {
        const user = userEvent.setup();
        render(<AdminRecommendationsPage />);

        await user.click((await screen.findAllByTestId('admin-recommendation-row'))[0]);
        await user.type(screen.getByLabelText('City'), ' City');
        await user.click(screen.getByRole('button', { name: /Publish now/ }));

        await waitFor(() => expect(mocks.adminSetRecommendationStatus).toHaveBeenCalledWith('r-1', 'published'));
        // Regression: the editor used to be replaced by the server copy.
        expect(screen.getByLabelText('City')).toHaveValue('Taipei City');
        expect(screen.queryByRole('button', { name: /Publish now/ })).not.toBeInTheDocument();
    });

    it('asks before discarding unsaved edits when starting a new entry', async () => {
        const user = userEvent.setup();
        mocks.confirm.mockResolvedValue(false);
        render(<AdminRecommendationsPage />);

        await user.click((await screen.findAllByTestId('admin-recommendation-row'))[0]);
        await user.type(screen.getByLabelText('Title'), '!');
        await user.click(screen.getByRole('button', { name: 'New recommendation' }));

        expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Discard unsaved changes?' }));
        expect(screen.getByLabelText('Title')).toHaveValue('Din Tai Fung!');
    });

    it('offers import and new entry when a country is empty', async () => {
        mocks.adminGetRecommendationCatalog.mockResolvedValue({ rows: [], countries: [] });
        render(<AdminRecommendationsPage />);

        expect(await screen.findByText('Nothing in TW yet')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Import bundled/ })).toBeInTheDocument();
    });

    it('ignores a stale catalog response that lands after a newer one', async () => {
        const user = userEvent.setup();
        let resolveJapan: (value: unknown) => void = () => undefined;
        mocks.adminGetRecommendationCatalog
            .mockResolvedValueOnce({ rows: [row('r-1', 'Din Tai Fung')], countries: ['TW', 'JP'] })
            .mockImplementationOnce(() => new Promise((resolve) => { resolveJapan = resolve; }))
            .mockResolvedValueOnce({ rows: [row('r-1', 'Din Tai Fung')], countries: ['TW', 'JP'] });
        render(<AdminRecommendationsPage />);
        expect(await screen.findByText('Din Tai Fung')).toBeInTheDocument();

        await user.click(screen.getByRole('combobox', { name: 'Country' }));
        await user.click(await screen.findByRole('option', { name: 'JP' }));
        await user.click(screen.getByRole('combobox', { name: 'Country' }));
        await user.click(await screen.findByRole('option', { name: 'TW' }));
        await waitFor(() => expect(mocks.adminGetRecommendationCatalog).toHaveBeenCalledTimes(3));
        expect(await screen.findByText('Din Tai Fung')).toBeInTheDocument();

        // The slower JP response arrives last and must not replace the TW list.
        resolveJapan({ rows: [row('jp-1', 'Fushimi Inari', 'published', { country_code: 'JP' })], countries: ['TW', 'JP'] });
        await new Promise((resolve) => window.setTimeout(resolve, 20));
        expect(screen.queryByText('Fushimi Inari')).not.toBeInTheDocument();
        expect(screen.getByText('Din Tai Fung')).toBeInTheDocument();
    });
});
