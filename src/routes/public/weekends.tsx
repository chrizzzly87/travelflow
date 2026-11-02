import { createFileRoute } from '@tanstack/react-router';
import { WeekendGetawaysPage } from '../../../pages/inspirations/WeekendGetawaysPage';
export const Route = createFileRoute("/_public/{-$locale}/inspirations/weekend-getaways")({ component: WeekendGetawaysPage });
