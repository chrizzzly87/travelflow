import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const JOBS_FILE = 'tmp/imagegen/blog-images.jsonl';
const OUTPUT_DIR = 'public/images/blog';

const args = process.argv.slice(2);
const keepJobs = args.includes('--keep-jobs');
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const includeDrafts = args.includes('--include-drafts');

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

const countJobs = (path: string): number => {
    if (!existsSync(path)) return 0;
    const raw = readFileSync(path, 'utf8');
    return raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#')).length;
};

const downscaleWithPillow = (python: string, sourcePath: string, targetPath: string, maxDim = 768) => {
    const script = [
        'from PIL import Image',
        'import sys',
        'source_path, target_path, max_dim = sys.argv[1], sys.argv[2], int(sys.argv[3])',
        'with Image.open(source_path) as image:',
        '    image.load()',
        '    width, height = image.size',
        '    scale = min(1.0, float(max_dim) / float(max(width, height)))',
        '    target = (max(1, int(round(width * scale))), max(1, int(round(height * scale))))',
        '    resized = image if target == (width, height) else image.resize(target, Image.Resampling.LANCZOS)',
        "    resized.save(target_path, format='WEBP')",
    ].join('\n');

    run(python, ['-c', script, sourcePath, targetPath, String(maxDim)], `Downscale ${sourcePath}`);
};

const ensureResponsiveDownscales = (python: string, isDryRun: boolean, forceOverwrite: boolean): number => {
    if (!existsSync(OUTPUT_DIR)) {
        return 0;
    }

    const files = readdirSync(OUTPUT_DIR)
        .filter((file) => /-(card|header)\.webp$/i.test(file))
        .sort((a, b) => a.localeCompare(b));

    let generated = 0;

    for (const file of files) {
        const largePath = join(OUTPUT_DIR, file);
        const smallFile = file.replace(/\.webp$/i, '-768.webp');
        const smallPath = join(OUTPUT_DIR, smallFile);

        if (existsSync(smallPath) && !forceOverwrite) {
            continue;
        }

        if (isDryRun) {
            process.stdout.write(`[blog-images] Dry run: would ${existsSync(smallPath) ? 'refresh' : 'generate'} responsive copy ${smallPath}\n`);
            generated += 1;
            continue;
        }

        downscaleWithPillow(python, largePath, smallPath, 768);
        generated += 1;
        process.stdout.write(`[blog-images] Wrote responsive copy ${smallPath}\n`);
    }

    return generated;
};

const main = () => {
    loadEnvFile('.env.local');
    loadEnvFile('.env');

    const python = detectPython();
    const imageGenPath = resolveImageGenPath();

    const jobBuilderArgs = ['run', 'blog:images:jobs', '--', `--out=${JOBS_FILE}`];
    if (force) {
        jobBuilderArgs.push('--force');
    }
    if (includeDrafts) {
        jobBuilderArgs.push('--include-drafts');
    }

    run('npm', jobBuilderArgs, 'Job generation');

    const jobCount = countJobs(JOBS_FILE);

    if (jobCount > 0) {
        if (!dryRun && !process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is missing. Set it in your shell or .env.local before running build:blog-images.');
        }

        if (!existsSync(imageGenPath)) {
            throw new Error(`Image generation CLI not found at ${imageGenPath}. Set IMAGE_GEN to your script path.`);
        }

        if (!dryRun) {
            run(python, ['-c', 'import openai, PIL'], 'Python dependency check');
        }

        const genArgs = [
            imageGenPath,
            'generate-batch',
            '--input', JOBS_FILE,
            '--out-dir', OUTPUT_DIR,
            '--no-augment',
            '--concurrency', concurrency,
        ];

        if (force) {
            genArgs.push('--force');
        }
        if (dryRun) {
            genArgs.push('--dry-run');
        }

        run(python, genArgs, 'Image generation');
    } else {
        process.stdout.write('[blog-images] No missing source images detected.\n');
    }

    if (!existsSync(OUTPUT_DIR) && !dryRun) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const generatedResponsive = ensureResponsiveDownscales(python, dryRun, force);
    if (generatedResponsive > 0) {
        process.stdout.write(`[blog-images] ${dryRun ? 'Planned' : 'Generated'} ${generatedResponsive} responsive derivative(s).\n`);
    }

    if (!keepJobs) {
        rmSync(JOBS_FILE, { force: true });
    }

    process.stdout.write(`Prepared blog images in ${OUTPUT_DIR}\n`);
};

main();
