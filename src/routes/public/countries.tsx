import { createFileRoute } from '@tanstack/react-router';
import { CountriesPage } from '../../../pages/inspirations/CountriesPage';
export const Route = createFileRoute("/_public/{-$locale}/inspirations/countries")({ component: CountriesPage });
