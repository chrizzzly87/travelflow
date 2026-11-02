import { createFileRoute } from '@tanstack/react-router';
import { BlogPage } from '../../../pages/BlogPage';
export const Route = createFileRoute("/_public/{-$locale}/blog")({ component: BlogPage });
