// @vitest-environment jsdom
import React, { useState } from 'react';
import { act, fireEvent, waitFor } from '@testing-library/react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { createInstance } from 'i18next';
import { I18nextProvider, initReactI18next, useTranslation } from 'react-i18next';
import { createMemoryHistory, createRootRouteWithContext, createRouter, RouterProvider } from '@tanstack/react-router';
import { afterEach, expect, it } from 'vitest';
import { HydrationLocaleBoundary } from '../../components/bootstrap/HydrationLocaleBoundary';

let mounted: Root | undefined;
let container: HTMLDivElement | undefined;
afterEach(async () => { await act(async () => { mounted?.unmount(); }); container?.remove(); mounted = undefined; });

it('hydrates pending chrome with the delivered language after the live preference has changed', async () => {
    const live = createInstance();
    await live.use(initReactI18next).init({ lng: 'en', fallbackLng: 'en', resources: {
        en: { common: { account: 'Account' } }, de: { common: { account: 'Konto' } },
    } });
    const delivered = live.cloneInstance({ lng: 'en' });
    function Chrome() { const { t } = useTranslation('common'); return <button>{t('account')}</button>; }
    const root = createRootRouteWithContext<{ i18n: typeof live; hydrationI18n: typeof live }>()({
        component: function Presentation() {
            const [pending, setPending] = useState(true);
            return <><button onClick={() => setPending(false)}>Present route</button>{pending
                ? <HydrationLocaleBoundary><Chrome /></HydrationLocaleBoundary>
                : <I18nextProvider i18n={live}><Chrome /></I18nextProvider>}</>;
        },
    });
    const router = createRouter({ routeTree: root, context: { i18n: live, hydrationI18n: delivered }, history: createMemoryHistory({ initialEntries: ['/'] }) });
    await router.load();
    const html = renderToString(<RouterProvider router={router} />);
    expect(html).toContain('Account');
    await live.changeLanguage('de');
    expect(delivered.language).toBe('en');
    container = document.createElement('div');
    container.innerHTML = html;
    document.body.append(container);
    const errors: unknown[] = [];
    await act(async () => { mounted = hydrateRoot(container!, <RouterProvider router={router} />, { onRecoverableError: error => errors.push(error) }); });
    expect(container?.textContent).toContain('Account');
    fireEvent.click(container!.querySelector('button')!);
    await waitFor(() => expect(container?.textContent).toContain('Konto'));
    expect(errors).toEqual([]);
});
