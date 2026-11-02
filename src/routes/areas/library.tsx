import { createFileRoute, Outlet } from '@tanstack/react-router';
import { validateRouteLocale } from '../../../app/routing/localePolicy';
export const Route = createFileRoute('/_library')({ ssr: false, beforeLoad: ({ params }) => validateRouteLocale(params), component: Outlet });
