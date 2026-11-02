// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ location: { pathname: '/es/pricing', search: '?tag=one&tag=two', hash: '#details', state: null, key: 'test' }, navigate: vi.fn(), preload: vi.fn(), i18n: { resolvedLanguage: 'es', changeLanguage: vi.fn() } }));
vi.mock('../../app/navigation', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('../../hooks/useSafeRouteLocation', () => ({ useSafeRouteLocation: () => mocks.location }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: mocks.i18n }) }));
vi.mock('../../i18n', () => ({ preloadLocaleNamespaces: mocks.preload }));
import { useLocaleNavigation } from '../../hooks/useLocaleNavigation';
beforeEach(() => { vi.clearAllMocks(); mocks.location.pathname = '/es/pricing'; mocks.preload.mockResolvedValue(undefined); mocks.i18n.changeLanguage.mockResolvedValue(undefined); });
describe('native locale navigation ownership', () => {
    it('lets native public routing own language loading and preserves query/hash', async () => {
        const { result } = renderHook(useLocaleNavigation); await act(async () => result.current('en'));
        expect(mocks.navigate).toHaveBeenCalledWith('/pricing?tag=one&tag=two#details'); expect(mocks.preload).not.toHaveBeenCalled(); expect(mocks.i18n.changeLanguage).not.toHaveBeenCalled();
    });
    it('routes wizard locales through the supported native prefix', async () => {
        mocks.location.pathname = '/es/create-trip/wizard'; const { result } = renderHook(useLocaleNavigation); await act(async () => result.current('de'));
        expect(mocks.navigate).toHaveBeenCalledWith('/de/create-trip/wizard?tag=one&tag=two#details'); expect(mocks.i18n.changeLanguage).not.toHaveBeenCalled();
    });
    it('keeps unprefixed trip URLs stable while changing their browser language preference', async () => {
        mocks.location.pathname = '/trip/trip-a'; const { result } = renderHook(useLocaleNavigation); await act(async () => result.current('de'));
        expect(mocks.navigate).not.toHaveBeenCalled(); expect(mocks.preload).toHaveBeenCalledWith('de', expect.any(Array), mocks.i18n); expect(mocks.i18n.changeLanguage).toHaveBeenCalledWith('de');
    });
    it('does not apply an older language request after a newer choice', async () => {
        mocks.location.pathname = '/profile'; let finishOld!: () => void;
        mocks.preload.mockImplementationOnce(() => new Promise<void>(resolve => { finishOld = resolve; }));
        const { result } = renderHook(useLocaleNavigation);
        const old = result.current('fr'); await act(async () => result.current('de')); await act(async () => { finishOld(); await old; });
        expect(mocks.i18n.changeLanguage).toHaveBeenCalledExactlyOnceWith('de');
    });
});
