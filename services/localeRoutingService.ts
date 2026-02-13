import { buildLocalizedMarketingPath, getBlogSlugFromPath, isLocalizedMarketingPath, isToolRoute, localizeMarketingPath } from '../config/routes';
import { AppLanguage } from '../types';
import { getBlogPostBySlugWithFallback } from './blogService';

interface BuildLocalizedLocationInput {
    pathname: string;
    search?: string;
    hash?: string;
    targetLocale: AppLanguage;
}

export const buildLocalizedLocation = ({ pathname, search = '', hash = '', targetLocale }: BuildLocalizedLocationInput): string => {
    if (isToolRoute(pathname)) {
        return `${pathname}${search}${hash}`;
    }

    if (!isLocalizedMarketingPath(pathname)) {
        return `${buildLocalizedMarketingPath('home', targetLocale)}${hash}`;
    }

    const blogSlug = getBlogSlugFromPath(pathname);
    if (blogSlug) {
        const blogPost = getBlogPostBySlugWithFallback(blogSlug, targetLocale);
        if (!blogPost) {
            return `${buildLocalizedMarketingPath('home', targetLocale)}${hash}`;
        }
    }

    const localizedPath = localizeMarketingPath(pathname, targetLocale);
    return `${localizedPath}${search}${hash}`;
};
