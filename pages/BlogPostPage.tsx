import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, User, Tag, ArrowRight, Compass, Article } from '@phosphor-icons/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MarketingLayout } from '../components/marketing/MarketingLayout';
import { getBlogPostBySlug, getPublishedBlogPosts } from '../services/blogService';
import type { Components } from 'react-markdown';

const BLOG_HEADER_IMAGE_SIZES = '(min-width: 1280px) 76rem, (min-width: 1024px) 88vw, 100vw';
const BLOG_HEADER_IMAGE_FADE = 'pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/28 via-slate-900/10 to-transparent';
const BLOG_HEADER_IMAGE_PROGRESSIVE_BLUR = 'pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-slate-950/12 backdrop-blur-md [mask-image:linear-gradient(to_top,black_0%,rgba(0,0,0,0.68)_40%,transparent_100%)]';
const BLOG_DEFERRED_SECTION_STYLE: React.CSSProperties = {
    contentVisibility: 'auto',
    containIntrinsicSize: '1px 720px',
};

/** Convert heading text to a URL-safe slug */
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
                style={{ fontFamily: "var(--tf-font-heading)" }}
            >
                {children}
            </h2>
        );
    },
    h3: ({ children }) => (
        <h3 className="mt-8 mb-3 text-xl font-bold text-slate-800" style={{ fontFamily: "var(--tf-font-heading)" }}>
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

/** Extract h2 headings from markdown for TOC */
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

/** Hook: track which heading is currently visible */
const useActiveHeading = (headingSlugs: string[]): string | null => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const observerRef = useRef<IntersectionObserver | null>(null);

    const handleIntersect = useCallback((entries: IntersectionObserverEntry[]) => {
        // Find the topmost visible heading
        const visible = entries
            .filter((e) => e.isIntersecting)
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
            const el = document.getElementById(slug);
            if (el) observerRef.current.observe(el);
        }

        return () => {
            observerRef.current?.disconnect();
        };
    }, [headingSlugs, handleIntersect]);

    return activeId;
};

export const BlogPostPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const post = useMemo(() => (slug ? getBlogPostBySlug(slug) : undefined), [slug]);
    const [hasHeaderImageError, setHasHeaderImageError] = useState(false);

    const relatedPosts = useMemo(() => {
        if (!post) return [];
        const allPosts = getPublishedBlogPosts();
        const postTags = new Set(post.tags);
        return allPosts
            .filter((p) => p.slug !== post.slug && p.tags.some((t) => postTags.has(t)))
            .slice(0, 3);
    }, [post]);

    const headings = useMemo(() => (post ? extractHeadings(post.content) : []), [post]);
    const headingSlugs = useMemo(() => headings.map((h) => h.slug), [headings]);
    const activeHeadingId = useActiveHeading(headingSlugs);

    useEffect(() => {
        setHasHeaderImageError(false);
    }, [post?.slug]);

    if (!post) {
        return (
            <MarketingLayout>
                <section className="py-20 text-center">
                    <h1 className="text-3xl font-black text-slate-900" style={{ fontFamily: "var(--tf-font-heading)" }}>
                        Post not found
                    </h1>
                    <p className="mt-4 text-slate-500">The blog post you're looking for doesn't exist.</p>
                    <Link
                        to="/blog"
                        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:bg-accent-700"
                    >
                        <ArrowLeft size={16} weight="bold" />
                        Back to Blog
                    </Link>
                </section>
            </MarketingLayout>
        );
    }

    const formattedDate = new Date(post.publishedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    });

    return (
        <MarketingLayout>
            {/* Reading progress bar — pure CSS scroll-driven */}
            <div className="reading-progress-bar" />

            <article className="pb-16 md:pb-24">
                {/* Back link */}
                <div className="pt-6 pb-4">
                    <Link
                        to="/blog"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-accent-700 transition-colors"
                    >
                        <ArrowLeft size={14} weight="bold" />
                        Back to Blog
                    </Link>
                </div>

                {/* Cover banner */}
                <div className={`relative mb-8 h-52 overflow-hidden rounded-2xl md:h-72 lg:h-80 ${hasHeaderImageError ? post.coverColor : 'bg-slate-100'}`}>
                    {!hasHeaderImageError && (
                        <>
                            <picture className="absolute inset-0 block h-full w-full">
                                <source
                                    type="image/webp"
                                    srcSet={[
                                        `${post.images.header.sources.xsmall} 480w`,
                                        `${post.images.header.sources.small} 768w`,
                                        `${post.images.header.sources.medium} 1024w`,
                                        `${post.images.header.sources.large} 1536w`,
                                    ].join(', ')}
                                    sizes={BLOG_HEADER_IMAGE_SIZES}
                                />
                                <img
                                    src={post.images.header.sources.medium}
                                    srcSet={[
                                        `${post.images.header.sources.xsmall} 480w`,
                                        `${post.images.header.sources.small} 768w`,
                                        `${post.images.header.sources.medium} 1024w`,
                                        `${post.images.header.sources.large} 1536w`,
                                    ].join(', ')}
                                    sizes={BLOG_HEADER_IMAGE_SIZES}
                                    alt={post.images.header.alt}
                                    loading="eager"
                                    decoding="async"
                                    fetchPriority="high"
                                    width={1536}
                                    height={1024}
                                    onError={() => setHasHeaderImageError(true)}
                                    className="absolute inset-0 h-full w-full object-cover"
                                />
                            </picture>
                            <div className={BLOG_HEADER_IMAGE_FADE} />
                            <div className={BLOG_HEADER_IMAGE_PROGRESSIVE_BLUR} />
                        </>
                    )}
                </div>

                {/* Two-column layout: content + sidebar */}
                <div className="flex gap-10 lg:gap-14">
                    {/* Main content */}
                    <div className="min-w-0 flex-1 max-w-3xl">
                        {/* Title */}
                        <h1
                            className="text-3xl font-black tracking-tight text-slate-900 md:text-5xl"
                            style={{ fontFamily: "var(--tf-font-heading)" }}
                        >
                            {post.title}
                        </h1>

                        {/* Meta row */}
                        <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                            <span className="inline-flex items-center gap-1.5">
                                <User size={14} weight="duotone" className="text-accent-400" />
                                {post.author}
                            </span>
                            <span>{formattedDate}</span>
                            <span className="inline-flex items-center gap-1.5">
                                <Clock size={14} weight="duotone" className="text-accent-400" />
                                {post.readingTimeMin} min read
                            </span>
                        </div>

                        {/* Tags */}
                        <div className="mt-4 flex flex-wrap gap-1.5">
                            {post.tags.map((tag) => (
                                <Link
                                    key={tag}
                                    to="/blog"
                                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500 hover:bg-slate-200 transition-colors"
                                >
                                    <Tag size={10} weight="duotone" />
                                    {tag}
                                </Link>
                            ))}
                        </div>

                        {/* Summary */}
                        <p className="mt-6 text-lg leading-relaxed text-slate-600 border-l-4 border-accent-200 pl-4">
                            {post.summary}
                        </p>

                        {/* Body */}
                        <div className="mt-10">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                {post.content}
                            </ReactMarkdown>
                        </div>
                    </div>

                    {/* Sidebar (hidden on mobile) */}
                    <aside className="hidden lg:block w-64 shrink-0" style={BLOG_DEFERRED_SECTION_STYLE}>
                        <div className="sticky top-24 space-y-8">
                            {/* In this article — styled TOC */}
                            {headings.length > 0 && (
                                <nav>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">In this article</h4>
                                    <ul className="relative border-l border-slate-200">
                                        {headings.map((heading) => {
                                            const isActive = activeHeadingId === heading.slug;
                                            return (
                                                <li key={heading.slug} className="relative">
                                                    {/* Active indicator bar */}
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

                            {/* Related articles */}
                            {relatedPosts.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Related</h4>
                                    <ul className="space-y-3">
                                        {relatedPosts.map((related) => (
                                            <li key={related.slug}>
                                                <Link
                                                    to={`/blog/${related.slug}`}
                                                    className="group flex items-start gap-2"
                                                >
                                                    <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${related.coverColor}`}>
                                                        <Article size={12} weight="duotone" className="text-slate-400" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-slate-700 group-hover:text-accent-700 transition-colors line-clamp-2 leading-snug">
                                                            {related.title}
                                                        </p>
                                                        <p className="mt-0.5 text-xs text-slate-400">{related.readingTimeMin} min</p>
                                                    </div>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* CTA */}
                            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-accent-50 to-white p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <Compass size={18} weight="duotone" className="text-accent-500" />
                                    <h4 className="text-sm font-bold text-slate-900">Plan your trip</h4>
                                </div>
                                <p className="text-xs leading-relaxed text-slate-500 mb-3">
                                    Turn what you've read into a real itinerary — AI-powered, day by day.
                                </p>
                                <Link
                                    to="/create-trip"
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-accent-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-accent-700 hover:shadow-md"
                                >
                                    Start Planning
                                    <ArrowRight size={12} weight="bold" />
                                </Link>
                            </div>

                            {/* Browse more */}
                            <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Explore</h4>
                                <div className="space-y-2">
                                    <Link to="/blog" className="flex items-center gap-2 text-sm text-slate-600 hover:text-accent-700 transition-colors">
                                        <Article size={14} weight="duotone" className="text-slate-400" />
                                        All articles
                                    </Link>
                                    <Link to="/inspirations" className="flex items-center gap-2 text-sm text-slate-600 hover:text-accent-700 transition-colors">
                                        <Compass size={14} weight="duotone" className="text-slate-400" />
                                        Trip inspirations
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </aside>
                </div>

                {/* Related posts — mobile (below content, visible on small screens) */}
                {relatedPosts.length > 0 && (
                    <div className="mt-16 border-t border-slate-200 pt-10 lg:hidden" style={BLOG_DEFERRED_SECTION_STYLE}>
                        <h2
                            className="text-xl font-black tracking-tight text-slate-900"
                            style={{ fontFamily: "var(--tf-font-heading)" }}
                        >
                            Related Articles
                        </h2>
                        <div className="mt-6 grid gap-4 sm:grid-cols-2">
                            {relatedPosts.map((related) => (
                                <Link
                                    key={related.slug}
                                    to={`/blog/${related.slug}`}
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
                                            {related.readingTimeMin} min read
                                        </p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </article>
        </MarketingLayout>
    );
};
