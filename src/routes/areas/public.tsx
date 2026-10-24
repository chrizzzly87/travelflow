import { createFileRoute, Outlet } from '@tanstack/react-router';
import { validateRouteLocale } from '../../../app/routing/localePolicy';
export const Route = createFileRoute('/_public')({ beforeLoad: ({ params }) => validateRouteLocale(params), component: Outlet });
