import { describe, expect, it } from 'vitest';
import { summarizeAdminTripDrafts, type AdminTripDraftRecord } from '../../services/adminService';
import { resolveTripDraftRangeStart } from '../../pages/AdminTripDraftsPage';
import { ADMIN_NAV_ITEMS } from '../../components/admin/adminNavConfig';
import { resolveAdminDocumentTitle } from '../../shared/adminScreenTitles';

const draft = (overrides: Partial<AdminTripDraftRecord>): AdminTripDraftRecord => ({
  id: 'drf_x', title: 'x', start_date: null, source: 'mcp', client_name: 'ChatGPT', client_model: null,
  city_count: 2, activity_count: 5, country_codes: [], status: 'draft', view_count: 0, last_viewed_at: null,
  claim_count: 0, first_claimed_at: null, first_claimed_by: null, first_claimed_by_email: null,
  first_claimed_trip_id: null, expires_at: null, created_at: '2026-10-31T00:00:00Z', ...overrides,
});

describe('admin trip drafts', () => {
  it('summarises conversion by channel and assistant', () => {
    const stats = summarizeAdminTripDrafts([
      draft({ claim_count: 2, status: 'claimed', view_count: 3 }),
      draft({ source: 'paste', client_name: null, view_count: 1 }),
      draft({ source: 'paste', status: 'expired' }),
    ]);
    expect(stats).toMatchObject({ created_count: 3, claimed_count: 1, claim_total: 2, view_total: 4, expired_count: 1 });
    expect(stats.by_source).toEqual({ mcp: { created: 1, claimed: 1 }, paste: { created: 2, claimed: 0 } });
    expect(stats.by_client).toEqual({ chatgpt: { created: 2, claimed: 1 }, unknown: { created: 1, claimed: 0 } });
  });

  it('turns the shell date range into a start timestamp', () => {
    const now = Date.UTC(2026, 9, 31);
    expect(resolveTripDraftRangeStart('7d', now)).toBe(new Date(Date.UTC(2026, 9, 24)).toISOString());
    expect(resolveTripDraftRangeStart('all', now)).toBeNull();
  });

  it('is reachable from the admin navigation with a document title', () => {
    expect(ADMIN_NAV_ITEMS.find((item) => item.path === '/admin/trip-drafts')?.label).toBe('AI trip drafts');
    expect(resolveAdminDocumentTitle('/admin/trip-drafts')).toBe('AI trip drafts · Admin');
  });
});
