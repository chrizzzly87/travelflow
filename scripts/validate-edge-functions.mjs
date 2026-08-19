#!/usr/bin/env node

/**
 * Build-time validator for Netlify Edge Functions.
 *
 * Checks:
 * 1. No edge function uses inline `export const config` (routes must be in netlify.toml only).
 * 2. Every [[edge_functions]] entry in netlify.toml points to an existing file.
 * 3. Every function file in the edge-functions directory has at least one toml route.
 * 4. Every relative import reachable from an edge function carries an explicit file
 *    extension and resolves on disk. Deno's edge bundler does not resolve
 *    extensionless specifiers, so a missing ".ts" fails the Netlify build even
 *    though Vite and tsc accept it.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, basename, dirname } from "node:path";
import {
  findCatchAllEdgeEntries,
  parseEdgeFunctionEntries,
  findSiteOgMetaScopeViolations,
} from "./edge-validation-utils.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const EF_DIR = resolve(ROOT, "netlify/edge-functions");
const TOML_PATH = resolve(ROOT, "netlify.toml");

let errors = 0;
let warnings = 0;

// ── 1. Scan edge function files for inline config ───────────────────────────

const efFiles = readdirSync(EF_DIR).filter(
  (f) => f.endsWith(".ts") || f.endsWith(".tsx")
);

for (const file of efFiles) {
  const content = readFileSync(resolve(EF_DIR, file), "utf-8");
  if (/export\s+const\s+config\s*=/.test(content)) {
    // Allow config that only sets onError (no path routing)
    const hasPath = /path\s*:/.test(content);
    if (hasPath) {
      console.error(
        `ERROR: ${file} contains inline route config (path). ` +
          `Routes must be declared in netlify.toml only. ` +
          `See docs/EDGE_FUNCTIONS.md for details.`
      );
      errors++;
    }
  }
}

// ── 2. Parse toml for [[edge_functions]] entries ────────────────────────────

const toml = readFileSync(TOML_PATH, "utf-8");
const tomlFunctionNames = new Set();
const edgeEntries = parseEdgeFunctionEntries(toml);
for (const entry of edgeEntries) {
  tomlFunctionNames.add(entry.functionName);
}

const catchAllEntries = findCatchAllEdgeEntries(edgeEntries);
for (const entry of catchAllEntries) {
  console.error(
    `ERROR: netlify.toml defines catch-all edge route "${entry.path}" -> "${entry.functionName}". ` +
      `Catch-all edge bindings are forbidden because upstream edge/runtime timeouts can take down the full site. ` +
      `Use explicit route allowlists for edge middleware.`
  );
  errors++;
}

const siteOgMetaScopeViolations = findSiteOgMetaScopeViolations(edgeEntries);
for (const violation of siteOgMetaScopeViolations) {
  console.error(`ERROR: ${violation.reason}`);
  errors++;
}

// Check toml entries point to real files
for (const name of tomlFunctionNames) {
  const exists = efFiles.some(
    (f) => basename(f, ".ts") === name || basename(f, ".tsx") === name
  );
  if (!exists) {
    console.warn(
      `WARN: netlify.toml references function "${name}" but no matching file exists in netlify/edge-functions/`
    );
    warnings++;
  }
}

// ── 3. Check for orphaned function files (no toml route) ───────────────────

for (const file of efFiles) {
  const nameTs = basename(file, ".ts");
  const nameTsx = basename(file, ".tsx");
  const name = file.endsWith(".tsx") ? nameTsx : nameTs;
  if (!tomlFunctionNames.has(name)) {
    console.warn(
      `WARN: ${file} has no route in netlify.toml (orphaned edge function)`
    );
    warnings++;
  }
}

// ── 4. Transitive relative imports must carry explicit extensions ───────────
//
// Regression guard for the 2026-08-18 outage: an edge function began importing
// config/aiModelCatalog.ts, which imported "../shared/aiReasoning" with no
// extension. Vite and tsc resolve that; Deno's edge bundler does not, so every
// Netlify build failed with "cannot resolve file:///opt/build/repo/shared/aiReasoning"
// and NO edge functions were deployed at all.

// Only *value* imports matter. `import type` / `export type` statements are erased
// before bundling, which is why the many extensionless `import type { X } from "../types"`
// specifiers in this repo never broke a build.
const VALUE_IMPORT_REGEX =
  /(?:^|\n)\s*(?:import|export)\s+(?!type\s)(?:[^;'"]*?\s+from\s*)?["'](\.{1,2}\/[^"']+)["']/g;
const DYNAMIC_IMPORT_REGEX = /\bimport\s*\(\s*["'](\.{1,2}\/[^"']+)["']/g;
const ALLOWED_EXTENSIONS = [".ts", ".tsx", ".js", ".mjs", ".jsx", ".json"];

const visited = new Set();

const walkEdgeImports = (filePath, originLabel) => {
  if (visited.has(filePath)) return;
  visited.add(filePath);

  let content;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return;
  }

  const specifiers = [
    ...content.matchAll(VALUE_IMPORT_REGEX),
    ...content.matchAll(DYNAMIC_IMPORT_REGEX),
  ];

  for (const match of specifiers) {
    const specifier = match[1];
    const importerRelative = filePath.slice(ROOT.length + 1);

    if (!ALLOWED_EXTENSIONS.some((ext) => specifier.endsWith(ext))) {
      console.error(
        `ERROR: ${importerRelative} imports "${specifier}" without a file extension. ` +
          `Reachable from edge function ${originLabel}. Deno's edge bundler cannot ` +
          `resolve extensionless specifiers - add the explicit extension (e.g. ".ts"). ` +
          `See docs/EDGE_FUNCTIONS.md.`
      );
      errors++;
      continue;
    }

    const resolved = resolve(dirname(filePath), specifier);
    if (!existsSync(resolved)) {
      console.error(
        `ERROR: ${importerRelative} imports "${specifier}", which does not exist on disk. ` +
          `Reachable from edge function ${originLabel}.`
      );
      errors++;
      continue;
    }

    if (/\.(ts|tsx|js|mjs|jsx)$/.test(resolved)) walkEdgeImports(resolved, originLabel);
  }
};

for (const file of efFiles) {
  walkEdgeImports(resolve(EF_DIR, file), file);
}

// ── Result ──────────────────────────────────────────────────────────────────

if (warnings > 0) {
  console.log(`\nEdge function validation: ${warnings} warning(s)`);
}

if (errors > 0) {
  console.error(`\nEdge function validation failed with ${errors} error(s)`);
  process.exit(1);
} else {
  console.log("Edge function validation passed.");
}
