import { createFileRoute } from '@tanstack/react-router';
import { AdminAuditPage } from '../../../pages/AdminAuditPage';
export const Route = createFileRoute("/_admin/admin/audit")({ component: AdminAuditPage });
