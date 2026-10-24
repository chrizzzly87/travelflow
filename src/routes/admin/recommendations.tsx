import { createFileRoute } from '@tanstack/react-router';
import { AdminRecommendationsPage } from '../../../pages/AdminRecommendationsPage';
export const Route = createFileRoute("/_admin/admin/recommendations")({ component: AdminRecommendationsPage });
