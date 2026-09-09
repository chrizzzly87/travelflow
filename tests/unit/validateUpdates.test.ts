import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

const run = promisify(execFile);
const SCRIPT = path.resolve(process.cwd(), 'scripts/validate-updates.mjs');
const workspaces: string[] = [];

const iso = (offsetMs: number): string => (
    new Date(Math.floor((Date.now() + offsetMs) / 60_000) * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z')
);

const note = (fields: Record<string, string>): string => [
    '---',
    `id: ${fields.id}`,
    `version: ${fields.version}`,
    'title: "A release"',
    `date: ${fields.published_at.slice(0, 10)}`,
    `published_at: ${fields.published_at}`,
    `status: ${fields.status ?? 'published'}`,
    'notify_in_app: false',
    'in_app_hours: 24',
    'summary: "One sentence."',
    '---',
    '',
    '## Changes',
    '- [x] [Fixed] 🌃 Something a traveller notices.',
    '',
].join('\n');

/** Each case gets its own content/updates tree, since the script reads cwd. */
const workspace = async (notes: Array<Record<string, string>>): Promise<string> => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'updates-validate-'));
    workspaces.push(dir);
    await fs.mkdir(path.join(dir, 'content/updates'), { recursive: true });
    for (const fields of notes) {
        await fs.writeFile(path.join(dir, 'content/updates', `${fields.id}.md`), note(fields), 'utf8');
    }
    return dir;
};

const validate = (cwd: string, ...args: string[]) => run('node', [SCRIPT, ...args], { cwd });

const frontmatter = async (cwd: string, id: string): Promise<Record<string, string>> => {
    const raw = await fs.readFile(path.join(cwd, 'content/updates', `${id}.md`), 'utf8');
    return Object.fromEntries(
        raw.split('\n---')[0].split('\n').slice(1)
            .map((line) => line.split(/:(.*)/s))
            .filter((parts) => parts.length > 1)
            .map(([key, value]) => [key.trim(), value.trim()]),
    );
};

afterEach(async () => {
    await Promise.all(workspaces.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('updates:validate future published_at', () => {
    it('warns instead of failing when a release is stamped slightly ahead of the clock', async () => {
        // A six-minute lead used to bounce the whole Netlify build, which parallel
        // worktrees hit routinely because each stamps its own release note.
        const cwd = await workspace([{ id: 'rel-a', version: 'v0.1.0', published_at: iso(6 * 60_000) }]);

        const result = await validate(cwd);

        expect(result.stderr).toContain('ahead of this machine\'s clock');
        expect(result.stderr).toContain('pnpm updates:fix');
        expect(result.stdout).toContain('validated 1 update file(s)');
    });

    it('still fails a date typed more than a day out', async () => {
        const cwd = await workspace([{ id: 'rel-a', version: 'v0.1.0', published_at: iso(3 * 24 * 60 * 60_000) }]);

        await expect(validate(cwd)).rejects.toMatchObject({ code: 1 });
    });

    it('leaves a draft alone whatever its timestamp says', async () => {
        const cwd = await workspace([
            { id: 'rel-a', version: 'v0.1.0', published_at: iso(30 * 24 * 60 * 60_000), status: 'draft' },
        ]);

        const result = await validate(cwd);

        expect(result.stdout).toContain('validated 1 update file(s)');
    });
});

describe('updates:validate --fix', () => {
    it('clamps a future published_at back to now', async () => {
        const ahead = iso(10 * 60_000);
        const cwd = await workspace([{ id: 'rel-a', version: 'v0.1.0', published_at: ahead }]);

        const result = await validate(cwd, '--fix');

        expect(result.stdout).toContain('[updates:fix] applied:');
        const meta = await frontmatter(cwd, 'rel-a');
        expect(Date.parse(meta.published_at)).toBeLessThanOrEqual(Date.now());
        expect(meta.published_at).not.toBe(ahead);
    });

    it('renumbers the release that lost the race for a version', async () => {
        const cwd = await workspace([
            { id: 'rel-a', version: 'v0.163.0', published_at: iso(-120 * 60_000) },
            { id: 'rel-b', version: 'v0.163.0', published_at: iso(-60 * 60_000) },
        ]);

        const result = await validate(cwd, '--fix');

        expect(result.stdout).toContain('rel-b.md: version v0.163.0 -> v0.164.0');
        expect((await frontmatter(cwd, 'rel-a')).version).toBe('v0.163.0');
        expect((await frontmatter(cwd, 'rel-b')).version).toBe('v0.164.0');
    });

    it('leaves a healthy set untouched and reports nothing to change', async () => {
        const cwd = await workspace([
            { id: 'rel-a', version: 'v0.1.0', published_at: iso(-120 * 60_000) },
            { id: 'rel-b', version: 'v0.2.0', published_at: iso(-60 * 60_000) },
        ]);
        const before = await fs.readFile(path.join(cwd, 'content/updates/rel-b.md'), 'utf8');

        const result = await validate(cwd, '--fix');

        expect(result.stdout).toContain('[updates:fix] nothing to change');
        expect(await fs.readFile(path.join(cwd, 'content/updates/rel-b.md'), 'utf8')).toBe(before);
    });

    it('leaves the rest of the file byte-identical when it rewrites one field', async () => {
        const cwd = await workspace([{ id: 'rel-a', version: 'v0.1.0', published_at: iso(10 * 60_000) }]);
        const file = path.join(cwd, 'content/updates/rel-a.md');
        const before = await fs.readFile(file, 'utf8');

        await validate(cwd, '--fix');

        const after = await fs.readFile(file, 'utf8');
        const stripPublishedAt = (value: string) => value.replace(/^published_at:.*$/m, '');
        expect(stripPublishedAt(after)).toBe(stripPublishedAt(before));
    });
});
