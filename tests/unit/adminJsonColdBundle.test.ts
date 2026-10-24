import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';

describe('admin JSON cold production bundle', () => {
    it('evaluates the actual diff component without a pre-existing Prism global', async () => {
        // Component-test transforms execute CJS imports eagerly and concealed the
        // deployed failure. Use the production bundler and a fresh JS realm.
        const result = await build({
            configFile: false,
            logLevel: 'silent',
            define: { 'process.env.NODE_ENV': JSON.stringify('production') },
            resolve: { alias: { '@': resolve('.') } },
            build: {
                write: false,
                minify: false,
                lib: {
                    entry: resolve('components/admin/AdminJsonDiffModal.tsx'),
                    name: 'AdminDiff',
                    formats: ['iife'],
                },
            },
        });
        const outputs = Array.isArray(result) ? result : [result];
        const chunk = outputs.flatMap(output => output.output).find(output => output.type === 'chunk');
        expect(chunk?.type).toBe('chunk');
        const context = { console, setTimeout, clearTimeout, TextEncoder, TextDecoder, URL };
        runInNewContext(chunk!.code, context);
    });
});
