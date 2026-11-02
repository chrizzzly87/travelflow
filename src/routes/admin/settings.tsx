import { createFileRoute } from '@tanstack/react-router';
import { AdminGlobalSettingsPage } from '../../../pages/AdminGlobalSettingsPage';
export const Route = createFileRoute("/_admin/admin/settings")({ component: AdminGlobalSettingsPage });
