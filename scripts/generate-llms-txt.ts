/**
 * Writes public/llms.txt and public/llms-full.txt from shared/llmsTxt.ts.
 * Run after changing the trip-draft contract: `pnpm llms:generate`.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildLlmsFullTxt, buildLlmsTxt } from '../shared/llmsTxt.ts';

const root = resolve(import.meta.dirname, '..');
writeFileSync(resolve(root, 'public/llms.txt'), buildLlmsTxt());
writeFileSync(resolve(root, 'public/llms-full.txt'), buildLlmsFullTxt());
console.log('[llms:generate] wrote public/llms.txt and public/llms-full.txt');
