import { createFileRoute } from '@tanstack/react-router';
import { CookiesPage } from '../../../pages/CookiesPage';
export const Route = createFileRoute("/_public/{-$locale}/cookies")({ component: CookiesPage });
