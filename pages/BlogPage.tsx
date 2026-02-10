import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Article, Clock, Tag, ArrowRight, MagnifyingGlass } from '@phosphor-icons/react';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { getPublishedBlogPosts } from '../services/blogService';
import type { BlogPost } from '../services/blogService';

const BLOG_CARD_IMAGE_SIZES = '(min-width: 1280px) 24vw, (min-width: 1024px) 30vw, (min-width: 640px) 46vw, 100vw';
const BLOG_CARD_TRANSITION = 'transform-gpu will-change-transform transition-[transform,box-shadow,border-color] duration-300 ease-out motion-reduce:transition-none';
const BLOG_CARD_IMAGE_TRANSITION = 'transform-gpu will-change-transform transition-transform duration-500 ease-out motion-reduce:transition-none';
const BLOG_CARD_IMAGE_FADE = 'pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/30 via-slate-900/8 to-transparent';
const BLOG_CARD_IMAGE_PROGRESSIVE_BLUR = 'pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-slate-950/12 backdrop-blur-md [mask-image:linear-gradient(to_top,black_0%,rgba(0,0,0,0.65)_44%,transparent_100%)]';

const BlogCard: React.FC<{ post: BlogPost }> = ({ post }) => {
    const [hasImageError, setHasImageError] = useState(false);
    const showImage = !hasImageError;
    const formattedDate = new Date(post.publishedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    return (
        <Link
            to={`/blog/${post.slug}`}
            className={`group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${BLOG_CARD_TRANSITION} hover:-translate-y-0.5 hover:shadow-lg`}
        >
            <div className={`relative h-36 overflow-hidden rounded-t-2xl md:h-40 ${showImage ? 'bg-slate-100' : `${post.coverColor} flex items-center justify-center`}`}>
                {showImage ? (
                    <>
                        <picture className="absolute inset-0 block h-full w-full">
                            <source
                                type="image/webp"
                                srcSet={`${post.images.card.sources.small} 768w, ${post.images.card.sources.large} 1536w`}
                                sizes={BLOG_CARD_IMAGE_SIZES}
                            />
                            <img
                                src={post.images.card.sources.small}
                                srcSet={`${post.images.card.sources.small} 768w, ${post.images.card.sources.large} 1536w`}
                                sizes={BLOG_CARD_IMAGE_SIZES}
                                alt={post.images.card.alt}
                                loading="lazy"
                                decoding="async"
                                fetchPriority="low"
                                width={1536}
                                height={1024}
                                onError={() => setHasImageError(true)}
                                className={`absolute inset-0 h-full w-full rounded-t-2xl object-cover ${BLOG_CARD_IMAGE_TRANSITION} scale-100 group-hover:scale-[1.03]`}
                            />
                        </picture>
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
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500 line-clamp-3">
                    {post.summary}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1">
                        <Clock size={13} weight="duotone" className="text-accent-400" />
                        {post.readingTimeMin} min read
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
    const posts = useMemo(() => getPublishedBlogPosts(), []);
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [search, setSearch] = useState('');

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
                    post.tags.some((t) => t.toLowerCase().includes(q))
            );
        }
        return result;
    }, [posts, selectedTag, search]);

    const isSearching = search.trim().length > 0;

    return (
        <MarketingLayout>
            {/* Hero */}
            <section className="pt-8 pb-8 md:pt-14 md:pb-12 animate-hero-entrance">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-200 bg-accent-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-accent-700">
                    <Article size={14} weight="duotone" />
                    Blog
                </span>
                <h1
                    className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-6xl"
                    style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                    Travel Planning Insights
                </h1>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
                    Guides, tips, and deep-dives to help you plan smarter trips — from weekend getaways to multi-city adventures.
                </p>
            </section>

            {/* Search */}
            <section className="pb-4 animate-hero-stagger" style={{ '--stagger': '100ms' } as React.CSSProperties}>
                <div className="relative max-w-xl">
                    <MagnifyingGlass size={18} weight="duotone" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search articles…"
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-accent-400 focus:outline-none focus:ring-2 focus:ring-accent-200 transition-shadow"
                    />
                    {isSearching && (
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                            {filteredPosts.length} result{filteredPosts.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>
            </section>

            {/* Tag filter */}
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
                        All
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

            {/* Cards grid */}
            <section className="pb-16 md:pb-24">
                {filteredPosts.length === 0 ? (
                    <p className="text-sm text-slate-400">
                        {isSearching
                            ? <>No articles found for &ldquo;{search}&rdquo;. Try a different keyword.</>
                            : 'No posts found for this tag.'}
                    </p>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {filteredPosts.map((post) => (
                            <div key={post.slug} className="animate-scroll-fade-up">
                                <BlogCard post={post} />
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Bottom CTA */}
            <section className="pb-16 md:pb-24 animate-scroll-scale-in">
                <div className="relative rounded-3xl bg-gradient-to-br from-accent-600 to-accent-800 px-8 py-14 text-center md:px-16 md:py-20 overflow-hidden">
                    <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/10 blur-[60px]" />
                    <h2
                        className="relative text-3xl font-black tracking-tight text-white md:text-5xl"
                        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                        Ready to plan your trip?
                    </h2>
                    <p className="relative mx-auto mt-4 max-w-xl text-base text-accent-100 md:text-lg">
                        Turn these ideas into a real itinerary. Our AI builds your day-by-day plan in seconds.
                    </p>
                    <Link
                        to="/create-trip"
                        className="relative mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-3.5 text-base font-bold text-accent-700 shadow-lg transition-all hover:shadow-xl hover:bg-accent-50 hover:scale-[1.03] active:scale-[0.98]"
                    >
                        Start Planning
                        <ArrowRight size={18} weight="bold" />
                    </Link>
                </div>
            </section>
        </MarketingLayout>
    );
};
