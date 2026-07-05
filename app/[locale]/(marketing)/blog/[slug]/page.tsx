import type { Metadata } from 'next';
import React from 'react';
import { BlogPostPage } from '../../../../../views/BlogPostPage';
import { I18nProvider } from '../../../../../components/providers/I18nProvider';
import { loadLocaleResources } from '../../../../../lib/i18n/resources';
import { buildPageTitle, getServerT } from '../../../../../lib/i18n/server';
import { getBlogPostBySlugWithFallback } from '../../../../../services/blogService';
import { normalizeAppLanguage } from '../../../../../utils';

interface PageProps {
    params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, slug } = await params;
    const post = getBlogPostBySlugWithFallback(slug, normalizeAppLanguage(locale));
    if (post) {
        return { title: buildPageTitle(post.title) };
    }
    const t = await getServerT(locale, ['common']);
    return { title: buildPageTitle(t('nav.blog')) };
}

export default async function Page({ params }: PageProps) {
    const { locale } = await params;
    const resources = await loadLocaleResources(locale, ['blog']);

    return (
        <I18nProvider locale={locale} resources={resources}>
            <BlogPostPage />
        </I18nProvider>
    );
}
