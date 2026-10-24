import { createFileRoute, Outlet } from '@tanstack/react-router';
import { validateRouteLocale } from '../../../app/routing/localePolicy';
import { publicDocumentCacheHeaders } from '../../../app/routing/cachePolicy';
export const Route = createFileRoute('/_public')({
    beforeLoad: ({ params }) => validateRouteLocale(params),
    headers: () => publicDocumentCacheHeaders,
    component: Outlet,
});
