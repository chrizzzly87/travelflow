// @vitest-environment jsdom
import React from 'react';
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ auth: { isAuthenticated: false, access: null as any }, save: vi.fn(), i18n: null as any }));
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: mocks.i18n }) }));
vi.mock('../../config/db', () => ({ DB_ENABLED: true }));
vi.mock('../../services/dbApi', () => ({ dbUpsertUserSettings: mocks.save }));
import { useAccountLanguageSync } from '../../features/auth/useAccountLanguageSync';
function Probe() { useAccountLanguageSync(); return null; }
afterEach(cleanup);
beforeEach(() => { mocks.i18n = new EventEmitter(); mocks.auth.access = null; mocks.auth.isAuthenticated = false; mocks.save.mockReset(); });
describe('account language synchronization', () => {
    it('does not overwrite a preference on mount or login; persists subsequent changes', async () => {
        const view = render(<Probe />);
        mocks.auth.isAuthenticated = true;
        mocks.auth.access = { userId: 'member', isAnonymous: false, accountStatus: 'active' };
        view.rerender(<Probe />);
        expect(mocks.save).not.toHaveBeenCalled();
        await act(async () => { mocks.i18n.emit('languageChanged', 'de'); });
        await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ language: 'de' }));
    });
    it('unsubscribes on logout and does not save anonymous or disabled preferences', async () => {
        mocks.auth.isAuthenticated = true;
        mocks.auth.access = { userId: 'member', isAnonymous: false, accountStatus: 'active' };
        const view = render(<Probe />);
        expect(mocks.i18n.listenerCount('languageChanged')).toBe(1);
        mocks.auth.access = { ...mocks.auth.access, accountStatus: 'disabled' };
        view.rerender(<Probe />);
        expect(mocks.i18n.listenerCount('languageChanged')).toBe(0);
        await act(async () => { mocks.i18n.emit('languageChanged', 'fr'); });
        expect(mocks.save).not.toHaveBeenCalled();
        mocks.auth.access = { ...mocks.auth.access, accountStatus: 'active', isAnonymous: true };
        view.rerender(<Probe />);
        expect(mocks.i18n.listenerCount('languageChanged')).toBe(0);
    });
});
