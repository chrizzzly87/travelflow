import { describe, expect, it } from 'vitest';
import { ADMIN_NAV_ITEMS } from '../../components/admin/adminNavConfig';

describe('admin navigation config', () => {
  it('includes OG tools entry in tools section', () => {
    const ogTools = ADMIN_NAV_ITEMS.find((item) => item.id === 'og_tools');
    expect(ogTools).toBeTruthy();
    expect(ogTools?.path).toBe('/admin/og-tools');
    expect(ogTools?.section).toBe('tools');
  });

  it('includes design playground entry in tools section', () => {
    const designPlayground = ADMIN_NAV_ITEMS.find((item) => item.id === 'design_system_playground');
    expect(designPlayground).toBeTruthy();
    expect(designPlayground?.path).toBe('/admin/design-system-playground');
    expect(designPlayground?.section).toBe('tools');
  });
});
