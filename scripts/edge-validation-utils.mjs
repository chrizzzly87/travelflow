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

const SITE_OG_META_ALLOWED_PATHS = new Set([
  "/blog",
  "/blog/*",
  "/es/blog",
  "/es/blog/*",
  "/de/blog",
  "/de/blog/*",
  "/fr/blog",
  "/fr/blog/*",
  "/pt/blog",
  "/pt/blog/*",
  "/ru/blog",
  "/ru/blog/*",
  "/it/blog",
  "/it/blog/*",
  "/pl/blog",
  "/pl/blog/*",
  "/ko/blog",
  "/ko/blog/*",
]);

export const findSiteOgMetaScopeViolations = (entries) =>
  entries
    .filter((entry) => entry.functionName === "site-og-meta")
    .filter((entry) => !SITE_OG_META_ALLOWED_PATHS.has(entry.path.trim()))
    .map((entry) => ({
      ...entry,
      reason: `site-og-meta must only be mapped to blog routes. Found disallowed path "${entry.path}".`,
    }));
