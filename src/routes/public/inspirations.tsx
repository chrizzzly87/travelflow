import { createFileRoute } from '@tanstack/react-router';
import { InspirationsPage } from '../../../pages/InspirationsPage';
export const Route = createFileRoute("/_public/{-$locale}/inspirations")({ component: InspirationsPage });
