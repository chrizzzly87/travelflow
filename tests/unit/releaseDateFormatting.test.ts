import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatReleaseDate } from '../../services/releaseNotesFormat';

describe('release publication calendar', () => {
    it('localizes the same Gregorian publication day in the requested route language', () => {
        expect(formatReleaseDate('2026-03-01T10:00:00Z', 'fr')).toBe('1 mars 2026');
        expect(formatReleaseDate('2026-03-01T10:00:00Z', 'de')).toBe('1. März 2026');
        expect(formatReleaseDate('2026-03-01T10:00:00Z', 'en')).toBe('Mar 1, 2026');
        expect(formatReleaseDate('2026-03-01T10:00:00Z', 'fa')).toContain('۲۰۲۶');
    });

    it('follows the fixed CET date cutoff in winter and summer', () => {
        for (const month of ['01', '07']) {
            const before = formatReleaseDate(`2026-${month}-13T22:59:59Z`, 'en');
            const after = formatReleaseDate(`2026-${month}-13T23:00:00Z`, 'en');
            expect(before).toContain('13, 2026');
            expect(after).toContain('14, 2026');
        }
        expect(formatReleaseDate('2026-10-13', 'en')).toBe('Oct 13, 2026');
    });

    it('preserves invalid input instead of throwing or displaying an invalid date', () => {
        expect(formatReleaseDate('not-a-release-date', 'fr')).toBe('not-a-release-date');
        expect(formatReleaseDate('', 'en')).toBe('');
    });

    it('produces the same output in separate processes with different host locales and timezones', () => {
        // Changing TZ inside a Vitest worker does not reliably change Node's
        // timezone. Separate processes model server/browser host defaults.
        const moduleUrl = pathToFileURL(path.resolve('services/releaseNotesFormat.ts')).href;
        const code = `import { formatReleaseDate } from ${JSON.stringify(moduleUrl)};
            process.stdout.write(JSON.stringify({
                host: new Intl.DateTimeFormat().resolvedOptions(),
                values: ['2026-07-13T22:59:59Z', '2026-07-13T23:00:00Z', '2026-10-13'].map(value => formatReleaseDate(value, 'fr'))
            }));`;
        const run = (language: string, timezone: string) => JSON.parse(execFileSync(process.execPath,
            ['--import', 'tsx', '--input-type=module', '-e', code],
            { encoding: 'utf8', env: { ...process.env, LANG: language, LC_ALL: language, TZ: timezone } }));
        const server = run('en_US.UTF-8', 'America/Los_Angeles');
        const browser = run('de_DE.UTF-8', 'Pacific/Kiritimati');
        expect(server.host.locale).not.toBe(browser.host.locale);
        expect(server.host.timeZone).not.toBe(browser.host.timeZone);
        expect(server.values).toEqual(browser.values);
        expect(server.values).toEqual(['13 juil. 2026', '14 juil. 2026', '13 oct. 2026']);
    });
});
