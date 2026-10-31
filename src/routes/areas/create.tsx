import { createFileRoute, Outlet } from '@tanstack/react-router';
import { validateRouteLocale } from '../../../app/routing/localePolicy';
import { createTripRouteSearchSchema } from '../../../features/trips/createTripRouteSearch';
export const Route = createFileRoute('/_create')({ ssr: false, validateSearch: createTripRouteSearchSchema, beforeLoad: ({ params }) => validateRouteLocale(params), component: Outlet });
