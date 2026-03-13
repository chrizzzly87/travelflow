import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const rootDir = resolve(import.meta.dirname, '..');
const promptfooConfigPath = resolve(rootDir, 'promptfoo/promptfooconfig.ts');
const artifactsDir = resolve(rootDir, 'artifacts/promptfoo');

const appendTsxImport = (existingValue: string | undefined): string => {
    const trimmed = (existingValue || '').trim();
    if (trimmed.includes('--import tsx')) {
        return trimmed;
    }
    return trimmed ? `${trimmed} --import tsx` : '--import tsx';
};

const run = async () => {
    const args = process.argv.slice(2);
    const isCi = args.includes('--ci');
    const forwardedArgs = args.filter((arg) => arg !== '--ci');

    const promptfooArgs = [
        'exec',
        'promptfoo',
        'eval',
        '-c',
        promptfooConfigPath,
        '--max-concurrency',
        '2',
        '--no-write',
        ...forwardedArgs,
    ];

    if (isCi) {
        await mkdir(artifactsDir, { recursive: true });
        promptfooArgs.push(
            '--output',
            resolve(artifactsDir, 'ai-trip-eval.json'),
            resolve(artifactsDir, 'ai-trip-eval.html'),
            '--no-progress-bar',
        );
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
