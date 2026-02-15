import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Clock, User, Tag, ArrowRight, Compass, Article } from '@phosphor-icons/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { ProgressiveImage } from '../components/ProgressiveImage';
import { getBlogPostBySlugWithFallback, getPublishedBlogPostsForLocales } from '../services/blogService';
import { buildLocalizedMarketingPath, buildPath, extractLocaleFromPath } from '../config/routes';
import { DEFAULT_LOCALE, localeToIntlLocale } from '../config/locales';
import type { Components } from 'react-markdown';

const BLOG_HEADER_IMAGE_SIZES = '(min-width: 1280px) 76rem, (min-width: 1024px) 88vw, 100vw';
const BLOG_HEADER_IMAGE_FADE = 'pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/28 via-slate-900/10 to-transparent';
const BLOG_HEADER_IMAGE_PROGRESSIVE_BLUR = 'pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-slate-950/12 backdrop-blur-md [mask-image:linear-gradient(to_top,black_0%,rgba(0,0,0,0.68)_40%,transparent_100%)]';
const BLOG_DEFERRED_SECTION_STYLE: React.CSSProperties = {
    contentVisibility: 'auto',
    containIntrinsicSize: '1px 720px',
};

const toSlug = (text: string): string =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

const markdownComponents: Components = {
    h2: ({ children }) => {
        const text = typeof children === 'string' ? children : String(children);
        const id = toSlug(text);
        return (
            <h2
                id={id}
                className="mt-10 mb-4 text-2xl font-black tracking-tight text-slate-900 scroll-mt-24"
                style={{ fontFamily: 'var(--tf-font-heading)' }}
            >
                {children}
            </h2>
        );
    },
    h3: ({ children }) => (
        <h3 className="mt-8 mb-3 text-xl font-bold text-slate-800" style={{ fontFamily: 'var(--tf-font-heading)' }}>
            {children}
        </h3>
    ),
    p: ({ children }) => (
        <p className="mb-4 text-base leading-relaxed text-slate-600">{children}</p>
    ),
    a: ({ href, children }) => (
        <a href={href} className="text-accent-600 underline decoration-accent-300 hover:text-accent-800 transition-colors" target="_blank" rel="noopener noreferrer">
            {children}
        </a>
    ),
    ul: ({ children }) => (
        <ul className="mb-4 ml-6 list-disc space-y-1.5 text-base leading-relaxed text-slate-600">{children}</ul>
    ),
    ol: ({ children }) => (
        <ol className="mb-4 ml-6 list-decimal space-y-1.5 text-base leading-relaxed text-slate-600">{children}</ol>
    ),
    li: ({ children }) => <li>{children}</li>,
    code: ({ children, className }) => {
        const isInline = !className;
        if (isInline) {
            return <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm font-mono text-slate-700">{children}</code>;
        }
        return (
            <code className={`block overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm font-mono text-slate-200 ${className}`}>
                {children}
            </code>
        );
    },
    blockquote: ({ children }) => (
        <blockquote className="mb-4 border-l-4 border-accent-300 pl-4 italic text-slate-500">{children}</blockquote>
    ),
    table: ({ children }) => (
        <div className="mb-4 overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
                {children}
            </table>
        </div>
    ),
    thead: ({ children }) => (
        <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
            {children}
        </thead>
    ),
    th: ({ children }) => (
        <th className="px-4 py-2.5 border-b border-slate-200">{children}</th>
    ),
    td: ({ children }) => (
        <td className="px-4 py-2.5 border-b border-slate-100 text-slate-600">{children}</td>
    ),
    hr: () => <hr className="my-8 border-slate-200" />,
};

interface HeadingInfo {
    text: string;
    slug: string;
}

const extractHeadings = (content: string): HeadingInfo[] => {
    const lines = content.split('\n');
    const headings: HeadingInfo[] = [];
    for (const line of lines) {
        const match = line.match(/^##\s+(.+)$/);
        if (match) {
            const text = match[1].trim();
            headings.push({ text, slug: toSlug(text) });
        }
    }
    return headings;
};

const useActiveHeading = (headingSlugs: string[]): string | null => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    const handleIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
        const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
            setActiveId(visible[0].target.id);
        }
    }, []);

    useEffect(() => {
        if (headingSlugs.length === 0) return;

        observerRef.current = new IntersectionObserver(handleIntersect, {
            rootMargin: '-80px 0px -60% 0px',
            threshold: 0,
        });

        for (const slug of headingSlugs) {
            const element = document.getElementById(slug);
            if (element) observerRef.current.observe(element);
        }

        return () => {
            observerRef.current?.disconnect();
        };
    }, [headingSlugs, handleIntersect]);

    return activeId;
};

export const BlogPostPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const location = useLocation();
    const locale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
    const { t } = useTranslation('blog');

    const post = useMemo(() => (slug ? getBlogPostBySlugWithFallback(slug, locale) : undefined), [locale, slug]);
    const [hasHeaderImageError, setHasHeaderImageError] = useState(false);

    const relatedPosts = useMemo(() => {
        if (!post) return [];
        const relatedLocales = post.language === DEFAULT_LOCALE && locale !== DEFAULT_LOCALE
            ? [locale, DEFAULT_LOCALE]
            : [locale];
        const allPosts = getPublishedBlogPostsForLocales(relatedLocales);
        const postTags = new Set(post.tags);
        return allPosts
            .filter((entry) => entry.slug !== post.slug && entry.tags.some((tag) => postTags.has(tag)))
            .slice(0, 3);
    }, [locale, post]);

    const headings = useMemo(() => (post ? extractHeadings(post.content) : []), [post]);
    const headingSlugs = useMemo(() => headings.map((heading) => heading.slug), [headings]);
    const activeHeadingId = useActiveHeading(headingSlugs);

    useEffect(() => {
        setHasHeaderImageError(false);
    }, [post?.slug]);

    if (!post) {
        return <Navigate to={buildLocalizedMarketingPath('home', locale)} replace />;
    }

    const formattedDate = new Date(post.publishedAt).toLocaleDateString(localeToIntlLocale(locale), {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });
    const contentLang = post.language;
    const showEnglishContentNotice = locale !== DEFAULT_LOCALE && contentLang === DEFAULT_LOCALE;
    const canonicalPath = showEnglishContentNotice
        ? buildLocalizedMarketingPath('blogPost', DEFAULT_LOCALE, { slug: post.slug })
        : buildLocalizedMarketingPath('blogPost', locale, { slug: post.slug });

    useEffect(() => {
        if (typeof document === 'undefined') return;
        const canonicalHref = new URL(canonicalPath, window.location.origin).toString();
        let canonicalLink = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        if (!canonicalLink) {
            canonicalLink = document.createElement('link');
            canonicalLink.setAttribute('rel', 'canonical');
            document.head.appendChild(canonicalLink);
        }
        canonicalLink.setAttribute('href', canonicalHref);
    }, [canonicalPath]);

    return (
        <MarketingLayout>
            <div className="reading-progress-bar" />

            <div className="pb-16 md:pb-24">
                <div className="pt-6 pb-4">
                    <Link
                        to={buildLocalizedMarketingPath('blog', locale)}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-accent-700 transition-colors"
                    >
                        <ArrowLeft size={14} weight="bold" />
                        {t('common:buttons.backToBlog')}
                    </Link>
                </div>
                {showEnglishContentNotice && (
                    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                        <span className="inline-flex items-center gap-1.5">
                            <span aria-hidden="true">🇬🇧</span>
                            {t('index.englishArticleNotice')}
                        </span>
                    </div>
                )}

                <div className={`relative mb-8 h-52 overflow-hidden rounded-2xl md:h-72 lg:h-80 ${hasHeaderImageError ? post.coverColor : 'bg-slate-100'}`}>
                    {!hasHeaderImageError && (
                        <>
                            <ProgressiveImage
                                src={post.images.header.sources.large}
                                alt={post.images.header.alt}
                                width={1536}
                                height={1024}
                                sizes={BLOG_HEADER_IMAGE_SIZES}
                                srcSetWidths={[480, 768, 1024, 1536]}
                                placeholderKey={post.images.header.sources.large}
                                loading="eager"
                                fetchPriority="high"
                                onError={() => setHasHeaderImageError(true)}
                                className="absolute inset-0 h-full w-full object-cover"
                            />
                            <div className={BLOG_HEADER_IMAGE_FADE} />
                            <div className={BLOG_HEADER_IMAGE_PROGRESSIVE_BLUR} />
                        </>
                    )}
                </div>

                <div className="flex gap-10 lg:gap-14">
                    <div className="min-w-0 flex-1 max-w-3xl">
                        <article
                            lang={contentLang}
                            data-blog-content-lang={contentLang}
                            translate={showEnglishContentNotice ? 'no' : undefined}
                        >
                            <h1
                                className="text-3xl font-black tracking-tight text-slate-900 md:text-5xl"
                                style={{ fontFamily: 'var(--tf-font-heading)' }}
                            >
                                {post.title}
                            </h1>

                            <div lang={locale} className="mt-5 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                                <span className="inline-flex items-center gap-1.5">
                                    <User size={14} weight="duotone" className="text-accent-400" />
                                    {post.author}
                                </span>
                                <span>{formattedDate}</span>
                                <span className="inline-flex items-center gap-1.5">
                                    <Clock size={14} weight="duotone" className="text-accent-400" />
                                    {t('index.readTime', { minutes: post.readingTimeMin })}
                                </span>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-1.5">
                                {post.tags.map((tag) => (
                                    <Link
                                        key={tag}
                                        to={buildLocalizedMarketingPath('blog', locale)}
                                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 hover:bg-slate-200 transition-colors"
                                    >
                                        <Tag size={10} weight="duotone" />
                                        {tag}
                                    </Link>
                                ))}
                            </div>

                            <p className="mt-6 border-l-4 border-accent-200 pl-4 text-lg leading-relaxed text-slate-600">
                                {post.summary}
                            </p>

                            <div className="mt-10">
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                    {post.content}
                                </ReactMarkdown>
                            </div>
                        </article>
                    </div>

                    <aside className="hidden lg:block w-64 shrink-0" style={BLOG_DEFERRED_SECTION_STYLE}>
                        <div className="sticky top-24 space-y-8">
                            {headings.length > 0 && (
                                <nav>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{t('post.inThisArticle')}</h4>
                                    <ul className="relative border-l border-slate-200">
                                        {headings.map((heading) => {
                                            const isActive = activeHeadingId === heading.slug;
                                            return (
                                                <li key={heading.slug} className="relative">
                                                    <div
                                                        className={`absolute -left-px top-0 h-full w-0.5 rounded-full transition-colors duration-200 ${
                                                            isActive ? 'bg-accent-500' : 'bg-transparent'
                                                        }`}
                                                    />
                                                    <a
                                                        href={`#${heading.slug}`}
                                                        className={`block py-1.5 pl-4 text-[13px] leading-snug transition-colors duration-200 ${
                                                            isActive
                                                                ? 'font-semibold text-accent-700'
                                                                : 'text-slate-500 hover:text-slate-800'
                                                        }`}
                                                    >
                                                        {heading.text}
                                                    </a>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </nav>
                            )}

                            {relatedPosts.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{t('post.related')}</h4>
                                    <ul className="space-y-3">
                                        {relatedPosts.map((related) => (
                                            <li key={`${related.language}:${related.slug}`}>
                                                <Link
                                                    to={buildLocalizedMarketingPath('blogPost', locale, { slug: related.slug })}
                                                    lang={related.language}
                                                    data-blog-related-lang={related.language}
                                                    className="group flex items-start gap-2"
                                                >
                                                    <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${related.coverColor}`}>
                                                        <Article size={12} weight="duotone" className="text-slate-400" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-slate-700 group-hover:text-accent-700 transition-colors line-clamp-2 leading-snug">
                                                            {related.title}
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-slate-400">{t('index.readTime', { minutes: related.readingTimeMin })}</p>
                                                    </div>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-accent-50 to-white p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <Compass size={18} weight="duotone" className="text-accent-500" />
                                    <h4 className="text-sm font-bold text-slate-900">{t('post.planTripTitle')}</h4>
                                </div>
                                <p className="text-xs leading-relaxed text-slate-500 mb-3">
                                    {t('post.planTripDescription')}
                                </p>
                                <Link
                                    to={buildPath('createTrip')}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-accent-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-accent-700 hover:shadow-md"
                                >
                                    {t('common:buttons.startPlanning')}
                                    <ArrowRight size={12} weight="bold" />
                                </Link>
                            </div>

                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{t('post.explore')}</h4>
                                <div className="space-y-2">
                                    <Link to={buildLocalizedMarketingPath('blog', locale)} className="flex items-center gap-2 text-sm text-slate-600 hover:text-accent-700 transition-colors">
                                        <Article size={14} weight="duotone" className="text-slate-400" />
                                        {t('post.allArticles')}
                                    </Link>
                                    <Link to={buildLocalizedMarketingPath('inspirations', locale)} className="flex items-center gap-2 text-sm text-slate-600 hover:text-accent-700 transition-colors">
                                        <Compass size={14} weight="duotone" className="text-slate-400" />
                                        {t('post.tripInspirations')}
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>

                {relatedPosts.length > 0 && (
                    <div className="mt-16 border-t border-slate-200 pt-10 lg:hidden" style={BLOG_DEFERRED_SECTION_STYLE}>
                        <h2
                            className="text-xl font-black tracking-tight text-slate-900"
                            style={{ fontFamily: 'var(--tf-font-heading)' }}
                        >
                            {t('post.relatedArticles')}
                        </h2>
                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            {relatedPosts.map((related) => (
                                <Link
                                    key={`${related.language}:${related.slug}`}
                                    to={buildLocalizedMarketingPath('blogPost', locale, { slug: related.slug })}
                                    lang={related.language}
                                    data-blog-related-lang={related.language}
                                    className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                                >
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${related.coverColor}`}>
                                        <ArrowRight size={16} weight="bold" className="text-slate-400 group-hover:text-accent-600 transition-colors" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-sm font-bold text-slate-900 group-hover:text-accent-700 transition-colors line-clamp-2">
                                            {related.title}
                                        </h3>
                                        <p className="mt-1 text-xs text-slate-400">
                                            {t('index.readTime', { minutes: related.readingTimeMin })}
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </MarketingLayout>
    );
};
