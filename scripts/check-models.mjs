#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const USER_MODELS_URL = 'https://openrouter.ai/api/v1/models/user';

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return {};
  return Object.fromEntries(
    fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        return [key, value];
      }),
  );
};

export const extractOpenRouterAllowlist = (source) => {
  const block = source.match(/openrouter:\s*new Set\(\[([\s\S]*?)\]\)/)?.[1] || '';
  return [...block.matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
};

export const extractStaticOpenRouterIds = (source) => (
  [...source.matchAll(/id:\s*["']openrouter:([^"']+)["']/g)].map((match) => match[1])
);

const parseExpiration = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const isRollingOrSpecialId = (id) => (
  id === 'openrouter/free'
  || id.includes(':batch')
  || id.endsWith(':free')
  || /(^|[-/])(latest|beta)(?:$|-)/.test(id)
);

export const isCompatibleOpenRouterCandidate = (model, now = new Date()) => {
  const id = typeof model?.id === 'string' ? model.id : '';
  if (!id || isRollingOrSpecialId(id)) return false;
  const input = Array.isArray(model?.architecture?.input_modalities) ? model.architecture.input_modalities : [];
  const output = Array.isArray(model?.architecture?.output_modalities) ? model.architecture.output_modalities : [];
  const parameters = Array.isArray(model?.supported_parameters) ? model.supported_parameters : [];
  const expiration = parseExpiration(model?.expiration_date);
  return input.includes('text')
    && output.length === 1
    && output[0] === 'text'
    && parameters.includes('response_format')
    && parameters.includes('structured_outputs')
    && (expiration === null || expiration > now.getTime());
};

const monthsAgo = (now, months) => {
  const threshold = new Date(now);
  threshold.setUTCMonth(threshold.getUTCMonth() - months);
  return threshold.getTime();
};

const summarizeModel = (model, now) => ({
  id: model.id,
  releasedAt: new Date(Number(model.created) * 1000).toISOString().slice(0, 10),
  ageDays: Math.max(0, Math.floor((now.getTime() - Number(model.created) * 1000) / 86_400_000)),
  contextLength: Number(model.context_length) || null,
  inputPricePerMillion: Number((Number(model.pricing?.prompt || 0) * 1_000_000).toFixed(6)),
  outputPricePerMillion: Number((Number(model.pricing?.completion || 0) * 1_000_000).toFixed(6)),
  supportsReasoningEffort: Array.isArray(model.supported_parameters)
    && model.supported_parameters.includes('reasoning_effort'),
  expirationDate: model.expiration_date || null,
});

export const compareOpenRouterCatalog = ({
  models,
  allowlistedIds,
  staticIds,
  now = new Date(),
  staleMonths = 6,
}) => {
  const byId = new Map(models.map((model) => [model.id, model]));
  const allowlisted = new Set(allowlistedIds);
  const compatible = models.filter((model) => isCompatibleOpenRouterCandidate(model, now));
  const staleCutoff = monthsAgo(now, staleMonths);

  return {
    checkedAt: now.toISOString(),
    counts: {
      authenticatedCatalog: models.length,
      compatibleStable: compatible.length,
      runtimeAllowlisted: allowlistedIds.length,
      staticFallback: staticIds.length,
    },
    newCompatible: compatible
      .filter((model) => !allowlisted.has(model.id))
      .sort((left, right) => Number(right.created) - Number(left.created))
      .map((model) => summarizeModel(model, now)),
    unavailableConfigured: allowlistedIds.filter((id) => !byId.has(id)),
    staleConfigured: allowlistedIds
      .map((id) => byId.get(id))
      .filter((model) => model && Number(model.created) * 1000 < staleCutoff)
      .sort((left, right) => Number(left.created) - Number(right.created))
      .map((model) => summarizeModel(model, now)),
    allowlistedWithoutStaticFallback: allowlistedIds.filter((id) => !staticIds.includes(id)),
    staticFallbackWithoutAllowlist: staticIds.filter((id) => !allowlisted.has(id)),
  };
};

const fetchCatalog = async (apiKey) => {
  const response = await fetch(apiKey ? USER_MODELS_URL : PUBLIC_MODELS_URL, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`OpenRouter model catalog request failed (${response.status}).`);
  const payload = await response.json();
  return Array.isArray(payload?.data) ? payload.data : [];
};

const main = async () => {
  const repositoryPath = path.resolve(process.argv[2] || process.cwd());
  const runtimePath = path.join(repositoryPath, 'netlify/edge-lib/ai-provider-runtime.ts');
  const catalogPath = path.join(repositoryPath, 'config/aiModelCatalog.ts');
  if (!fs.existsSync(runtimePath) || !fs.existsSync(catalogPath)) {
    throw new Error(`TravelFlow model sources were not found under ${repositoryPath}.`);
  }

  const fileEnv = parseEnvFile(path.join(repositoryPath, '.env.local'));
  const apiKey = process.env.OPENROUTER_API_KEY || fileEnv.OPENROUTER_API_KEY || '';
  const models = await fetchCatalog(apiKey);
  const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
  const catalogSource = fs.readFileSync(catalogPath, 'utf8');
  const report = compareOpenRouterCatalog({
    models,
    allowlistedIds: extractOpenRouterAllowlist(runtimeSource),
    staticIds: extractStaticOpenRouterIds(catalogSource),
  });
  console.log(JSON.stringify(report, null, 2));
};

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
