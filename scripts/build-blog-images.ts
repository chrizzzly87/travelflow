import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const JOBS_FILE = 'tmp/imagegen/blog-images.jsonl';
const OUTPUT_DIR = 'public/images/blog';
const RESPONSIVE_WEBP_VARIANTS = [
    { suffix: '-480', maxDim: 480, quality: 56 },
    { suffix: '-768', maxDim: 768, quality: 62 },
    { suffix: '-1024', maxDim: 1024, quality: 66 },
] as const;
const LARGE_WEBP_MAX_DIM = 1536;
const LARGE_WEBP_QUALITY = 70;
const LARGE_WEBP_SIZE_THRESHOLD_BYTES = 420_000;
const OG_JPEG_MAX_DIM = 768;
const OG_JPEG_QUALITY = 50;
const OG_JPEG_SIZE_THRESHOLD_BYTES = 180_000;

const args = process.argv.slice(2);
const keepJobs = args.includes('--keep-jobs');
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const includeDrafts = args.includes('--include-drafts');
const skipGeneration = args.includes('--skip-generation');

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

const getTargetDimensions = (width: number, height: number, maxDim: number): { width: number; height: number } => {
    const scale = Math.min(1, maxDim / Math.max(width, height));
    return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
    };
};

const replaceFile = (tmpPath: string, targetPath: string) => {
    rmSync(targetPath, { force: true });
    renameSync(tmpPath, targetPath);
};

const writeWebpDerivative = async (
    sourcePath: string,
    targetPath: string,
    maxDim: number,
    quality: number,
): Promise<void> => {
    const metadata = await sharp(sourcePath).metadata();
    if (!metadata.width || !metadata.height) {
        throw new Error(`Unable to read image dimensions for ${sourcePath}`);
    }

    const target = getTargetDimensions(metadata.width, metadata.height, maxDim);
    await sharp(sourcePath)
        .rotate()
        .resize({
            width: target.width,
            height: target.height,
            fit: 'fill',
        })
        .webp({
            quality,
            effort: 6,
            smartSubsample: true,
        })
        .toFile(targetPath);
};

const optimizeLargeWebpInPlace = async (
    sourcePath: string,
    maxDim = LARGE_WEBP_MAX_DIM,
    quality = LARGE_WEBP_QUALITY,
): Promise<void> => {
    const tmpPath = `${sourcePath}.tmp`;
    await writeWebpDerivative(sourcePath, tmpPath, maxDim, quality);
    replaceFile(tmpPath, sourcePath);
};

const optimizeOgJpegInPlace = async (
    sourcePath: string,
    maxDim = OG_JPEG_MAX_DIM,
    quality = OG_JPEG_QUALITY,
): Promise<void> => {
    const metadata = await sharp(sourcePath).metadata();
    if (!metadata.width || !metadata.height) {
        throw new Error(`Unable to read image dimensions for ${sourcePath}`);
    }

    const target = getTargetDimensions(metadata.width, metadata.height, maxDim);
    const tmpPath = `${sourcePath}.tmp`;

    await sharp(sourcePath)
        .rotate()
        .resize({
            width: target.width,
            height: target.height,
            fit: 'fill',
        })
        .jpeg({
            quality,
            mozjpeg: true,
            progressive: true,
        })
        .toFile(tmpPath);

    replaceFile(tmpPath, sourcePath);
};

const ensureResponsiveDownscales = async (isDryRun: boolean, forceOverwrite: boolean): Promise<number> => {
    if (!existsSync(OUTPUT_DIR)) {
        return 0;
    }

    const files = readdirSync(OUTPUT_DIR)
        .filter((file) => /-(card|header)\.webp$/i.test(file))
        .sort((a, b) => a.localeCompare(b));

    let generated = 0;

    for (const file of files) {
        const largePath = join(OUTPUT_DIR, file);
        for (const variant of RESPONSIVE_WEBP_VARIANTS) {
            const derivativeFile = file.replace(/\.webp$/i, `${variant.suffix}.webp`);
            const derivativePath = join(OUTPUT_DIR, derivativeFile);

            if (existsSync(derivativePath) && !forceOverwrite) {
                continue;
            }

            if (isDryRun) {
                process.stdout.write(`[blog-images] Dry run: would ${existsSync(derivativePath) ? 'refresh' : 'generate'} responsive copy ${derivativePath}\n`);
                generated += 1;
                continue;
            }

            await writeWebpDerivative(largePath, derivativePath, variant.maxDim, variant.quality);
            generated += 1;
            process.stdout.write(`[blog-images] Wrote responsive copy ${derivativePath}\n`);
        }
    }

    return generated;
};

const ensureOptimizedLargeWebps = async (isDryRun: boolean, forceOverwrite: boolean): Promise<number> => {
    if (!existsSync(OUTPUT_DIR)) {
        return 0;
    }

    const files = readdirSync(OUTPUT_DIR)
        .filter((file) => /-(card|header)\.webp$/i.test(file))
        .sort((a, b) => a.localeCompare(b));

    let optimized = 0;

    for (const file of files) {
        const fullPath = join(OUTPUT_DIR, file);
        const currentSize = statSync(fullPath).size;
        const shouldOptimize = forceOverwrite || currentSize > LARGE_WEBP_SIZE_THRESHOLD_BYTES;

        if (!shouldOptimize) {
            continue;
        }

        if (isDryRun) {
            process.stdout.write(`[blog-images] Dry run: would optimize large WebP ${fullPath}\n`);
            optimized += 1;
            continue;
        }

        await optimizeLargeWebpInPlace(fullPath, LARGE_WEBP_MAX_DIM, LARGE_WEBP_QUALITY);
        optimized += 1;
        process.stdout.write(`[blog-images] Optimized large WebP ${fullPath}\n`);
    }

    return optimized;
};

const ensureOptimizedOgJpegs = async (isDryRun: boolean, forceOverwrite: boolean): Promise<number> => {
    if (!existsSync(OUTPUT_DIR)) {
        return 0;
    }

    const files = readdirSync(OUTPUT_DIR)
        .filter((file) => /-og-vertical\.jpe?g$/i.test(file))
        .sort((a, b) => a.localeCompare(b));

    let optimized = 0;

    for (const file of files) {
        const fullPath = join(OUTPUT_DIR, file);
        const currentSize = statSync(fullPath).size;
        const shouldOptimize = forceOverwrite || currentSize > OG_JPEG_SIZE_THRESHOLD_BYTES;

        if (!shouldOptimize) {
            continue;
        }

        if (isDryRun) {
            process.stdout.write(`[blog-images] Dry run: would optimize OG JPEG ${fullPath}\n`);
            optimized += 1;
            continue;
        }

        await optimizeOgJpegInPlace(fullPath, OG_JPEG_MAX_DIM, OG_JPEG_QUALITY);
        optimized += 1;
        process.stdout.write(`[blog-images] Optimized OG JPEG ${fullPath}\n`);
    }

    return optimized;
};

const main = async () => {
    loadEnvFile('.env.local');
    loadEnvFile('.env');

    if (!skipGeneration) {
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
                run(python, ['-c', 'import openai'], 'Python dependency check');
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
    } else {
        process.stdout.write('[blog-images] Skipping image generation; running derivative + optimization only.\n');
    }

    if (!existsSync(OUTPUT_DIR) && !dryRun) {
        mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const generatedResponsive = await ensureResponsiveDownscales(dryRun, force);
    if (generatedResponsive > 0) {
        process.stdout.write(`[blog-images] ${dryRun ? 'Planned' : 'Generated'} ${generatedResponsive} responsive derivative(s).\n`);
    }

    const optimizedLarge = await ensureOptimizedLargeWebps(dryRun, force);
    if (optimizedLarge > 0) {
        process.stdout.write(`[blog-images] ${dryRun ? 'Planned' : 'Optimized'} ${optimizedLarge} large WebP asset(s).\n`);
    }

    const optimizedOg = await ensureOptimizedOgJpegs(dryRun, force);
    if (optimizedOg > 0) {
        process.stdout.write(`[blog-images] ${dryRun ? 'Planned' : 'Optimized'} ${optimizedOg} OG JPEG asset(s).\n`);
    }

    if (!keepJobs && !skipGeneration) {
        rmSync(JOBS_FILE, { force: true });
    }

    process.stdout.write(`Prepared blog images in ${OUTPUT_DIR}\n`);
};

main().catch((error) => {
    process.stderr.write(`[blog-images] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
});
