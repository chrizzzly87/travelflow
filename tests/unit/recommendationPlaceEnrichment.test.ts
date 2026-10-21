import { describe, expect, it } from 'vitest';

import {
    buildPlaceSearchQuery,
    collectPlaceNames,
    isMerchantPhoto,
    pickBestPhoto,
    toCostBand,
    type PlacePhoto,
} from '../../scripts/lib/recommendationPlaceEnrichment';

const photo = (overrides: Partial<PlacePhoto> & { author?: string } = {}): PlacePhoto => ({
    name: overrides.name ?? 'places/x/photos/y',
    widthPx: overrides.widthPx ?? 4000,
    heightPx: overrides.heightPx ?? 3000,
    authorAttributions: overrides.author ? [{ displayName: overrides.author }] : [],
});

describe('scripts/lib/recommendationPlaceEnrichment', () => {
    it('keeps Google’s own ordering, which puts the representative photo first', () => {
        const best = pickBestPhoto(
            [
                photo({ name: 'first', widthPx: 4000, heightPx: 1800 }),
                photo({ name: 'second', widthPx: 4096, heightPx: 2304 }),
            ],
            ['Raohe Night Market'],
        );

        expect(best?.name).toBe('first');
    });

    it('prefers the venue’s own photo over a bigger one from a passer-by', () => {
        const best = pickBestPhoto(
            [
                photo({ name: 'diner', widthPx: 4000, heightPx: 2252, author: 'Someone Else' }),
                photo({ name: 'merchant', widthPx: 1600, heightPx: 1067, author: '鼎泰豐 新生店' }),
            ],
            ['鼎泰豐 新生店', 'Din Tai Fung (Xinsheng Branch)'],
        );

        // Position favours the first entry; the merchant bonus has to be enough
        // to overturn it, because that is the brand shot rather than a snapshot.
        expect(best?.name).toBe('merchant');
    });

    it('passes over a portrait, which a wide card hero would crop to nothing', () => {
        const best = pickBestPhoto(
            [
                photo({ name: 'portrait', widthPx: 3024, heightPx: 4032 }),
                photo({ name: 'landscape', widthPx: 4032, heightPx: 3024 }),
            ],
            ['Jiufen Old Street'],
        );

        expect(best?.name).toBe('landscape');
    });

    it('returns nothing when there is nothing usable', () => {
        expect(pickBestPhoto([], ['Anywhere'])).toBeNull();
        expect(pickBestPhoto([{ widthPx: 100, heightPx: 100 }], ['Anywhere'])).toBeNull();
    });

    it('matches a venue photo across the English and Chinese spellings', () => {
        const names = collectPlaceNames('Wang’s Broth (王記府城)', '小王煮瓜');
        expect(isMerchantPhoto(photo({ author: '王記府城' }), names)).toBe(true);
        expect(isMerchantPhoto(photo({ author: 'A Tourist' }), names)).toBe(false);
    });

    it('does not treat a two-character author as a match for everything', () => {
        expect(isMerchantPhoto(photo({ author: 'Li' }), ['Li'])).toBe(false);
    });

    it('searches by the Chinese name, which is what actually resolves in Taiwan', () => {
        expect(buildPlaceSearchQuery('Zhongcheng Shandong Scallion Pancake (忠誠山東蔥油餜)', 'Taipei'))
            .toBe('Zhongcheng Shandong Scallion Pancake 忠誠山東蔥油餜 Taipei Taiwan');
        expect(buildPlaceSearchQuery('Din Tai Fung (Xinsheng Branch)', 'Taipei'))
            .toBe('Din Tai Fung Taipei Taiwan');
        expect(buildPlaceSearchQuery('Shifen', null)).toBe('Shifen Taiwan');
    });

    it('maps Google price levels onto our cost bands', () => {
        expect(toCostBand('PRICE_LEVEL_INEXPENSIVE')).toBe('$');
        expect(toCostBand('PRICE_LEVEL_VERY_EXPENSIVE')).toBe('$$$$');
        expect(toCostBand('PRICE_LEVEL_UNSPECIFIED')).toBeNull();
        expect(toCostBand(undefined)).toBeNull();
    });
});
