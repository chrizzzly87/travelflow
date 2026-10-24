import { createFileRoute } from '@tanstack/react-router';
import { ThemesPage } from '../../../pages/inspirations/ThemesPage';
export const Route = createFileRoute("/_public/{-$locale}/inspirations/themes")({ component: ThemesPage });
