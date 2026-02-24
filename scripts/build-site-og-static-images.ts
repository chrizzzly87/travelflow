import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { SiteOgStaticManifest } from "../netlify/edge-lib/site-og-static-manifest.ts";
import {
  SITE_OG_STATIC_DIR_RELATIVE,
  SITE_OG_STATIC_MANIFEST_FILE_NAME,
  SITE_OG_STATIC_PUBLIC_PREFIX,
  buildSiteOgManifestRevision,
  buildSiteOgStaticFileName,
  buildSiteOgStaticRenderPayload,
  collectSiteOgStaticTargets,
  computeSiteOgStaticPayloadHash,
  renderSiteOgStaticSvg,
} from "./site-og-static-shared.ts";

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, SITE_OG_STATIC_DIR_RELATIVE);
const MANIFEST_PATH = path.join(OUTPUT_DIR, SITE_OG_STATIC_MANIFEST_FILE_NAME);

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

const main = async (): Promise<void> => {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const targets = collectSiteOgStaticTargets();
  const manifestEntries: SiteOgStaticManifest["entries"] = {};
  const expectedFiles = new Set<string>([SITE_OG_STATIC_MANIFEST_FILE_NAME]);

  let written = 0;
  let reused = 0;

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

    manifestEntries[target.routeKey] = {
      path: `${SITE_OG_STATIC_PUBLIC_PREFIX}/${fileName}`,
      hash,
    };
  }

  for (const fileName of readdirSync(OUTPUT_DIR)) {
    if (!fileName.endsWith(".png")) continue;
    if (expectedFiles.has(fileName)) continue;
    rmSync(path.join(OUTPUT_DIR, fileName), { force: true });
  }

  const sortedEntries = sortRecord(manifestEntries);
  const manifest: SiteOgStaticManifest = {
    generatedAt: new Date().toISOString(),
    revision: buildSiteOgManifestRevision(sortedEntries),
    entries: sortedEntries,
  };

  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  process.stdout.write(
    `[site-og-static] targets=${targets.length} wrote=${written} reused=${reused} manifest=${SITE_OG_STATIC_DIR_RELATIVE}/${SITE_OG_STATIC_MANIFEST_FILE_NAME}\n`,
  );
};

void main().catch((error) => {
  process.stderr.write(`[site-og-static] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
