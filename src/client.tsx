import React, { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { StartClient } from '@tanstack/react-start/client';
import { registerServiceWorker } from '../services/serviceWorkerRegistration';

// StartClient restores the router inside React's hydration lifetime. Awaiting
// hydrateStart before creating the React root signals native completion too early.
startTransition(() => {
    hydrateRoot(document, <StrictMode><StartClient /></StrictMode>);
});
registerServiceWorker();
