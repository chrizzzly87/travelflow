import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE } from '../../config/locales';
import {
  getAllBlogPosts,
  getBlogPostBySlug,
  getBlogPostBySlugWithFallback,
  getBlogPostTranslations,
  getBlogPostsBySlugs,
  getPublishedBlogPosts,
  getPublishedBlogPostsAllLocales,
  getPublishedBlogPostsForLocales,
  hasBlogPostInLocale,
} from '../../services/blogService';

describe('services/blogService', () => {
  it('loads and sorts blog posts by publishedAt desc', () => {
    const all = getAllBlogPosts();
    expect(all.length).toBeGreaterThan(0);

    for (let i = 1; i < all.length; i += 1) {
      expect(Date.parse(all[i - 1].publishedAt)).toBeGreaterThanOrEqual(Date.parse(all[i].publishedAt));
    }
  });

  it('filters published posts by locale', () => {
    const enPosts = getPublishedBlogPosts(DEFAULT_LOCALE);
    expect(enPosts.every((post) => post.status === 'published' && post.language === DEFAULT_LOCALE)).toBe(true);

    const multi = getPublishedBlogPostsForLocales(['en', 'de']);
    expect(multi.every((post) => post.status === 'published' && ['en', 'de'].includes(post.language))).toBe(true);
    expect(getPublishedBlogPostsForLocales([])).toEqual([]);

    const allLocales = getPublishedBlogPostsAllLocales();
    expect(allLocales.every((post) => post.status === 'published')).toBe(true);
  });

  it('resolves by slug, fallback locale, and locale existence', () => {
    const seedPost = getPublishedBlogPostsAllLocales()[0];
    expect(seedPost).toBeTruthy();

    const direct = getBlogPostBySlug(seedPost.slug, seedPost.language);
    expect(direct?.slug).toBe(seedPost.slug);

    const fallback = getBlogPostBySlugWithFallback(seedPost.slug, 'ko', seedPost.language);
    expect(fallback?.slug).toBe(seedPost.slug);
    expect(getBlogPostBySlugWithFallback('missing-slug', seedPost.language, seedPost.language)).toBeUndefined();

    expect(hasBlogPostInLocale(seedPost.slug, seedPost.language)).toBe(true);
  });

  it('returns translation group variants and slug batches', () => {
    const source = getPublishedBlogPostsAllLocales()[0];
    const translations = getBlogPostTranslations(source.translationGroup);
    expect(translations.length).toBeGreaterThan(0);
    expect(translations.every((post) => post.translationGroup === source.translationGroup)).toBe(true);

    const grouped = getBlogPostsBySlugs([source.slug], source.language);
    expect(grouped.some((post) => post.slug === source.slug)).toBe(true);

    expect(getBlogPostsBySlugs([], source.language)).toEqual([]);
    expect(getBlogPostsBySlugs(['missing-slug'], source.language)).toEqual([]);
  });
});
