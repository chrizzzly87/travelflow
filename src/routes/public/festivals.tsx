import { createFileRoute } from '@tanstack/react-router';
import { FestivalsPage } from '../../../pages/inspirations/FestivalsPage';
export const Route = createFileRoute("/_public/{-$locale}/inspirations/events-and-festivals")({ component: FestivalsPage });
