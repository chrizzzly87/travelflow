// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { readAdminCache, writeAdminCache } from '../../../components/admin/adminLocalCache';

describe('components/admin/adminLocalCache', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns fallback when cache key is missing', () => {
    expect(readAdminCache('admin.users.cache.v1', { rows: [] })).toEqual({ rows: [] });
  });

  it('writes and reads cached payloads', () => {
    writeAdminCache('admin.users.cache.v1', { rows: [{ id: 'u1' }] });
    expect(readAdminCache('admin.users.cache.v1', { rows: [] })).toEqual({ rows: [{ id: 'u1' }] });
  });

  it('returns fallback for malformed stored json', () => {
    window.localStorage.setItem('admin.users.cache.v1', '{invalid-json');
    expect(readAdminCache('admin.users.cache.v1', { rows: ['fallback'] })).toEqual({ rows: ['fallback'] });
  });
});
