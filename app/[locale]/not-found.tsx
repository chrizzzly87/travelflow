import React from 'react';
import { NotFoundPage } from '../../views/NotFoundPage';

// Locale-aware content is derived client-side by NotFoundPage from the URL;
// the app-shell namespaces it needs are provided by the root layout.
export default function NotFound() {
    return <NotFoundPage />;
}
