import { createFileRoute } from '@tanstack/react-router';
import { AdminTripsPage } from '../../../pages/AdminTripsPage';
export const Route = createFileRoute("/_admin/admin/trips")({ component: AdminTripsPage });
