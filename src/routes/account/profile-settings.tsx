import { createFileRoute } from '@tanstack/react-router';
import { ProfileSettingsPage } from '../../../pages/ProfileSettingsPage';
export const Route = createFileRoute("/_account/profile/settings")({ component: ProfileSettingsPage });
