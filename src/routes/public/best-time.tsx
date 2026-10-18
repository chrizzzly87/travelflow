import { createFileRoute } from '@tanstack/react-router';
import { BestTimeToTravelPage } from '../../../pages/inspirations/BestTimeToTravelPage';
export const Route = createFileRoute("/_public/{-$locale}/inspirations/best-time-to-travel")({ component: BestTimeToTravelPage });
