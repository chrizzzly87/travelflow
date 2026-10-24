import { createFileRoute } from '@tanstack/react-router';
import { AdminAccessDeniedPage } from '../../../pages/AdminAccessDeniedPage';
export const Route = createFileRoute("/_account/admin/access-denied")({ component: AdminAccessDeniedPage });
