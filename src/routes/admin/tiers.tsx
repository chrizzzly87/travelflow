import { createFileRoute } from '@tanstack/react-router';
import { AdminTiersPage } from '../../../pages/AdminTiersPage';
export const Route = createFileRoute("/_admin/admin/tiers")({ component: AdminTiersPage });
