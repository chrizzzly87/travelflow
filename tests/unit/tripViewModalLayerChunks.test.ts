import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(resolve(process.cwd(), file), 'utf8');

// TripView imports the modal layer eagerly, so a static import of a modal here
// would pull that modal into the TripView chunk.
const LAZY_MODALS = ['AddActivityModal', 'AddCityModal', 'TripShareModal', 'TripHistoryModal', 'ReleaseNoticeDialog', 'TripInfoModal'];

describe('components/tripview/TripViewModalLayer chunk boundaries', () => {
    const source = read('components/tripview/TripViewModalLayer.tsx');

    it.each(LAZY_MODALS)('loads %s through a lazy import only', (moduleName) => {
        expect(source).toContain(`import('../${moduleName}')`);
        expect(source).not.toMatch(new RegExp(`^import[^;]*from '\\.\\./${moduleName}';`, 'm'));
    });

    it('keeps the lazy-import recovery keys TripView used', () => {
        for (const moduleName of LAZY_MODALS) {
            expect(source).toContain(`lazyWithRecovery('${moduleName}'`);
        }
    });

    it('leaves no modal module imported statically by TripView', () => {
        const tripView = read('components/TripView.tsx');
        for (const moduleName of LAZY_MODALS) {
            expect(tripView).not.toMatch(new RegExp(`from '\\./${moduleName}'`));
        }
    });
});
