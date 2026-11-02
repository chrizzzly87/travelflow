import { createFileRoute } from '@tanstack/react-router';
import { AdminTripDraftsPage } from '../../../pages/AdminTripDraftsPage';
export const Route = createFileRoute("/_admin/admin/trip-drafts")({ component: AdminTripDraftsPage });
