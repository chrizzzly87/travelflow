// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';

import {
    extractKmlFromKmz,
    loadMyMapFromLink,
    resolveMissingIdeaPositions,
} from '../../services/googleMyMapsImportService';
import type { ITimelineItem } from '../../types';

const fixture = readFileSync(
    path.join(__dirname, '../fixtures/googleMyMaps/address-only-layer.kml'),
    'utf8',
);
const MAP_LINK = 'google.com/maps/d/edit?mid=1hxHkP7Do3tWUF6vpG045IfL5UbQ7i90&usp=sharing';

/** A minimal zip writer: enough to produce what My Maps serves as KMZ. */
const buildZip = (files: Array<{ name: string; content: string; deflate: boolean }>): ArrayBuffer => {
    const locals: Buffer[] = [];
    const centrals: Buffer[] = [];
    let offset = 0;
    files.forEach((file) => {
        const name = Buffer.from(file.name);
        const raw = Buffer.from(file.content);
        const data = file.deflate ? deflateRawSync(raw) : raw;
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(file.deflate ? 8 : 0, 8);
        local.writeUInt32LE(data.length, 18);
        local.writeUInt32LE(raw.length, 22);
        local.writeUInt16LE(name.length, 26);
        locals.push(local, name, data);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(file.deflate ? 8 : 0, 10);
        central.writeUInt32LE(data.length, 20);
        central.writeUInt32LE(raw.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt32LE(offset, 42);
        centrals.push(central, name);
        offset += local.length + name.length + data.length;
    });
    const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(centralSize, 12);
    end.writeUInt32LE(offset, 16);
    const zip = Buffer.concat([...locals, ...centrals, end]);
    return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength);
};

const textResponse = (body: string, status = 200) => new Response(body, { status });

describe('extractKmlFromKmz', () => {
    it('reads doc.kml out of a deflated KMZ and ignores the icons', async () => {
        const zip = buildZip([
            { name: 'images/icon-1.png', content: 'png-bytes', deflate: false },
            { name: 'doc.kml', content: fixture, deflate: true },
        ]);
        await expect(extractKmlFromKmz(zip)).resolves.toBe(fixture);
    });

    it('reads a stored (uncompressed) entry', async () => {
        const zip = buildZip([{ name: 'layer.kml', content: '<kml/>', deflate: false }]);
        await expect(extractKmlFromKmz(zip)).resolves.toBe('<kml/>');
    });

    it('refuses a zip without KML', async () => {
        const zip = buildZip([{ name: 'notes.txt', content: 'hi', deflate: false }]);
        await expect(extractKmlFromKmz(zip)).rejects.toMatchObject({ code: 'unsupported_file' });
    });
});

describe('loadMyMapFromLink', () => {
    it('downloads the KML of a shared map and turns its pins into ideas', async () => {
        const fetchImpl = vi.fn(async () => textResponse(fixture));
        const loaded = await loadMyMapFromLink(MAP_LINK, fetchImpl as unknown as typeof fetch);
        expect(fetchImpl).toHaveBeenCalledWith(
            'https://www.google.com/maps/d/kml?mid=1hxHkP7Do3tWUF6vpG045IfL5UbQ7i90&forcekml=1',
            { credentials: 'omit' },
        );
        // Five pins, one of them twice: the duplicate is dropped.
        expect(loaded.ideas.map((idea) => idea.title)).toEqual([
            'Taipei 101 Observatory',
            'Raohe Night Market',
            'Jiufen Old Street',
            'Elephant Mountain trailhead',
        ]);
        expect(loaded.ideas[0].sources.at(-1)?.url).toBe('https://www.google.com/maps/d/viewer?mid=1hxHkP7Do3tWUF6vpG045IfL5UbQ7i90');
    });

    it('reports a private map, which Google answers with a sign-in page', async () => {
        const fetchImpl = vi.fn(async () => textResponse('<!doctype html><html><title>Sign in</title></html>'));
        await expect(loadMyMapFromLink(MAP_LINK, fetchImpl as unknown as typeof fetch))
            .rejects.toMatchObject({ code: 'not_shared' });
    });

    it('reports a link that is not a My Maps link without fetching', async () => {
        const fetchImpl = vi.fn();
        await expect(loadMyMapFromLink('https://maps.app.goo.gl/xyz', fetchImpl as unknown as typeof fetch))
            .rejects.toMatchObject({ code: 'invalid_link' });
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('reports a network failure', async () => {
        const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
        await expect(loadMyMapFromLink(MAP_LINK, fetchImpl as unknown as typeof fetch))
            .rejects.toMatchObject({ code: 'network' });
    });
});

describe('resolveMissingIdeaPositions', () => {
    const cities = [
        { id: 'c1', type: 'city', title: 'Tainan', startDateOffset: 0, duration: 2, color: '', coordinates: { lat: 23, lng: 120.2 } },
        { id: 'c2', type: 'city', title: 'Taipei', startDateOffset: 2, duration: 4, color: '', coordinates: { lat: 25.03, lng: 121.56 } },
    ] as ITimelineItem[];

    it('looks up only pins without a position, biased to the stay they name', async () => {
        const loaded = await loadMyMapFromLink(MAP_LINK, (async () => textResponse(fixture)) as unknown as typeof fetch);
        const search = vi.fn(async (query: string) => (
            query.startsWith('Raohe') ? null : { coordinates: { lat: 25.1, lng: 121.5 } }
        ));
        const progress: Array<[number, number]> = [];
        const resolved = await resolveMissingIdeaPositions(loaded.ideas, {
            cities,
            search,
            onProgress: (done, total) => progress.push([done, total]),
        });

        // The hand-placed pin already has a position.
        expect(search).toHaveBeenCalledTimes(3);
        expect(search).toHaveBeenCalledWith(
            'Taipei 101 Observatory, Taipei 101, Taipei, Taiwan',
            { language: undefined, bias: { lat: 25.03, lng: 121.56 } },
        );
        expect(resolved[0].location).toMatchObject({ lat: 25.1, lng: 121.5 });
        // Not found: keeps its address, gets no invented position.
        expect(resolved[1].location).toEqual({ lat: null, lng: null, address: 'Raohe Street Night Market, Taipei, Taiwan' });
        expect(resolved[3].location).toMatchObject({ lat: 25.0272, lng: 121.5767 });
        expect(progress[0]).toEqual([0, 3]);
        expect(progress.at(-1)).toEqual([3, 3]);
    });
});
