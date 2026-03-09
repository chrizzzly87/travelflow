// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  getStoredSidebarCollapseState,
  isDevAdminBypassDisabled,
  persistSidebarCollapseState,
} from '../../../components/admin/AdminShell';

describe('components/admin/AdminShell storage helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('reads and writes sidebar collapse state', () => {
    expect(getStoredSidebarCollapseState()).toBe(false);

    persistSidebarCollapseState(true);
    expect(getStoredSidebarCollapseState()).toBe(true);
    expect(window.localStorage.getItem('tf_admin_sidebar_collapsed_v1')).toBe('1');

    persistSidebarCollapseState(false);
    expect(getStoredSidebarCollapseState()).toBe(false);
    expect(window.localStorage.getItem('tf_admin_sidebar_collapsed_v1')).toBe('0');
  });

  it('reads dev-admin bypass disabled flag from session storage', () => {
    expect(isDevAdminBypassDisabled()).toBe(false);

    window.sessionStorage.setItem('tf_dev_admin_bypass_disabled', '1');
    expect(isDevAdminBypassDisabled()).toBe(true);
  });
});
