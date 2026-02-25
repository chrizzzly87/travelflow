import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import path from "node:path";
import { COUNTRY_TRAVEL_DATA } from "../data/countryTravelData.ts";
import { exampleTripCards } from "../data/exampleTripCards.ts";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  buildSiteOgMetadata,
  enumerateSiteOgPathnames,
  type SiteOgMetadata,
} from "../netlify/edge-lib/site-og-metadata.ts";

export const SITE_OG_IMAGE_WIDTH = 1200;
export const SITE_OG_IMAGE_HEIGHT = 630;
export const SITE_OG_STATIC_DIR_RELATIVE = "public/images/og/site/generated";
export const SITE_OG_STATIC_PUBLIC_PREFIX = "/images/og/site/generated";
export const SITE_OG_STATIC_MANIFEST_FILE_NAME = "manifest.json";
export const SITE_OG_STATIC_MANIFEST_RELATIVE_PATH = `${SITE_OG_STATIC_DIR_RELATIVE}/${SITE_OG_STATIC_MANIFEST_FILE_NAME}`;
export const SITE_OG_BUILD_ORIGIN = "https://travelflowapp.netlify.app";

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
  locales?: string[];
  includePaths?: string[];
  includePrefixes?: string[];
  excludePaths?: string[];
  excludePrefixes?: string[];
}

const SUPPORTED_LOCALE_SET = new Set<string>(SUPPORTED_LOCALES);

const truncateText = (value: string, max: number): string => {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(1, max - 1))}…`;
};

const wrapText = (value: string, maxChars: number, maxLines: number): string[] => {
  const words = value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (words.length === 0) return [value];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word.slice(0, maxChars));
      current = word.slice(maxChars);
    }

    if (lines.length >= maxLines) break;
  }

  if (lines.length < maxLines && current) {
    lines.push(current);
  }

  if (lines.length > maxLines) {
    lines.length = maxLines;
  }

  if (lines.length === maxLines) {
    const joined = lines.join(" ");
    if (joined.length < value.length) {
      const last = lines[maxLines - 1].replace(/…+$/g, "");
      lines[maxLines - 1] = truncateText(last, maxChars);
    }
  }

  return lines;
};

const escapeSvgText = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

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

export interface SiteOgResolvedPathFilterOptions {
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
  const localeValues = normalizeFilterValues(options.locales, (value) => value.toLowerCase());
  const locales = localeValues.filter((value) => SUPPORTED_LOCALE_SET.has(value));
  const includePaths = normalizeFilterValues(options.includePaths, normalizePath);
  const includePrefixes = normalizeFilterValues(options.includePrefixes, normalizePrefix);
  const excludePaths = normalizeFilterValues(options.excludePaths, normalizePath);
  const excludePrefixes = normalizeFilterValues(options.excludePrefixes, normalizePrefix);

  return {
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
  const pathnames = enumerateSiteOgPathnames({
    blogSlugs: collectBlogSlugs(),
    countryNames: collectCountryNames(),
    exampleTemplateIds: collectExampleTemplateIds(),
  });

  const resolvedFilters = resolveSiteOgStaticPathFilterOptions(options);

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
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 16);

export const buildSiteOgStaticFileName = (routeKey: string, hash: string): string =>
  `${toSlug(routeKey)}-${hash}.png`;

const buildSvgTextLine = (value: string, x: number, y: number, className: string): string =>
  `<text x="${x}" y="${y}" class="${className}">${escapeSvgText(value)}</text>`;

export const renderSiteOgStaticSvg = (payload: SiteOgStaticRenderPayload): string => {
  const titleLines = wrapText(payload.title, 30, 3);
  const descriptionLines = wrapText(payload.description, 56, 3);
  const pill = payload.pill || "TRAVELFLOW";
  const displayPath = truncateText(payload.path || "/", 56);

  const titleText = titleLines
    .map((line, index) => buildSvgTextLine(line, 92, 194 + (index * 62), "title"))
    .join("\n");

  const descriptionText = descriptionLines
    .map((line, index) => buildSvgTextLine(line, 92, 382 + (index * 38), "description"))
    .join("\n");

  const tint = payload.blogTint && /^#[0-9a-f]{6}$/i.test(payload.blogTint)
    ? payload.blogTint.toLowerCase()
    : "#4f46e5";
  const tintStrength = Number.parseInt(payload.blogTintIntensity || "60", 10);
  const normalizedStrength = Number.isFinite(tintStrength)
    ? Math.max(0, Math.min(100, tintStrength))
    : 60;
  const overlayOpacity = (normalizedStrength / 100) * 0.45;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SITE_OG_IMAGE_WIDTH}" height="${SITE_OG_IMAGE_HEIGHT}" viewBox="0 0 ${SITE_OG_IMAGE_WIDTH} ${SITE_OG_IMAGE_HEIGHT}">`,
    "  <defs>",
    "    <linearGradient id=\"bg\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">",
    "      <stop offset=\"0%\" stop-color=\"#f8fafc\" />",
    "      <stop offset=\"52%\" stop-color=\"#e5e7eb\" />",
    "      <stop offset=\"100%\" stop-color=\"#e0e7ff\" />",
    "    </linearGradient>",
    "    <linearGradient id=\"rightPanel\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">",
    "      <stop offset=\"0%\" stop-color=\"#312e81\" />",
    "      <stop offset=\"100%\" stop-color=\"#4f46e5\" />",
    "    </linearGradient>",
    "    <style>",
    "      .pill { fill: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: 0.5px; font-family: 'Bricolage Grotesque', 'Segoe UI', 'Arial', sans-serif; }",
    "      .title { fill: #111827; font-size: 58px; font-weight: 800; letter-spacing: -1.2px; font-family: 'Bricolage Grotesque', 'Segoe UI', 'Arial', sans-serif; }",
    "      .description { fill: #334155; font-size: 34px; font-weight: 500; font-family: 'Bricolage Grotesque', 'Segoe UI', 'Arial', sans-serif; }",
    "      .site { fill: #111827; font-size: 30px; font-weight: 700; font-family: 'Bricolage Grotesque', 'Segoe UI', 'Arial', sans-serif; }",
    "      .path { fill: #475569; font-size: 21px; font-weight: 500; font-family: 'Bricolage Grotesque', 'Segoe UI', 'Arial', sans-serif; }",
    "      .accent { fill: #c7d2fe; font-size: 20px; font-weight: 700; letter-spacing: 1px; font-family: 'Bricolage Grotesque', 'Segoe UI', 'Arial', sans-serif; }",
    "    </style>",
    "  </defs>",
    "  <rect x=\"0\" y=\"0\" width=\"1200\" height=\"630\" fill=\"url(#bg)\" />",
    "  <rect x=\"44\" y=\"38\" width=\"762\" height=\"554\" rx=\"28\" fill=\"rgba(255,255,255,0.9)\" stroke=\"rgba(148,163,184,0.28)\" />",
    "  <rect x=\"828\" y=\"38\" width=\"328\" height=\"554\" rx=\"28\" fill=\"url(#rightPanel)\" />",
    `  <rect x=\"828\" y=\"38\" width=\"328\" height=\"554\" rx=\"28\" fill=\"${tint}\" opacity=\"${overlayOpacity.toFixed(3)}\" />`,
    "  <rect x=\"92\" y=\"76\" width=\"256\" height=\"58\" rx=\"29\" fill=\"#4f46e5\" />",
    `  ${buildSvgTextLine(pill, 114, 113, "pill")}`,
    `  ${titleText}`,
    `  ${descriptionText}`,
    "  <rect x=\"92\" y=\"518\" width=\"670\" height=\"1\" fill=\"rgba(148,163,184,0.42)\" />",
    `  ${buildSvgTextLine("TravelFlow", 92, 560, "site")}`,
    `  ${buildSvgTextLine(displayPath, 324, 560, "path")}`,
    "  <circle cx=\"992\" cy=\"128\" r=\"38\" fill=\"rgba(199,210,254,0.28)\" />",
    "  <circle cx=\"1092\" cy=\"212\" r=\"22\" fill=\"rgba(199,210,254,0.2)\" />",
    "  <circle cx=\"936\" cy=\"258\" r=\"14\" fill=\"rgba(199,210,254,0.32)\" />",
    `  ${buildSvgTextLine(payload.blogImage ? "BLOG PREVIEW" : "SITE PREVIEW", 884, 560, "accent")}`,
    "</svg>",
  ].join("\n");
};

export const buildSiteOgManifestRevision = (entries: Record<string, { path: string; hash: string }>): string => {
  const payload = JSON.stringify(
    Object.entries(entries)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([routeKey, value]) => [routeKey, value.path, value.hash]),
  );

  return createHash("sha256").update(payload).digest("hex").slice(0, 12);
};
