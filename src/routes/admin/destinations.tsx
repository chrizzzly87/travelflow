import { createFileRoute } from '@tanstack/react-router';
import { AdminDestinationsPage } from '../../../pages/AdminDestinationsPage';
export const Route = createFileRoute("/_admin/admin/destinations")({ component: AdminDestinationsPage });
