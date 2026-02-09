#!/usr/bin/env node

/**
 * Build-time validator for Netlify Edge Functions.
 *
 * Checks:
 * 1. No edge function uses inline `export const config` (routes must be in netlify.toml only).
 * 2. Every [[edge_functions]] entry in netlify.toml points to an existing file.
 * 3. Every function file in the edge-functions directory has at least one toml route.
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";

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
    console.error(
      `ERROR: ${file} contains inline \`export const config\`. ` +
        `Routes must be declared in netlify.toml only. ` +
        `See docs/EDGE_FUNCTIONS.md for details.`
    );
    errors++;
  }
}

// ── 2. Parse toml for [[edge_functions]] entries ────────────────────────────

const toml = readFileSync(TOML_PATH, "utf-8");
const tomlFunctionNames = new Set();
const entryRegex = /\[\[edge_functions\]\][^[]*?function\s*=\s*"([^"]+)"/g;
let match;
while ((match = entryRegex.exec(toml)) !== null) {
  tomlFunctionNames.add(match[1]);
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
