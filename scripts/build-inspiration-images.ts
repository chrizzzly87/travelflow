import { existsSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const JOBS_FILE = 'tmp/imagegen/inspiration-cards.jsonl';
const OUTPUT_DIR = 'public/images/inspirations';

const args = process.argv.slice(2);
const keepJobs = args.includes('--keep-jobs');
const dryRun = args.includes('--dry-run');

const getArgValue = (name: string): string | undefined => {
    const pair = args.find((arg) => arg.startsWith(`${name}=`));
    if (pair) return pair.slice(name.length + 1).trim();

    const idx = args.indexOf(name);
    if (idx >= 0 && idx < args.length - 1) {
        return args[idx + 1]?.trim();
    }

    return undefined;
};

const concurrency = getArgValue('--concurrency') || '2';
const force = !args.includes('--no-force');

const loadEnvFile = (path: string) => {
    if (!existsSync(path)) return;

    const raw = readFileSync(path, 'utf8');
    for (const lineRaw of raw.split(/\r?\n/)) {
        const line = lineRaw.trim();
        if (!line || line.startsWith('#') || !line.includes('=')) continue;

        const [keyRaw, ...valueParts] = line.split('=');
        const key = keyRaw.trim();
        if (!key || process.env[key]) continue;

        let value = valueParts.join('=').trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }

        process.env[key] = value;
    }
};

const run = (cmd: string, cmdArgs: string[], label: string) => {
    const result = spawnSync(cmd, cmdArgs, { stdio: 'inherit', env: process.env });
    if (result.status !== 0) {
        throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}`);
    }
};

const detectPython = (): string => {
    const localVenvPython = '.venv-imagegen/bin/python';
    if (existsSync(localVenvPython)) return localVenvPython;

    const windowsVenvPython = '.venv-imagegen/Scripts/python.exe';
    if (existsSync(windowsVenvPython)) return windowsVenvPython;

    return 'python3';
};

const resolveImageGenPath = (): string => {
    if (process.env.IMAGE_GEN) return process.env.IMAGE_GEN;

    const codexHome = process.env.CODEX_HOME || join(homedir(), '.codex');
    return join(codexHome, 'skills', 'imagegen', 'scripts', 'image_gen.py');
};

const main = () => {
    loadEnvFile('.env.local');
    loadEnvFile('.env');

    if (!dryRun && !process.env.OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is missing. Set it in your shell or .env.local before running build:images.');
    }

    const python = detectPython();
    const imageGenPath = resolveImageGenPath();

    if (!existsSync(imageGenPath)) {
        throw new Error(`Image generation CLI not found at ${imageGenPath}. Set IMAGE_GEN to your script path.`);
    }

    if (!dryRun) {
        run(python, ['-c', 'import openai, PIL'], 'Python dependency check');
    }
    run('npm', ['run', 'inspirations:images:jobs'], 'Job generation');

    const genArgs = [
        imageGenPath,
        'generate-batch',
        '--input', JOBS_FILE,
        '--out-dir', OUTPUT_DIR,
        '--no-augment',
        '--concurrency', concurrency,
        '--downscale-max-dim', '768',
        '--downscale-suffix', '-768',
    ];

    if (force) {
        genArgs.push('--force');
    }
    if (dryRun) {
        genArgs.push('--dry-run');
    }

    run(python, genArgs, 'Image generation');

    if (!keepJobs) {
        rmSync(JOBS_FILE, { force: true });
    }

    process.stdout.write(`Generated inspiration images in ${OUTPUT_DIR}\n`);
};

main();
