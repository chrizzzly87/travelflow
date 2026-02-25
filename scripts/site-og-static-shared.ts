import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import path from "node:path";
import { COUNTRY_TRAVEL_DATA } from "../data/countryTravelData.ts";
import { exampleTripCards } from "../data/exampleTripCards.ts";
import {
  DEFAULT_LOCALE,
  DEFAULT_SITE_OG_STATIC_SCOPE,
  SITE_OG_STATIC_SCOPE_VALUES,
  SUPPORTED_LOCALES,
  buildSiteOgMetadata,
  enumerateSiteOgPathnames,
  type SiteOgStaticScope,
  type SiteOgMetadata,
} from "../netlify/edge-lib/site-og-metadata.ts";

export const SITE_OG_IMAGE_WIDTH = 1200;
export const SITE_OG_IMAGE_HEIGHT = 630;
export const SITE_OG_STATIC_DIR_RELATIVE = "public/images/og/site/generated";
export const SITE_OG_STATIC_PUBLIC_PREFIX = "/images/og/site/generated";
export const SITE_OG_STATIC_MANIFEST_FILE_NAME = "manifest.json";
export const SITE_OG_STATIC_MANIFEST_RELATIVE_PATH = `${SITE_OG_STATIC_DIR_RELATIVE}/${SITE_OG_STATIC_MANIFEST_FILE_NAME}`;
export const SITE_OG_BUILD_ORIGIN = "https://travelflowapp.netlify.app";
export const SITE_OG_STATIC_TEMPLATE_REVISION = "2026-02-25-site-og-single-renderer-v5";
export const SITE_OG_STATIC_TARGET_SCOPE_ENV = "SITE_OG_STATIC_TARGET_SCOPE";

export interface SiteOgStaticTarget {
  pathname: string;
  routeKey: string;
  metadata: SiteOgMetadata;
}

export interface SiteOgStaticRenderPayload {
  routeKey: string;
  title: string;
  description: string;
  path: string;
  pill: string;
  blogImage: string;
  blogRevision: string;
  blogTint: string;
  blogTintIntensity: string;
}

export interface SiteOgStaticPathFilterOptions {
  targetScope?: SiteOgStaticScope;
  locales?: string[];
  includePaths?: string[];
  includePrefixes?: string[];
  excludePaths?: string[];
  excludePrefixes?: string[];
}

const SUPPORTED_LOCALE_SET = new Set<string>(SUPPORTED_LOCALES);
const SITE_OG_STATIC_SCOPE_SET = new Set<string>(SITE_OG_STATIC_SCOPE_VALUES);

const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "route";

const splitListItem = (value: string): string[] =>
  value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

const normalizePath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!trimmed.startsWith("/")) return `/${trimmed}`;
  return trimmed;
};

const normalizePrefix = (value: string): string => {
  const normalized = normalizePath(value);
  if (!normalized) return "";
  if (normalized.length > 1 && normalized.endsWith("/")) {
    return normalized.slice(0, -1);
  }
  return normalized;
};

const getLocaleForPathname = (pathname: string): string => {
  const match = pathname.match(/^\/([a-z]{2})(\/|$)/i);
  const localeCandidate = match?.[1]?.toLowerCase();
  if (localeCandidate && SUPPORTED_LOCALE_SET.has(localeCandidate)) {
    return localeCandidate;
  }
  return DEFAULT_LOCALE;
};

const matchesPrefix = (pathname: string, prefix: string): boolean => {
  if (!prefix || prefix === "/") return true;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
};

const normalizeFilterValues = (values: string[] | undefined, normalizer: (value: string) => string): string[] => {
  if (!values?.length) return [];
  return Array.from(
    new Set(
      values
        .flatMap(splitListItem)
        .map(normalizer)
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));
};

const resolveScopeValue = (value: string | undefined): SiteOgStaticScope | null => {
  const normalized = (value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (!SITE_OG_STATIC_SCOPE_SET.has(normalized)) return null;
  return normalized as SiteOgStaticScope;
};

export const resolveSiteOgStaticTargetScope = (
  options: SiteOgStaticPathFilterOptions = {},
  env: NodeJS.ProcessEnv = process.env,
): SiteOgStaticScope => {
  const explicitScope = options.targetScope ? resolveScopeValue(options.targetScope) : null;
  if (explicitScope) return explicitScope;

  const envScope = resolveScopeValue(env[SITE_OG_STATIC_TARGET_SCOPE_ENV]);
  if (envScope) return envScope;

  return DEFAULT_SITE_OG_STATIC_SCOPE;
};

export interface SiteOgResolvedPathFilterOptions {
  targetScope: SiteOgStaticScope;
  locales: string[];
  includePaths: string[];
  includePrefixes: string[];
  excludePaths: string[];
  excludePrefixes: string[];
  hasFilters: boolean;
}

export const resolveSiteOgStaticPathFilterOptions = (
  options: SiteOgStaticPathFilterOptions = {},
): SiteOgResolvedPathFilterOptions => {
  const targetScope = resolveSiteOgStaticTargetScope(options);
  const localeValues = normalizeFilterValues(options.locales, (value) => value.toLowerCase());
  const locales = localeValues.filter((value) => SUPPORTED_LOCALE_SET.has(value));
  const includePaths = normalizeFilterValues(options.includePaths, normalizePath);
  const includePrefixes = normalizeFilterValues(options.includePrefixes, normalizePrefix);
  const excludePaths = normalizeFilterValues(options.excludePaths, normalizePath);
  const excludePrefixes = normalizeFilterValues(options.excludePrefixes, normalizePrefix);

  return {
    targetScope,
    locales,
    includePaths,
    includePrefixes,
    excludePaths,
    excludePrefixes,
    hasFilters: Boolean(
      locales.length
      || includePaths.length
      || includePrefixes.length
      || excludePaths.length
      || excludePrefixes.length,
    ),
  };
};

const shouldIncludePathname = (pathname: string, options: SiteOgResolvedPathFilterOptions): boolean => {
  if (options.locales.length > 0) {
    const locale = getLocaleForPathname(pathname);
    if (!options.locales.includes(locale)) return false;
  }

  if (options.includePaths.length > 0 && !options.includePaths.includes(pathname)) {
    return false;
  }

  if (options.includePrefixes.length > 0 && !options.includePrefixes.some((prefix) => matchesPrefix(pathname, prefix))) {
    return false;
  }

  if (options.excludePaths.includes(pathname)) return false;

  if (options.excludePrefixes.some((prefix) => matchesPrefix(pathname, prefix))) return false;

  return true;
};

const collectBlogSlugs = (): string[] => {
  const contentDir = path.join(process.cwd(), "content", "blog");

  const slugs = readdirSync(contentDir)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => fileName.replace(/\.md$/i, "").trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  return slugs;
};

const collectCountryNames = (): string[] => {
  const names = COUNTRY_TRAVEL_DATA.countries
    .map((country) => country.countryName.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  return Array.from(new Set(names));
};

const collectExampleTemplateIds = (): string[] => {
  const ids = exampleTripCards
    .map((card) => card.templateId?.trim() || "")
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  return Array.from(new Set(ids));
};

export const collectSiteOgPathnames = (options: SiteOgStaticPathFilterOptions = {}): string[] => {
  const resolvedFilters = resolveSiteOgStaticPathFilterOptions(options);
  const pathnames = enumerateSiteOgPathnames({
    blogSlugs: collectBlogSlugs(),
    countryNames: collectCountryNames(),
    exampleTemplateIds: collectExampleTemplateIds(),
    scope: resolvedFilters.targetScope,
  });

  return Array.from(new Set(pathnames))
    .filter((pathname) => shouldIncludePathname(pathname, resolvedFilters))
    .sort((left, right) => left.localeCompare(right));
};

export const collectSiteOgStaticTargets = (
  origin = SITE_OG_BUILD_ORIGIN,
  options: SiteOgStaticPathFilterOptions = {},
): SiteOgStaticTarget[] => {
  const pathnames = collectSiteOgPathnames(options);
  const targetsByRouteKey = new Map<string, SiteOgStaticTarget>();

  for (const pathname of pathnames) {
    const metadata = buildSiteOgMetadata(new URL(pathname, origin));

    if (!targetsByRouteKey.has(metadata.routeKey)) {
      targetsByRouteKey.set(metadata.routeKey, {
        pathname,
        routeKey: metadata.routeKey,
        metadata,
      });
    }
  }

  return Array.from(targetsByRouteKey.values()).sort((left, right) => left.routeKey.localeCompare(right.routeKey));
};

export const buildSiteOgStaticRenderPayload = (metadata: SiteOgMetadata): SiteOgStaticRenderPayload => ({
  routeKey: metadata.routeKey,
  title: metadata.ogImageParams.title,
  description: metadata.ogImageParams.description,
  path: metadata.ogImageParams.path,
  pill: metadata.ogImageParams.pill || "",
  blogImage: metadata.ogImageParams.blog_image || "",
  blogRevision: metadata.ogImageParams.blog_rev || "",
  blogTint: metadata.ogImageParams.blog_tint || "",
  blogTintIntensity: metadata.ogImageParams.blog_tint_intensity || "",
});

export const computeSiteOgStaticPayloadHash = (payload: SiteOgStaticRenderPayload): string =>
  createHash("sha256")
    .update(JSON.stringify({
      templateRevision: SITE_OG_STATIC_TEMPLATE_REVISION,
      payload,
    }))
    .digest("hex")
    .slice(0, 16);

export const buildSiteOgStaticFileName = (routeKey: string, hash: string): string =>
  `${toSlug(routeKey)}-${hash}.png`;

export const buildSiteOgManifestRevision = (entries: Record<string, { path: string; hash: string }>): string => {
  const payload = JSON.stringify(
    Object.entries(entries)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([routeKey, value]) => [routeKey, value.path, value.hash]),
  );

  return createHash("sha256").update(payload).digest("hex").slice(0, 12);
};
