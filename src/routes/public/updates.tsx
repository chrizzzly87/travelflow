import { createFileRoute } from '@tanstack/react-router';
import { UpdatesPage } from '../../../pages/UpdatesPage';
export const Route = createFileRoute("/_public/{-$locale}/updates")({ component: UpdatesPage });
