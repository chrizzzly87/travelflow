import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { CANVAS_OMISSIONS } from '../../components/admin/componentCanvas/canvasCatalog';

const ROOT = path.resolve(__dirname, '../..');
const UI_DIR = path.join(ROOT, 'components/ui');
const CANVAS_DIR = path.join(ROOT, 'components/admin/componentCanvas');

const uiComponentFiles = fs.readdirSync(UI_DIR).filter((file) => file.endsWith('.tsx'));
const canvasGroupSources = fs.readdirSync(CANVAS_DIR)
    .filter((file) => file.startsWith('canvasGroups') && file.endsWith('.tsx'))
    .map((file) => fs.readFileSync(path.join(CANVAS_DIR, file), 'utf8'))
    .join('\n');

describe('component canvas coverage', () => {
    it('shows every components/ui file or names why it is omitted', () => {
        const missing = uiComponentFiles.filter((file) => {
            const module = file.replace(/\.tsx$/, '');
            const imported = canvasGroupSources.includes(`'../../ui/${module}'`);
            return !imported && !(file in CANVAS_OMISSIONS);
        });
        expect(missing).toEqual([]);
    });

    it('does not list a shown or deleted file as omitted', () => {
        for (const file of Object.keys(CANVAS_OMISSIONS)) {
            expect(uiComponentFiles).toContain(file);
            expect(canvasGroupSources).not.toContain(`'../../ui/${file.replace(/\.tsx$/, '')}'`);
            expect(CANVAS_OMISSIONS[file].length).toBeGreaterThan(20);
        }
    });

    it('never makes a component depend on canvas code', () => {
        for (const file of uiComponentFiles) {
            expect(fs.readFileSync(path.join(UI_DIR, file), 'utf8')).not.toContain('componentCanvas');
        }
    });
});
