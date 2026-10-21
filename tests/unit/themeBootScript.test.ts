import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { THEME_BOOT_KEYS, THEME_SURFACE_COLOR } from '../../contexts/theme/themeStore';

describe('native document theme boot script', () => {
    const bootScript = fs.readFileSync(path.join(process.cwd(), 'src/document/theme-boot.js'), 'utf8');
    const html = fs.readFileSync(path.join(process.cwd(), 'src/routes/__root.tsx'), 'utf8');

    it('runs before the bundle and carries the same keys as the store', () => {
        // The script is inline and synchronous on purpose: marketing routes are
        // prerendered, so doing this from the bundle flashes the wrong theme on
        // every one of them. Its literals are duplicated from THEME_BOOT_KEYS,
        // and nothing else stops the two drifting apart.
        expect(fs.readFileSync('src/documentAssets.ts', 'utf8')).toContain('data-tf-theme-boot');
        expect(bootScript).toContain(THEME_BOOT_KEYS.storageKey);
        expect(bootScript).toContain(THEME_BOOT_KEYS.toneAttribute);
        expect(bootScript).toContain(`classList.add('${THEME_BOOT_KEYS.darkClass}')`);
    });

    it('does not seed theme custom properties inline', () => {
        // index.css is a render-blocking <link> in the same <head>, so :root and
        // .dark are already applied on the first paint and seeding is pointless.
        // Doing it anyway pinned the page dark forever, because an inline style
        // outranks the stylesheet and nothing removed it.
        expect(bootScript).not.toContain("setProperty('--background'");
        expect(bootScript).not.toContain("setProperty('--foreground'");
    });

    it('paints the installed app chrome with the header surface, on the first frame', () => {
        // The installed app's status-bar strip takes this colour. A fixed brand
        // value put a purple slab above a white header, which read as a gradient
        // seam across the top of the app; a value set only from the bundle
        // arrived a paint late. The literals are duplicated from the store, and
        // nothing else stops the two drifting apart.
        expect(html).toContain('name="theme-color"');
        expect(html).toContain('data-tf-theme-color=""');
        expect(html.indexOf('name="theme-color"')).toBeLessThan(html.indexOf('{bootScripts.map'));
        expect(html.indexOf('{bootScripts.map')).toBeLessThan(html.indexOf('<HeadContent />'));
        expect(bootScript).toContain('meta[data-tf-theme-color]');
        expect(bootScript).toContain(THEME_SURFACE_COLOR.dark);
        expect(bootScript).toContain(THEME_SURFACE_COLOR.light);
    });
});
