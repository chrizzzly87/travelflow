import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import type { SiteOgStaticManifest } from "../netlify/edge-lib/site-og-static-manifest.ts";
import { isSiteOgStaticManifest } from "../netlify/edge-lib/site-og-static-manifest.ts";
import {
  SITE_OG_BUILD_ORIGIN,
  SITE_OG_STATIC_DIR_RELATIVE,
  SITE_OG_STATIC_MANIFEST_FILE_NAME,
  SITE_OG_STATIC_PUBLIC_PREFIX,
  buildSiteOgManifestRevision,
  buildSiteOgStaticFileName,
  buildSiteOgStaticRenderPayload,
  collectSiteOgStaticTargets,
  computeSiteOgStaticPayloadHash,
  renderSiteOgStaticSvg,
  resolveSiteOgStaticPathFilterOptions,
  type SiteOgStaticPathFilterOptions,
} from "./site-og-static-shared.ts";

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, SITE_OG_STATIC_DIR_RELATIVE);
const MANIFEST_PATH = path.join(OUTPUT_DIR, SITE_OG_STATIC_MANIFEST_FILE_NAME);

const CLI_FLAG_NAMES = new Set([
  "--locales",
  "--include-paths",
  "--include-prefixes",
  "--exclude-paths",
  "--exclude-prefixes",
]);

export interface SiteOgStaticBuildCliOptions extends SiteOgStaticPathFilterOptions {
  hasFilters: boolean;
}

const sortRecord = <T>(entries: Record<string, T>): Record<string, T> =>
  Object.fromEntries(
    Object.entries(entries).sort(([left], [right]) => left.localeCompare(right)),
  );

const writePngFromSvg = async (svg: string, outputPath: string): Promise<void> => {
  await sharp(Buffer.from(svg)).png({
    compressionLevel: 9,
    effort: 10,
    palette: true,
    quality: 78,
  }).toFile(outputPath);
};

const parseFlagValues = (argv: string[], flagName: string): string[] =>
  argv
    .filter((arg) => arg.startsWith(`${flagName}=`))
    .flatMap((arg) => (arg.split("=")[1] || "").split(","))
    .map((token) => token.trim())
    .filter(Boolean);

export const parseSiteOgStaticBuildCliArgs = (argv: string[]): SiteOgStaticBuildCliOptions => {
  const normalizedArgs = argv.filter((arg) => arg !== "--");

  for (const arg of normalizedArgs) {
    if (!arg.startsWith("--")) continue;
    const [flagName] = arg.split("=");
    if (CLI_FLAG_NAMES.has(flagName)) continue;
    throw new Error(
      `Unknown flag "${arg}". Supported flags: --locales=, --include-paths=, --include-prefixes=, --exclude-paths=, --exclude-prefixes=`,
    );
  }

  for (const flagName of CLI_FLAG_NAMES) {
    if (normalizedArgs.includes(flagName)) {
      throw new Error(`Flag "${flagName}" requires a value (example: ${flagName}=value1,value2).`);
    }
  }

  const options: SiteOgStaticBuildCliOptions = {
    locales: parseFlagValues(normalizedArgs, "--locales"),
    includePaths: parseFlagValues(normalizedArgs, "--include-paths"),
    includePrefixes: parseFlagValues(normalizedArgs, "--include-prefixes"),
    excludePaths: parseFlagValues(normalizedArgs, "--exclude-paths"),
    excludePrefixes: parseFlagValues(normalizedArgs, "--exclude-prefixes"),
    hasFilters: false,
  };

  options.hasFilters = resolveSiteOgStaticPathFilterOptions(options).hasFilters;
  return options;
};

const readExistingManifest = (): SiteOgStaticManifest | null => {
  if (!existsSync(MANIFEST_PATH)) return null;

  try {
    const parsed = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
    if (!isSiteOgStaticManifest(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const entryPathToFileName = (entryPath: string): string | null => {
  if (!entryPath.startsWith(`${SITE_OG_STATIC_PUBLIC_PREFIX}/`)) return null;
  return entryPath.slice(`${SITE_OG_STATIC_PUBLIC_PREFIX}/`.length);
};

const main = async (): Promise<void> => {
  const cliOptions = parseSiteOgStaticBuildCliArgs(process.argv.slice(2));
  const resolvedFilters = resolveSiteOgStaticPathFilterOptions(cliOptions);
  const isFilteredBuild = resolvedFilters.hasFilters;

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const targets = collectSiteOgStaticTargets(SITE_OG_BUILD_ORIGIN, cliOptions);
  if (targets.length === 0) {
    throw new Error("No static OG targets matched the selected filters.");
  }

  const existingManifest = readExistingManifest();
  const selectedManifestEntries: SiteOgStaticManifest["entries"] = {};
  const expectedFiles = new Set<string>([SITE_OG_STATIC_MANIFEST_FILE_NAME]);

  let written = 0;
  let reused = 0;
  let removed = 0;

  for (const target of targets) {
    const payload = buildSiteOgStaticRenderPayload(target.metadata);
    const hash = computeSiteOgStaticPayloadHash(payload);
    const fileName = buildSiteOgStaticFileName(target.routeKey, hash);
    const outputPath = path.join(OUTPUT_DIR, fileName);

    expectedFiles.add(fileName);

    if (existsSync(outputPath)) {
      reused += 1;
    } else {
      const svg = renderSiteOgStaticSvg(payload);
      await writePngFromSvg(svg, outputPath);
      written += 1;
    }

    selectedManifestEntries[target.routeKey] = {
      path: `${SITE_OG_STATIC_PUBLIC_PREFIX}/${fileName}`,
      hash,
    };

    expectedFiles.add(fileName);
  }

  const mergedEntries = isFilteredBuild
    ? sortRecord({
      ...(existingManifest?.entries || {}),
      ...selectedManifestEntries,
    })
    : sortRecord(selectedManifestEntries);

  if (isFilteredBuild && existingManifest) {
    for (const target of targets) {
      const previousPath = existingManifest.entries[target.routeKey]?.path;
      const nextPath = mergedEntries[target.routeKey]?.path;
      if (!previousPath || previousPath === nextPath) continue;

      const previousFileName = entryPathToFileName(previousPath);
      if (!previousFileName) continue;
      rmSync(path.join(OUTPUT_DIR, previousFileName), { force: true });
      removed += 1;
    }
  } else {
    for (const fileName of readdirSync(OUTPUT_DIR)) {
      if (!fileName.endsWith(".png")) continue;
      if (expectedFiles.has(fileName)) continue;
      rmSync(path.join(OUTPUT_DIR, fileName), { force: true });
      removed += 1;
    }
  }

  const manifest: SiteOgStaticManifest = {
    generatedAt: new Date().toISOString(),
    revision: buildSiteOgManifestRevision(mergedEntries),
    entries: mergedEntries,
  };

  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const filterSummary = isFilteredBuild
    ? ` mode=filtered locales=${resolvedFilters.locales.join(",") || "-"} includePaths=${resolvedFilters.includePaths.length} includePrefixes=${resolvedFilters.includePrefixes.length} excludePaths=${resolvedFilters.excludePaths.length} excludePrefixes=${resolvedFilters.excludePrefixes.length}`
    : " mode=full";

  process.stdout.write(
    `[site-og-static] targets=${targets.length} wrote=${written} reused=${reused} removed=${removed}${filterSummary} manifest=${SITE_OG_STATIC_DIR_RELATIVE}/${SITE_OG_STATIC_MANIFEST_FILE_NAME}\n`,
  );
};

const isDirectRun = (() => {
  const entryPath = process.argv[1];
  if (!entryPath) return false;
  return pathToFileURL(entryPath).href === import.meta.url;
})();

if (isDirectRun) {
  void main().catch((error) => {
    process.stderr.write(`[site-og-static] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
