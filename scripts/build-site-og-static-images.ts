import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import os from "node:os";
import { spawnSync } from "node:child_process";
import type { SiteOgStaticManifest } from "../netlify/edge-lib/site-og-static-manifest.ts";
import { isSiteOgStaticManifest } from "../netlify/edge-lib/site-og-static-manifest.ts";
import type { SiteOgMetadata } from "../netlify/edge-lib/site-og-metadata.ts";
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
  resolveSiteOgStaticPathFilterOptions,
  type SiteOgStaticPathFilterOptions,
} from "./site-og-static-shared.ts";
import { resolveSiteOgStaticBuildMode } from "./site-og-build-mode.ts";

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, SITE_OG_STATIC_DIR_RELATIVE);
const MANIFEST_PATH = path.join(OUTPUT_DIR, SITE_OG_STATIC_MANIFEST_FILE_NAME);
const DENO_RENDER_SCRIPT_PATH = path.join(ROOT_DIR, "scripts", "render-site-og-static-batch.deno.ts");

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

interface SiteOgStaticRenderTask {
  routeKey: string;
  outputPath: string;
  query: Record<string, string>;
}

interface DenoRenderBatchPayload {
  tasks: SiteOgStaticRenderTask[];
  concurrency: number;
  logEvery: number;
}

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

const buildQueryFromMetadata = (metadata: SiteOgMetadata): Record<string, string> => {
  const query: Record<string, string> = {};

  const entries = Object.entries(metadata.ogImageParams as Record<string, string | undefined>);
  for (const [key, rawValue] of entries) {
    const value = (rawValue || "").trim();
    if (!value) continue;
    query[key] = value;
  }

  return query;
};

const renderMissingImagesWithDeno = (tasks: SiteOgStaticRenderTask[]): void => {
  if (tasks.length === 0) return;
  if (!existsSync(DENO_RENDER_SCRIPT_PATH)) {
    throw new Error("Deno batch renderer script missing: scripts/render-site-og-static-batch.deno.ts");
  }

  const tempDirectory = mkdtempSync(path.join(os.tmpdir(), "site-og-static-deno-"));
  const payloadPath = path.join(tempDirectory, "tasks.json");

  const payload: DenoRenderBatchPayload = {
    tasks,
    concurrency: 6,
    logEvery: 100,
  };

  writeFileSync(payloadPath, JSON.stringify(payload), "utf8");

  const runResult = spawnSync(
    "deno",
    [
      "run",
      "--allow-net",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      DENO_RENDER_SCRIPT_PATH,
      payloadPath,
    ],
    {
      stdio: "inherit",
    },
  );

  rmSync(tempDirectory, { recursive: true, force: true });

  if (runResult.error) {
    throw new Error(`Failed to execute deno renderer: ${runResult.error.message}`);
  }
  if (runResult.status !== 0) {
    throw new Error(`Deno renderer exited with code ${runResult.status ?? "unknown"}`);
  }
};

const main = async (): Promise<void> => {
  const buildMode = resolveSiteOgStaticBuildMode();
  if (buildMode === "skip") {
    process.stdout.write("[site-og-static] skipped (mode=skip). Set SITE_OG_STATIC_BUILD_MODE=full to force generation.\n");
    return;
  }

  const cliOptions = parseSiteOgStaticBuildCliArgs(process.argv.slice(2));
  const resolvedFilters = resolveSiteOgStaticPathFilterOptions(cliOptions);
  const isFilteredBuild = resolvedFilters.hasFilters;

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const targets = collectSiteOgStaticTargets(SITE_OG_BUILD_ORIGIN, cliOptions);
  if (targets.length === 0) {
    throw new Error("No static OG targets matched the selected filters.");
  }

  process.stdout.write(
    `[site-og-static] start targets=${targets.length} mode=${isFilteredBuild ? "filtered" : "full"}\n`,
  );

  const existingManifest = readExistingManifest();
  const selectedManifestEntries: SiteOgStaticManifest["entries"] = {};
  const expectedFiles = new Set<string>([SITE_OG_STATIC_MANIFEST_FILE_NAME]);
  const missingRenderTasks: SiteOgStaticRenderTask[] = [];

  let written = 0;
  let reused = 0;
  let removed = 0;
  let processed = 0;

  for (const target of targets) {
    const payload = buildSiteOgStaticRenderPayload(target.metadata);
    const hash = computeSiteOgStaticPayloadHash(payload);
    const fileName = buildSiteOgStaticFileName(target.routeKey, hash);
    const outputPath = path.join(OUTPUT_DIR, fileName);

    expectedFiles.add(fileName);

    if (existsSync(outputPath)) {
      reused += 1;
    } else {
      missingRenderTasks.push({
        routeKey: target.routeKey,
        outputPath,
        query: buildQueryFromMetadata(target.metadata),
      });
    }

    selectedManifestEntries[target.routeKey] = {
      path: `${SITE_OG_STATIC_PUBLIC_PREFIX}/${fileName}`,
      hash,
    };

    expectedFiles.add(fileName);
    processed += 1;

    if (processed % 250 === 0 || processed === targets.length) {
      process.stdout.write(
        `[site-og-static] progress processed=${processed}/${targets.length} wrote=${written} reused=${reused}\n`,
      );
    }
  }

  if (missingRenderTasks.length > 0) {
    process.stdout.write(`[site-og-static] rendering ${missingRenderTasks.length} missing image(s) with deno batch renderer\n`);
    renderMissingImagesWithDeno(missingRenderTasks);
    written += missingRenderTasks.length;
    process.stdout.write(
      `[site-og-static] progress processed=${processed}/${targets.length} wrote=${written} reused=${reused}\n`,
    );
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
