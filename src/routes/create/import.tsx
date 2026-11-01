import { createFileRoute } from '@tanstack/react-router';
import { ImportTripPage } from '../../../pages/ImportTripPage';
export const Route = createFileRoute("/_create/{-$locale}/import-trip")({
    head: () => ({ meta: [{ name: 'robots', content: 'noindex, follow' }] }),
    component: ImportTripPage,
});
