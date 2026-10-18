import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireRouteAccess } from '../../../features/auth/routeAccess';
export const Route = createFileRoute('/_account')({ ssr: false, beforeLoad: ({ location }) => requireRouteAccess(location.href, false), component: Outlet });
