/**
 * Parse [[edge_functions]] blocks from netlify.toml.
 */
export const parseEdgeFunctionEntries = (toml) => {
  const entries = [];
  const blockRegex = /\[\[edge_functions\]\]([\s\S]*?)(?=\n\[\[|\n\[|$)/g;
  let blockMatch;

  while ((blockMatch = blockRegex.exec(toml)) !== null) {
    const block = blockMatch[1] || "";
    const pathMatch = block.match(/path\s*=\s*"([^"]+)"/);
    const functionMatch = block.match(/function\s*=\s*"([^"]+)"/);
    if (!pathMatch || !functionMatch) continue;
    entries.push({
      path: pathMatch[1],
      functionName: functionMatch[1],
    });
  }

  return entries;
};

export const findCatchAllEdgeEntries = (entries) =>
  entries.filter((entry) => entry.path.trim() === "/*");

const SITE_OG_META_LOCALES = ["es", "de", "fr", "pt", "ru", "it", "pl", "ko"];

const SITE_OG_META_BASE_ALLOWED_PATHS = [
  "/",
  "/features",
  "/inspirations",
  "/inspirations/*",
  "/updates",
  "/blog",
  "/blog/*",
  "/pricing",
  "/faq",
  "/share-unavailable",
  "/login",
  "/contact",
  "/imprint",
  "/privacy",
  "/terms",
  "/cookies",
  "/create-trip",
  "/example/*",
];

const SITE_OG_META_LOCALIZED_ALLOWED_PATHS = [
  "/",
  "/features",
  "/inspirations",
  "/inspirations/*",
  "/updates",
  "/blog",
  "/blog/*",
  "/pricing",
  "/faq",
  "/share-unavailable",
  "/login",
  "/contact",
  "/imprint",
  "/privacy",
  "/terms",
  "/cookies",
  "/create-trip",
];

const localizePath = (path, locale) => {
  if (path === "/") return `/${locale}`;
  return `/${locale}${path}`;
};

const SITE_OG_META_ALLOWED_PATHS = new Set([
  ...SITE_OG_META_BASE_ALLOWED_PATHS,
  ...SITE_OG_META_LOCALES.flatMap((locale) =>
    SITE_OG_META_LOCALIZED_ALLOWED_PATHS.map((path) => localizePath(path, locale))
  ),
]);

export const findSiteOgMetaScopeViolations = (entries) =>
  entries
    .filter((entry) => entry.functionName === "site-og-meta")
    .filter((entry) => !SITE_OG_META_ALLOWED_PATHS.has(entry.path.trim()))
    .map((entry) => ({
      ...entry,
      reason: `site-og-meta must only be mapped to approved static/example route allowlists. Found disallowed path "${entry.path}".`,
    }));
