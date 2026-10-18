import { createFileRoute } from '@tanstack/react-router';
import { DestinationDetailPage } from '../../../pages/inspirations/DestinationDetailPage';
export const Route = createFileRoute("/_public/{-$locale}/inspirations/country/$countrySlug/$destinationSlug")({ component: DestinationDetailPage });
