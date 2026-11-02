import { createFileRoute } from '@tanstack/react-router';
import { CountryDetailPage } from '../../../pages/inspirations/CountryDetailPage';
export const Route = createFileRoute("/_public/{-$locale}/inspirations/country/$countryName")({ component: CountryDetailPage });
