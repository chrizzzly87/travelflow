import React, { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { hydrateStart } from '@tanstack/react-start/client';
import { RouterProvider } from '@tanstack/react-router';
import { registerServiceWorker } from '../services/serviceWorkerRegistration';

async function hydrateApplication() {
    const router = await hydrateStart();
    startTransition(() => { hydrateRoot(document, <StrictMode><RouterProvider router={router} /></StrictMode>); });
    registerServiceWorker();
}
void hydrateApplication();
