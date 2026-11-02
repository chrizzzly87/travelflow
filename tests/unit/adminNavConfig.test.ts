import { describe, expect, it } from 'vitest';
import { ADMIN_NAV_ITEMS, ADMIN_NAV_SECTIONS, findActiveAdminNavItem } from '../../components/admin/adminNavConfig';

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

  it('includes worker health entry in tools section', () => {
    const workerHealth = ADMIN_NAV_ITEMS.find((item) => item.id === 'ai_worker_health');
    expect(workerHealth).toBeTruthy();
    expect(workerHealth?.path).toBe('/admin/ai-benchmark/worker-health');
    expect(workerHealth?.section).toBe('tools');
  });

  it('includes airports entry in content section', () => {
    const airports = ADMIN_NAV_ITEMS.find((item) => item.id === 'airports');
    expect(airports).toBeTruthy();
    expect(airports?.path).toBe('/admin/airports');
    expect(airports?.section).toBe('content');
  });

  it('gives every item a declared section and a unique path', () => {
    const sectionIds = new Set(ADMIN_NAV_SECTIONS.map((section) => section.id));
    for (const item of ADMIN_NAV_ITEMS) expect(sectionIds.has(item.section)).toBe(true);
    const paths = ADMIN_NAV_ITEMS.map((item) => item.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('keeps the unlisted component playground out of the nav', () => {
    expect(ADMIN_NAV_ITEMS.some((item) => item.path.includes('component-playground'))).toBe(false);
  });

  it('resolves the active item by the longest matching path', () => {
    expect(findActiveAdminNavItem('/admin/ai-benchmark/telemetry')?.id).toBe('ai_telemetry');
    expect(findActiveAdminNavItem('/admin/ai-benchmark')?.id).toBe('ai_benchmark');
    expect(findActiveAdminNavItem('/admin/ai-benchmark/')?.id).toBe('ai_benchmark');
    expect(findActiveAdminNavItem('/admin/users')?.id).toBe('users');
    expect(findActiveAdminNavItem('/admin/usersx')).toBeNull();
    expect(findActiveAdminNavItem('/admin/component-playground')).toBeNull();
  });
});
