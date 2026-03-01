import { describe, expect, it } from 'vitest';

describe('pages/AdminAuditPage module', () => {
  it('loads the page component without module errors', async () => {
    const module = await import('../../pages/AdminAuditPage');
    expect(typeof module.AdminAuditPage).toBe('function');
  });
});
