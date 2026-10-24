import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireRouteAccess } from '../../../features/auth/routeAccess';
export const Route = createFileRoute('/_admin')({ staticData: { sessionBound: true }, ssr: false, beforeLoad: ({ location }) => requireRouteAccess(location.href, true), component: Outlet });
