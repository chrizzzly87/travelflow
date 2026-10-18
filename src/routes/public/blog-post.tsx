import { createFileRoute, notFound } from '@tanstack/react-router';
import { getBlogPostBySlugWithFallback } from '../../../services/blogService';
import { normalizeLocale } from '../../../config/locales';
import { BlogPostPage } from '../../../pages/BlogPostPage';
export const Route = createFileRoute("/_public/{-$locale}/blog/$slug")({
    loader: ({ params }) => {
        if (!getBlogPostBySlugWithFallback(params.slug, normalizeLocale(params.locale))) throw notFound();
    },
    component: BlogPostPage,
});
