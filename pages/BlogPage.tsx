import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Article, Clock, Tag, ArrowRight, MagnifyingGlass, GlobeHemisphereWest } from '@phosphor-icons/react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { getPublishedBlogPostsForLocales } from '../services/blogService';
import { ProgressiveImage } from '../components/ProgressiveImage';
import type { BlogPost } from '../services/blogService';
import { buildLocalizedMarketingPath, buildPath, extractLocaleFromPath } from '../config/routes';
import { DEFAULT_LOCALE, localeToIntlLocale } from '../config/locales';
import { AppLanguage } from '../types';

const BLOG_CARD_IMAGE_SIZES = '(min-width: 1280px) 24vw, (min-width: 1024px) 30vw, (min-width: 640px) 46vw, 100vw';
const BLOG_CARD_TRANSITION = 'transform-gpu will-change-transform transition-[transform,box-shadow,border-color] duration-300 ease-out motion-reduce:transition-none';
const BLOG_CARD_IMAGE_TRANSITION = 'transform-gpu will-change-transform transition-transform duration-500 ease-out motion-reduce:transition-none';
const BLOG_CARD_IMAGE_FADE = 'pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/30 via-slate-900/8 to-transparent';
const BLOG_CARD_IMAGE_PROGRESSIVE_BLUR = 'pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-slate-950/12 backdrop-blur-md [mask-image:linear-gradient(to_top,black_0%,rgba(0,0,0,0.65)_44%,transparent_100%)]';
type BlogLanguageFilter = 'nativeOnly' | 'englishOnly' | 'nativeAndEnglish';

const BlogCard: React.FC<{ post: BlogPost; locale: AppLanguage }> = ({ post, locale }) => {
    const { t } = useTranslation('blog');
    const [hasImageError, setHasImageError] = useState(false);
    const showImage = !hasImageError;
    const postLocale = post.language === DEFAULT_LOCALE ? DEFAULT_LOCALE : post.language;
    const showEnglishBadge = locale !== DEFAULT_LOCALE && post.language === DEFAULT_LOCALE;
    const formattedDate = new Date(post.publishedAt).toLocaleDateString(localeToIntlLocale(locale), {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    return (
        <Link
            to={buildLocalizedMarketingPath('blogPost', postLocale, { slug: post.slug })}
            className={`group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${BLOG_CARD_TRANSITION} hover:-translate-y-0.5 hover:shadow-lg`}
        >
            <div className={`relative aspect-[2/1] overflow-hidden rounded-t-2xl ${showImage ? 'bg-slate-100' : `${post.coverColor} flex items-center justify-center`}`}>
                {showImage ? (
                    <>
                        <ProgressiveImage
                            src={post.images.card.sources.large}
                            alt={post.images.card.alt}
                            width={1536}
                            height={1024}
                            sizes={BLOG_CARD_IMAGE_SIZES}
                            srcSetWidths={[480, 768, 1024, 1536]}
                            placeholderKey={post.images.card.sources.large}
                            loading="lazy"
                            fetchPriority="low"
                            onError={() => setHasImageError(true)}
                            className={`absolute inset-0 h-full w-full rounded-t-2xl object-cover ${BLOG_CARD_IMAGE_TRANSITION} scale-100 group-hover:scale-[1.03]`}
                        />
                        <div className={BLOG_CARD_IMAGE_FADE} />
                        <div className={BLOG_CARD_IMAGE_PROGRESSIVE_BLUR} />
                    </>
                ) : (
                    <Article size={36} weight="duotone" className="text-slate-400/40" />
                )}
            </div>
            <div className="flex flex-1 flex-col p-5">
                <h3 className="text-base font-bold text-slate-900 group-hover:text-accent-700 transition-colors line-clamp-2">
                    {post.title}
                </h3>
                {showEnglishBadge && (
                    <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        <span aria-hidden="true">🇬🇧</span>
                        {t('index.englishArticleNotice')}
                    </p>
                )}
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500 line-clamp-3">
                    {post.summary}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1">
                        <Clock size={13} weight="duotone" className="text-accent-400" />
                        {t('index.readTime', { minutes: post.readingTimeMin })}
                    </span>
                    <span>{formattedDate}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {post.tags.map((tag) => (
                        <span
                            key={tag}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            </div>
        </Link>
    );
};

export const BlogPage: React.FC = () => {
    const { t } = useTranslation('blog');
    const location = useLocation();
    const locale = extractLocaleFromPath(location.pathname) ?? DEFAULT_LOCALE;
    const supportsMixedLanguage = locale !== DEFAULT_LOCALE;
    const [languageFilter, setLanguageFilter] = useState<BlogLanguageFilter>(() =>
        supportsMixedLanguage ? 'nativeAndEnglish' : 'nativeOnly'
    );
    const postLocales = useMemo<AppLanguage[]>(() => {
        if (!supportsMixedLanguage) return [DEFAULT_LOCALE];
        if (languageFilter === 'nativeOnly') return [locale];
        if (languageFilter === 'englishOnly') return [DEFAULT_LOCALE];
        return [locale, DEFAULT_LOCALE];
    }, [languageFilter, locale, supportsMixedLanguage]);
    const posts = useMemo(() => getPublishedBlogPostsForLocales(postLocales), [postLocales]);
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    useEffect(() => {
        setLanguageFilter(supportsMixedLanguage ? 'nativeAndEnglish' : 'nativeOnly');
    }, [supportsMixedLanguage, locale]);

    const allTags = useMemo(() => {
        const tagSet = new Set<string>();
        for (const post of posts) {
            for (const tag of post.tags) {
                tagSet.add(tag);
            }
        }
        return Array.from(tagSet).sort();
    }, [posts]);

    const filteredPosts = useMemo(() => {
        let result = posts;
        if (selectedTag) {
            result = result.filter((post) => post.tags.includes(selectedTag));
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(
                (post) =>
                    post.title.toLowerCase().includes(q) ||
                    post.summary.toLowerCase().includes(q) ||
                    post.tags.some((tag) => tag.toLowerCase().includes(q))
            );
        }
        return result;
    }, [posts, selectedTag, search]);

    const isSearching = search.trim().length > 0;

    return (
        <MarketingLayout>
            <section className="pt-8 pb-8 md:pt-14 md:pb-12 animate-hero-entrance">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-700">
                    <Article size={14} weight="duotone" />
                    {t('index.pill')}
                </span>
                <h1
                    className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-6xl"
                    style={{ fontFamily: 'var(--tf-font-heading)' }}
                >
                    {t('index.title')}
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
                    {t('index.description')}
                </p>
            </section>

            <section className="pb-4 animate-hero-stagger" style={{ '--stagger': '100ms' } as React.CSSProperties}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="relative w-full md:max-w-xl">
                        <MagnifyingGlass size={18} weight="duotone" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={t('index.searchPlaceholder')}
                            className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-shadow"
                        />
                        {isSearching && (
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                                {filteredPosts.length === 1
                                    ? t('index.result', { count: filteredPosts.length })
                                    : t('index.results', { count: filteredPosts.length })}
                            </span>
                        )}
                    </div>
                    {supportsMixedLanguage && (
                        <div className="relative w-full md:w-72">
                            <GlobeHemisphereWest size={18} weight="duotone" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <select
                                aria-label={t('index.languageFilterAriaLabel')}
                                value={languageFilter}
                                onChange={(event) => setLanguageFilter(event.target.value as BlogLanguageFilter)}
                                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-10 text-sm font-medium text-slate-800 shadow-sm focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-shadow"
                            >
                                <option value="nativeAndEnglish">{t('index.languageFilter.nativeAndEnglish')}</option>
                                <option value="nativeOnly">{t('index.languageFilter.nativeOnly')}</option>
                                <option value="englishOnly">{t('index.languageFilter.englishOnly')}</option>
                            </select>
                            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">▾</span>
                        </div>
                    )}
                </div>
            </section>

            <section className="pb-8 animate-hero-stagger" style={{ '--stagger': '160ms' } as React.CSSProperties}>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setSelectedTag(null)}
                        className={`rounded-full px-3.5 py-1.5 text-sm font-medium shadow-sm transition-all ${
                            selectedTag === null
                                ? 'bg-accent-100 text-accent-800 ring-2 ring-accent-300'
                                : 'bg-white border border-slate-200 text-slate-600 hover:border-accent-300 hover:text-accent-700'
                        }`}
                    >
                        {t('common:buttons.all')}
                    </button>
                    {allTags.map((tag) => (
                        <button
                            key={tag}
                            onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                            className={`inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-medium shadow-sm transition-all ${
                                selectedTag === tag
                                    ? 'bg-accent-100 text-accent-800 ring-2 ring-accent-300'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:border-accent-300 hover:text-accent-700'
                            }`}
                        >
                            <Tag size={12} weight="duotone" />
                            {tag}
                        </button>
                    ))}
                </div>
            </section>

            <section className="pb-16 md:pb-24">
                {filteredPosts.length === 0 ? (
                    <p className="text-sm text-slate-400">
                        {isSearching
                            ? t('index.noSearch', { query: search })
                            : t('index.noTag')}
                    </p>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredPosts.map((post) => (
                            <div key={`${post.language}:${post.slug}`} className="animate-scroll-fade-up">
                                <BlogCard post={post} locale={locale} />
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="pb-16 md:pb-24 animate-scroll-scale-in">
                <div className="relative rounded-3xl bg-gradient-to-br from-accent-600 to-accent-800 px-8 py-14 text-center md:px-16 md:py-20 overflow-hidden">
                    <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/10 blur-[60px]" />
                    <h2
                        className="relative text-3xl font-black tracking-tight text-white md:text-5xl"
                        style={{ fontFamily: 'var(--tf-font-heading)' }}
                    >
                        {t('index.ctaTitle')}
                    </h2>
                    <p className="relative mx-auto mt-4 max-w-xl text-base text-accent-100 md:text-lg">
                        {t('index.ctaDescription')}
                    </p>
                    <Link
                        to={buildPath('createTrip')}
                        className="relative mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-3.5 text-base font-bold text-accent-700 shadow-lg transition-all hover:shadow-xl hover:bg-accent-50 hover:scale-[1.03] active:scale-[0.98]"
                    >
                        {t('common:buttons.startPlanning')}
                        <ArrowRight size={18} weight="bold" />
                    </Link>
                </div>
            </section>
        </MarketingLayout>
    );
};
