import { createFileRoute } from '@tanstack/react-router';
import { PrivacyPage } from '../../../pages/PrivacyPage';
export const Route = createFileRoute("/_public/{-$locale}/privacy")({ component: PrivacyPage });
