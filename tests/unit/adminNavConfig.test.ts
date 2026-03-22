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

  it('includes worker health entry in tools section', () => {
    const workerHealth = ADMIN_NAV_ITEMS.find((item) => item.id === 'ai_worker_health');
    expect(workerHealth).toBeTruthy();
    expect(workerHealth?.path).toBe('/admin/ai-benchmark/worker-health');
    expect(workerHealth?.section).toBe('tools');
  });

  it('includes airports entry in operations section', () => {
    const airports = ADMIN_NAV_ITEMS.find((item) => item.id === 'airports');
    expect(airports).toBeTruthy();
    expect(airports?.path).toBe('/admin/airports');
    expect(airports?.section).toBe('operations');
  });
});
