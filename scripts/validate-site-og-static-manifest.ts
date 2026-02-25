import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { isSiteOgStaticManifest, type SiteOgStaticManifest } from "../netlify/edge-lib/site-og-static-manifest.ts";
import {
  SITE_OG_STATIC_DIR_RELATIVE,
  SITE_OG_STATIC_MANIFEST_FILE_NAME,
  SITE_OG_STATIC_PUBLIC_PREFIX,
  buildSiteOgStaticFileName,
  buildSiteOgStaticRenderPayload,
  collectSiteOgStaticTargets,
  computeSiteOgStaticPayloadHash,
} from "./site-og-static-shared.ts";
import { shouldSkipSiteOgStaticBuild } from "./site-og-build-mode.ts";

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, SITE_OG_STATIC_DIR_RELATIVE);
const MANIFEST_PATH = path.join(OUTPUT_DIR, SITE_OG_STATIC_MANIFEST_FILE_NAME);

const fail = (message: string): never => {
  process.stderr.write(`[site-og-static:validate] ${message}\n`);
  process.exit(1);
};

const main = (): void => {
  if (shouldSkipSiteOgStaticBuild()) {
    process.stdout.write("[site-og-static:validate] skipped (mode=skip).\n");
    return;
  }

  if (!existsSync(MANIFEST_PATH)) {
    fail(`Missing manifest: ${SITE_OG_STATIC_DIR_RELATIVE}/${SITE_OG_STATIC_MANIFEST_FILE_NAME}. Run pnpm og:site:build first.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch (error) {
    fail(`Manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!isSiteOgStaticManifest(parsed)) {
    fail("Manifest shape is invalid.");
  }

  const manifest = parsed as SiteOgStaticManifest;
  const targets = collectSiteOgStaticTargets();
  const expectedRouteKeys = new Set(targets.map((target) => target.routeKey));
  const manifestRouteKeys = new Set(Object.keys(manifest.entries));

  const missingRouteKeys = Array.from(expectedRouteKeys).filter((routeKey) => !manifestRouteKeys.has(routeKey));
  if (missingRouteKeys.length > 0) {
    fail(`Manifest is missing route keys: ${missingRouteKeys.slice(0, 8).join(", ")}${missingRouteKeys.length > 8 ? "..." : ""}`);
  }

  const unexpectedRouteKeys = Array.from(manifestRouteKeys).filter((routeKey) => !expectedRouteKeys.has(routeKey));
  if (unexpectedRouteKeys.length > 0) {
    fail(`Manifest contains unexpected route keys: ${unexpectedRouteKeys.slice(0, 8).join(", ")}${unexpectedRouteKeys.length > 8 ? "..." : ""}`);
  }

  for (const target of targets) {
    const entry = manifest.entries[target.routeKey];
    if (!entry) {
      fail(`Manifest entry missing for route key ${target.routeKey}`);
    }

    if (!entry.path.startsWith(`${SITE_OG_STATIC_PUBLIC_PREFIX}/`)) {
      fail(`Manifest entry for ${target.routeKey} has invalid path prefix: ${entry.path}`);
    }

    const payload = buildSiteOgStaticRenderPayload(target.metadata);
    const expectedHash = computeSiteOgStaticPayloadHash(payload);
    const expectedFileName = buildSiteOgStaticFileName(target.routeKey, expectedHash);
    const expectedPath = `${SITE_OG_STATIC_PUBLIC_PREFIX}/${expectedFileName}`;

    if (entry.hash !== expectedHash) {
      fail(`Manifest hash mismatch for ${target.routeKey}: expected ${expectedHash}, got ${entry.hash}`);
    }

    if (entry.path !== expectedPath) {
      fail(`Manifest path mismatch for ${target.routeKey}: expected ${expectedPath}, got ${entry.path}`);
    }

    const absoluteAssetPath = path.join(ROOT_DIR, "public", entry.path.replace(/^\//, ""));
    if (!existsSync(absoluteAssetPath)) {
      fail(`Manifest asset is missing on disk for ${target.routeKey}: ${entry.path}`);
    }
  }

  process.stdout.write(`[site-og-static:validate] validated ${targets.length} route entries\n`);
};

main();
