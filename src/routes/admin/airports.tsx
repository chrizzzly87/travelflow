import { createFileRoute } from '@tanstack/react-router';
import { AdminAirportsPage } from '../../../pages/AdminAirportsPage';
export const Route = createFileRoute("/_admin/admin/airports")({ component: AdminAirportsPage });
