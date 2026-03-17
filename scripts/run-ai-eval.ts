import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { appendTsxImport, buildPromptfooArgs, extractAiEvalPack } from '../shared/aiEvalCli.ts';

const rootDir = resolve(import.meta.dirname, '..');
const artifactsDir = resolve(rootDir, 'artifacts/promptfoo');

const run = async () => {
    const { pack, remainingArgs } = extractAiEvalPack(process.argv.slice(2));
    const promptfooConfigPath = resolve(
        rootDir,
        pack === 'security' ? 'promptfoo/securityPromptfooconfig.ts' : 'promptfoo/promptfooconfig.ts',
    );
    const artifactBasename = pack === 'security' ? 'ai-trip-security-eval' : 'ai-trip-eval';
    const { isCi, promptfooArgs } = buildPromptfooArgs({
        artifactBasename,
        rootDir,
        promptfooConfigPath,
        artifactsDir,
        rawArgs: remainingArgs,
    });

    if (isCi) {
        await mkdir(artifactsDir, { recursive: true });
    }

    const child = spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', promptfooArgs, {
        cwd: rootDir,
        stdio: 'inherit',
        env: {
            ...process.env,
            NODE_OPTIONS: appendTsxImport(process.env.NODE_OPTIONS),
        },
        shell: false,
    });

    child.on('error', (error) => {
        console.error(error);
        process.exitCode = 1;
    });

    child.on('exit', (code, signal) => {
        if (signal) {
            console.error(`Promptfoo eval terminated with signal ${signal}.`);
            process.exitCode = 1;
            return;
        }
        process.exitCode = code ?? 1;
    });
};

void run();
