import { createFileRoute } from '@tanstack/react-router';
import { AdminBillingPage } from '../../../pages/AdminBillingPage';
export const Route = createFileRoute("/_admin/admin/billing")({ component: AdminBillingPage });
