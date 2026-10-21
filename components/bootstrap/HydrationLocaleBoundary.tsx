import React, { useState } from 'react';
import { useRouter } from '@tanstack/react-router';
import { I18nextProvider } from 'react-i18next';
import { useHydrated } from '../../hooks/useHydrated';

/** Pending SSR chrome must hydrate with its delivered translation snapshot,
 * even if the live browser instance has already restored another language.
 * Keep that instance for the pending presentation; the actual route uses live i18n. */
export function HydrationLocaleBoundary({ children }: { children: React.ReactNode }) {
    const { context } = useRouter().options;
    const hydrated = useHydrated();
    const [instance] = useState(() => hydrated ? context.i18n : context.hydrationI18n ?? context.i18n);
    return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
