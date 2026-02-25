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
export const SITE_OG_STATIC_TEMPLATE_REVISION = "2026-02-25-site-og-classic-layout-v2";

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
const SITE_OG_BUILD_HOST = new URL(SITE_OG_BUILD_ORIGIN).host;
const ACCENT_200 = "#c7d2fe";
const ACCENT_500 = "#6366f1";
const ACCENT_600 = "#4f46e5";
const ACCENT_700 = "#4338ca";
const PLANE_GLYPH_PATH = "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";

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

const splitWord = (word: string, maxChars: number): string[] => {
  if (word.length <= maxChars) return [word];
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < word.length) {
    const remaining = word.length - cursor;
    const chunkSize = Math.min(remaining, remaining > maxChars ? maxChars - 1 : maxChars);
    const chunk = word.slice(cursor, cursor + chunkSize);
    cursor += chunkSize;
    chunks.push(cursor < word.length ? `${chunk}-` : chunk);
  }

  return chunks;
};

const wrapTitle = (value: string, maxChars: number, maxLines: number): string[] => {
  const words = value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .flatMap((word) => splitWord(word, maxChars));

  if (words.length === 0) return [value];

  const lines: string[] = [];
  let current = "";
  let index = 0;

  while (index < words.length) {
    const token = words[index];
    const candidate = current ? `${current} ${token}` : token;

    if (candidate.length <= maxChars) {
      current = candidate;
      index += 1;
      continue;
    }

    if (current) {
      lines.push(current);
      current = "";
      if (lines.length >= maxLines) break;
      continue;
    }

    lines.push(token);
    index += 1;
    if (lines.length >= maxLines) break;
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  const hasOverflow = index < words.length;
  if (hasOverflow && lines.length > 0) {
    const lastIndex = lines.length - 1;
    const raw = lines[lastIndex].replace(/…+$/g, "");
    const clipped = raw.length >= maxChars ? raw.slice(0, Math.max(1, maxChars - 1)) : raw;
    lines[lastIndex] = `${clipped}…`;
  }

  return lines;
};

const getSiteTitleSpec = (title: string): { lines: string[]; fontSize: number; lineHeight: number } => {
  const length = title.length;
  let fontSize = 70;
  let maxCharsPerLine = 17;

  if (length > 30) { fontSize = 58; maxCharsPerLine = 22; }
  if (length > 44) { fontSize = 48; maxCharsPerLine = 27; }
  if (length > 62) { fontSize = 42; maxCharsPerLine = 31; }
  if (length > 84) { fontSize = 36; maxCharsPerLine = 35; }

  return {
    lines: wrapTitle(title, maxCharsPerLine, 3),
    fontSize,
    lineHeight: fontSize <= 42 ? 48 : 58,
  };
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

const getBasePathForPathname = (pathname: string): string => {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "/";

  const localeCandidate = segments[0]?.toLowerCase();
  if (!localeCandidate || !SUPPORTED_LOCALE_SET.has(localeCandidate)) {
    return pathname;
  }

  if (segments.length === 1) return "/";
  return `/${segments.slice(1).join("/")}`;
};

const matchesPrefix = (pathname: string, prefix: string): boolean => {
  if (!prefix || prefix === "/") return true;
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
};

const matchesPathFilter = (
  pathname: string,
  filterPaths: string[],
  localeAwareFilters: boolean,
): boolean => {
  if (filterPaths.includes(pathname)) return true;
  if (!localeAwareFilters) return false;
  return filterPaths.includes(getBasePathForPathname(pathname));
};

const matchesPrefixFilter = (
  pathname: string,
  filterPrefixes: string[],
  localeAwareFilters: boolean,
): boolean => {
  if (filterPrefixes.some((prefix) => matchesPrefix(pathname, prefix))) return true;
  if (!localeAwareFilters) return false;
  const basePath = getBasePathForPathname(pathname);
  return filterPrefixes.some((prefix) => matchesPrefix(basePath, prefix));
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

  const localeAwarePathFilters = options.locales.length > 0;

  if (
    options.includePaths.length > 0
    && !matchesPathFilter(pathname, options.includePaths, localeAwarePathFilters)
  ) {
    return false;
  }

  if (
    options.includePrefixes.length > 0
    && !matchesPrefixFilter(pathname, options.includePrefixes, localeAwarePathFilters)
  ) {
    return false;
  }

  if (matchesPathFilter(pathname, options.excludePaths, localeAwarePathFilters)) return false;

  if (matchesPrefixFilter(pathname, options.excludePrefixes, localeAwarePathFilters)) return false;

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
    // Keep RTL routes dynamic to preserve Arabic-script shaping and custom font rendering.
    if (metadata.htmlDir === "rtl") continue;

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

const buildSvgTextLine = (
  value: string,
  x: number,
  y: number,
  className: string,
  extraAttributes = "",
): string =>
  `<text x="${x}" y="${y}" class="${className}"${extraAttributes}>${escapeSvgText(value)}</text>`;

export const renderSiteOgStaticSvg = (payload: SiteOgStaticRenderPayload): string => {
  const { lines: titleLines, fontSize: titleFontSize, lineHeight: titleLineHeight } = getSiteTitleSpec(payload.title);
  const descriptionLines = wrapText(
    payload.description,
    46,
    titleLines.length >= 3 ? 2 : 3,
  );
  const pill = payload.pill || "TravelFlow";
  const normalizedPath = (payload.path || "/").trim().startsWith("/") ? (payload.path || "/").trim() : `/${(payload.path || "/").trim()}`;
  const displayUrl = truncateText(`${SITE_OG_BUILD_HOST}${normalizedPath || "/"}`, 62);
  const pillWidth = Math.max(214, Math.min(340, (pill.length * 11) + 110));
  const titleStartY = 205;
  const descriptionStartY = titleStartY + (titleLines.length * titleLineHeight) + 56;

  const titleText = titleLines
    .map((line, index) => buildSvgTextLine(
      line,
      92,
      titleStartY + (index * titleLineHeight),
      "title",
      ` style="font-size:${titleFontSize}px"`,
    ))
    .join("\n");

  const descriptionText = descriptionLines
    .map((line, index) => buildSvgTextLine(line, 92, descriptionStartY + (index * 42), "description"))
    .join("\n");

  const tint = payload.blogTint && /^#[0-9a-f]{6}$/i.test(payload.blogTint)
    ? payload.blogTint.toLowerCase()
    : ACCENT_600;
  const tintStrength = Number.parseInt(payload.blogTintIntensity || "60", 10);
  const normalizedStrength = Number.isFinite(tintStrength)
    ? Math.max(0, Math.min(100, tintStrength))
    : 60;
  const overlayOpacity = payload.blogImage ? (normalizedStrength / 100) * 0.72 : 0;

  const contourPaths = [
    "M830 92C902 46 980 46 1050 86c66 38 118 42 184 8",
    "M830 136C904 88 986 90 1060 128c66 34 118 36 180 8",
    "M830 182C906 132 990 134 1068 168c64 30 114 30 172 4",
    "M830 232C910 180 1000 184 1082 218c60 28 108 28 158 6",
    "M830 282C914 228 1008 232 1092 266c56 26 102 24 148 4",
    "M830 334C920 278 1020 284 1106 318c50 20 94 18 136 0",
    "M830 388C926 330 1030 336 1116 368c44 18 84 14 124-4",
    "M830 444C932 384 1038 392 1124 420c38 14 74 10 112-8",
    "M830 502C938 440 1048 448 1132 472c34 10 64 8 96-8",
    "M830 560C944 498 1056 506 1138 528c30 8 56 4 82-10",
  ].map((pathDef, index) =>
    `<path d="${pathDef}" fill="none" stroke="rgba(255,255,255,${(0.25 - (index * 0.01)).toFixed(3)})" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round" />`,
  ).join("\n");

  const accentContours = [
    "M854 156c42-34 94-34 138-2 42 30 92 30 136 0 42-30 90-30 126-2",
    "M866 332c46-36 100-38 146-4 44 34 96 34 140 2 42-30 88-32 122-6",
    "M876 506c48-38 104-40 152-6 46 34 98 34 142 2 40-30 84-32 116-8",
  ].map((pathDef) =>
    `<path d="${pathDef}" fill="none" stroke="rgba(199,210,254,0.34)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />`,
  ).join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SITE_OG_IMAGE_WIDTH}" height="${SITE_OG_IMAGE_HEIGHT}" viewBox="0 0 ${SITE_OG_IMAGE_WIDTH} ${SITE_OG_IMAGE_HEIGHT}">`,
    "  <defs>",
    "    <linearGradient id=\"bg\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">",
    "      <stop offset=\"0%\" stop-color=\"#f8fafc\" />",
    "      <stop offset=\"62%\" stop-color=\"#eef2ff\" />",
    "      <stop offset=\"100%\" stop-color=\"#e0e7ff\" />",
    "    </linearGradient>",
    "    <linearGradient id=\"rightPanel\" x1=\"0%\" y1=\"0%\" x2=\"100%\" y2=\"100%\">",
    `      <stop offset="0%" stop-color="${ACCENT_500}" />`,
    `      <stop offset="48%" stop-color="${ACCENT_600}" />`,
    `      <stop offset="100%" stop-color="${ACCENT_700}" />`,
    "    </linearGradient>",
    "    <style>",
    "      .pill { fill: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: 0.2px; font-family: 'Bricolage Grotesque', 'Avenir Next', 'Segoe UI', Arial, sans-serif; }",
    "      .title { fill: #0f172a; font-size: 58px; font-weight: 800; letter-spacing: -1.2px; font-family: 'Bricolage Grotesque', 'Avenir Next', 'Segoe UI', Arial, sans-serif; }",
    "      .description { fill: #334155; font-size: 30px; font-weight: 500; letter-spacing: 0; font-family: 'Bricolage Grotesque', 'Avenir Next', 'Segoe UI', Arial, sans-serif; }",
    "      .site { fill: #111827; font-size: 28px; font-weight: 700; font-family: 'Bricolage Grotesque', 'Avenir Next', 'Segoe UI', Arial, sans-serif; }",
    "      .path { fill: #475569; font-size: 20px; font-weight: 500; font-family: 'Bricolage Grotesque', 'Avenir Next', 'Segoe UI', Arial, sans-serif; }",
    "    </style>",
    "  </defs>",
    "  <rect x=\"0\" y=\"0\" width=\"1200\" height=\"630\" fill=\"url(#bg)\" />",
    "  <rect x=\"44\" y=\"38\" width=\"762\" height=\"554\" rx=\"28\" fill=\"rgba(255,255,255,0.9)\" stroke=\"rgba(148,163,184,0.28)\" />",
    "  <rect x=\"828\" y=\"38\" width=\"328\" height=\"554\" rx=\"28\" fill=\"url(#rightPanel)\" />",
    `  ${contourPaths}`,
    `  ${accentContours}`,
    overlayOpacity > 0
      ? `  <rect x="828" y="38" width="328" height="554" rx="28" fill="${tint}" opacity="${overlayOpacity.toFixed(3)}" />`
      : "",
    `  <rect x="92" y="76" width="${pillWidth}" height="58" rx="29" fill="${ACCENT_600}" />`,
    `  <path d="${PLANE_GLYPH_PATH}" transform="translate(110 92) scale(0.66)" fill="#ffffff" />`,
    `  <path d="${PLANE_GLYPH_PATH}" transform="translate(110 92) scale(0.66)" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="0.75" />`,
    `  ${buildSvgTextLine(pill, 146, 113, "pill")}`,
    `  ${titleText}`,
    `  ${descriptionText}`,
    "  <rect x=\"92\" y=\"518\" width=\"670\" height=\"1\" fill=\"rgba(148,163,184,0.42)\" />",
    `  <rect x="92" y="532" width="36" height="36" rx="10" fill="${ACCENT_600}" />`,
    `  <path d="${PLANE_GLYPH_PATH}" transform="translate(99 539) scale(0.44)" fill="#ffffff" />`,
    `  <path d="${PLANE_GLYPH_PATH}" transform="translate(99 539) scale(0.44)" fill="none" stroke="rgba(255,255,255,0.44)" stroke-width="0.7" />`,
    `  ${buildSvgTextLine("TravelFlow", 146, 560, "site")}`,
    `  ${buildSvgTextLine(displayUrl, 760, 560, "path", " text-anchor=\"end\"")}`,
    "</svg>",
  ].filter(Boolean).join("\n");
};

export const buildSiteOgManifestRevision = (entries: Record<string, { path: string; hash: string }>): string => {
  const payload = JSON.stringify(
    Object.entries(entries)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([routeKey, value]) => [routeKey, value.path, value.hash]),
  );

  return createHash("sha256").update(payload).digest("hex").slice(0, 12);
};
