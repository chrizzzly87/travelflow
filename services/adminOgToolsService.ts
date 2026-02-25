export type OgImageMode = "static" | "dynamic" | "unknown";
export type OgImageKind = "static-generated" | "dynamic-site" | "dynamic-trip" | "unknown" | "missing";

export interface OgHeadMetadata {
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogType: string;
  twitterCard: string;
  twitterImage: string;
}

export interface OgInspectionResult {
  requestUrl: string;
  finalUrl: string;
  status: number;
  ok: boolean;
  contentType: string;
  sourceHeader: "static" | "dynamic" | null;
  mode: OgImageMode;
  imageKind: OgImageKind;
  resolvedOgImageUrl: string | null;
  metadata: OgHeadMetadata;
}

export interface SiteOgBuildCommandFilters {
  locales?: string[];
  includePaths?: string[];
  includePrefixes?: string[];
  excludePaths?: string[];
  excludePrefixes?: string[];
}

export interface SiteOgBuildCommandSet {
  buildCommand: string;
  validateCommand: string;
  releaseSafeCommand: string;
  fullScopeCommand: string;
  hasFilters: boolean;
}

const TITLE_REGEX = /<title[^>]*>([\s\S]*?)<\/title>/i;
const META_TAG_REGEX = /<meta\b[^>]*>/gi;
const LINK_TAG_REGEX = /<link\b[^>]*>/gi;
const ATTRIBUTE_REGEX = /([:@a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

const decodeHtmlEntities = (value: string): string =>
  value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");

const normalizeAttr = (value: string): string => value.trim().toLowerCase();

const parseTagAttributes = (tag: string): Record<string, string> => {
  const output: Record<string, string> = {};
  let match: RegExpExecArray | null;

  while ((match = ATTRIBUTE_REGEX.exec(tag)) !== null) {
    const name = normalizeAttr(match[1] || "");
    const value = decodeHtmlEntities((match[2] || match[3] || match[4] || "").trim());
    if (!name || !value) continue;
    output[name] = value;
  }

  ATTRIBUTE_REGEX.lastIndex = 0;
  return output;
};

const readTitle = (html: string): string => {
  const match = html.match(TITLE_REGEX);
  if (!match?.[1]) return "";
  return decodeHtmlEntities(match[1].replace(/\s+/g, " ").trim());
};

const readMetaValue = (html: string, matcher: (attrs: Record<string, string>) => boolean): string => {
  const tags = html.match(META_TAG_REGEX) || [];
  for (const tag of tags) {
    const attrs = parseTagAttributes(tag);
    if (!matcher(attrs)) continue;
    return attrs.content || "";
  }
  return "";
};

const readCanonical = (html: string): string => {
  const tags = html.match(LINK_TAG_REGEX) || [];
  for (const tag of tags) {
    const attrs = parseTagAttributes(tag);
    if ((attrs.rel || "").toLowerCase() !== "canonical") continue;
    return attrs.href || "";
  }
  return "";
};

export const parseOgHeadMetadata = (html: string): OgHeadMetadata => ({
  title: readTitle(html),
  description: readMetaValue(html, (attrs) => (attrs.name || "") === "description"),
  canonical: readCanonical(html),
  ogTitle: readMetaValue(html, (attrs) => (attrs.property || "") === "og:title"),
  ogDescription: readMetaValue(html, (attrs) => (attrs.property || "") === "og:description"),
  ogImage: readMetaValue(html, (attrs) => (attrs.property || "") === "og:image"),
  ogType: readMetaValue(html, (attrs) => (attrs.property || "") === "og:type"),
  twitterCard: readMetaValue(html, (attrs) => (attrs.name || "") === "twitter:card"),
  twitterImage: readMetaValue(html, (attrs) => (attrs.name || "") === "twitter:image"),
});

export const classifyOgImageKind = (ogImage: string, origin: string): OgImageKind => {
  if (!ogImage.trim()) return "missing";

  try {
    const imageUrl = new URL(ogImage, origin);
    if (imageUrl.pathname.startsWith("/images/og/site/generated/") && imageUrl.pathname.endsWith(".png")) {
      return "static-generated";
    }
    if (imageUrl.pathname === "/api/og/site") return "dynamic-site";
    if (imageUrl.pathname === "/api/og/trip") return "dynamic-trip";
  } catch {
    return "unknown";
  }

  return "unknown";
};

export const resolveOgImageUrl = (ogImage: string, origin: string): string | null => {
  if (!ogImage.trim()) return null;
  try {
    return new URL(ogImage, origin).toString();
  } catch {
    return null;
  }
};

const resolveOgMode = (
  sourceHeader: "static" | "dynamic" | null,
  imageKind: OgImageKind,
): OgImageMode => {
  if (sourceHeader) return sourceHeader;
  if (imageKind === "static-generated") return "static";
  if (imageKind === "dynamic-site" || imageKind === "dynamic-trip") return "dynamic";
  return "unknown";
};

export const normalizeOgInspectionUrl = (rawInput: string, origin: string): URL => {
  const candidate = rawInput.trim();
  if (!candidate) throw new Error("Please provide a URL or path.");

  let normalized: URL;
  try {
    if (candidate.startsWith("/")) {
      normalized = new URL(candidate, origin);
    } else {
      normalized = new URL(candidate, origin);
    }
  } catch {
    throw new Error("Could not parse URL.");
  }

  if (!/^https?:$/i.test(normalized.protocol)) {
    throw new Error("Only http/https URLs are supported.");
  }

  const expectedOrigin = new URL(origin).origin;
  if (normalized.origin !== expectedOrigin) {
    throw new Error(`Only same-origin URLs are supported (${expectedOrigin}).`);
  }

  normalized.hash = "";
  return normalized;
};

export const inspectOgUrl = async (
  rawInput: string,
  options: { origin: string; fetchImpl?: typeof fetch },
): Promise<OgInspectionResult> => {
  const targetUrl = normalizeOgInspectionUrl(rawInput, options.origin);
  const fetchImpl = options.fetchImpl || fetch;

  const response = await fetchImpl(targetUrl.toString(), {
    method: "GET",
    redirect: "follow",
    headers: {
      accept: "text/html,application/xhtml+xml",
    },
  });

  const html = await response.text();
  const metadata = parseOgHeadMetadata(html);
  const sourceHeaderRaw = response.headers.get("x-travelflow-og-source");
  const sourceHeader = sourceHeaderRaw === "static" || sourceHeaderRaw === "dynamic"
    ? sourceHeaderRaw
    : null;
  const imageKind = classifyOgImageKind(metadata.ogImage, targetUrl.origin);
  const resolvedOgImageUrl = resolveOgImageUrl(metadata.ogImage, targetUrl.origin);

  return {
    requestUrl: targetUrl.toString(),
    finalUrl: response.url || targetUrl.toString(),
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get("content-type") || "",
    sourceHeader,
    imageKind,
    resolvedOgImageUrl,
    mode: resolveOgMode(sourceHeader, imageKind),
    metadata,
  };
};

export const parseCsvListInput = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean),
    ),
  );

const appendListFlag = (tokens: string[], flag: string, values: string[] | undefined): void => {
  if (!values?.length) return;
  tokens.push(`${flag}=${values.join(",")}`);
};

export const buildSiteOgBuildCommands = (filters: SiteOgBuildCommandFilters): SiteOgBuildCommandSet => {
  const locales = parseCsvListInput((filters.locales || []).join(",")).map((value) => value.toLowerCase());
  const includePaths = parseCsvListInput((filters.includePaths || []).join(","));
  const includePrefixes = parseCsvListInput((filters.includePrefixes || []).join(","));
  const excludePaths = parseCsvListInput((filters.excludePaths || []).join(","));
  const excludePrefixes = parseCsvListInput((filters.excludePrefixes || []).join(","));

  const flagTokens: string[] = [];
  appendListFlag(flagTokens, "--locales", locales);
  appendListFlag(flagTokens, "--include-paths", includePaths);
  appendListFlag(flagTokens, "--include-prefixes", includePrefixes);
  appendListFlag(flagTokens, "--exclude-paths", excludePaths);
  appendListFlag(flagTokens, "--exclude-prefixes", excludePrefixes);

  const hasFilters = flagTokens.length > 0;
  return {
    buildCommand: hasFilters
      ? `pnpm og:site:build -- ${flagTokens.join(" ")}`
      : "pnpm og:site:build",
    validateCommand: "pnpm og:site:validate",
    releaseSafeCommand: "pnpm og:site:build && pnpm og:site:validate",
    fullScopeCommand: "pnpm og:site:build:full && pnpm og:site:validate:full",
    hasFilters,
  };
};
