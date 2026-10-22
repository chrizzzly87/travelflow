import fs from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { renderServiceWorker } from '../../scripts/lib/serviceWorkerManifest.mjs';

const ORIGIN = 'https://travelflowapp.netlify.app';
const NEUTRAL = '<title>Offline Shell | TravelFlow</title>';
const EXAMPLE = '<title>Taiwan Example | TravelFlow</title><script>exampleSnapshot</script>';
const template = fs.readFileSync('scripts/templates/sw.js', 'utf8');
const basicResponse = (html: string) => {
    const response = new Response(html);
    Object.defineProperty(response, 'type', { value: 'basic' });
    return response;
};

/** Execute the shipped worker, including its real install and navigation handlers. */
function workerHarness(initialShell = NEUTRAL) {
    const entries = new Map<string, Response>([['/spa.html', basicResponse(initialShell)]]);
    const timers: Array<() => void> = [];
    const listeners = new Map<string, (event: unknown) => void>();
    let network: () => Promise<Response> = async () => basicResponse(EXAMPLE);
    const context = vm.createContext({
        self: {
            location: { origin: ORIGIN },
            clients: { matchAll: async () => [{}] },
            addEventListener: (type: string, handler: (event: unknown) => void) => listeners.set(type, handler),
        },
        caches: { open: async () => ({
            match: async (key: string) => entries.get(key)?.clone(),
            put: async (key: string, response: Response) => { entries.set(key, response); },
            addAll: async (urls: string[]) => {
                for (const url of urls) entries.set(url, basicResponse(url === '/spa.html' ? NEUTRAL : 'asset'));
            },
        }) },
        fetch: () => network(),
        setTimeout: (callback: () => void) => { timers.push(callback); },
        URL,
        Response,
    });
    vm.runInContext(renderServiceWorker(template, { buildHash: 'same-build', precacheUrls: ['/spa.html'] }), context);
    return {
        entries,
        setNetwork: (next: () => Promise<Response>) => { network = next; },
        expireTimeout: async () => {
            await new Promise(resolve => setImmediate(resolve));
            timers.splice(0).forEach(callback => callback());
        },
        navigate: (pathname: string): Promise<Response> => {
            let result!: Promise<Response>;
            listeners.get('fetch')!({
                request: { url: `${ORIGIN}${pathname}`, method: 'GET', mode: 'navigate' },
                respondWith: (promise: Promise<Response>) => { result = promise; },
            });
            return result;
        },
        install: async () => {
            let result!: Promise<unknown>;
            listeners.get('install')!({ waitUntil: (promise: Promise<unknown>) => { result = promise; } });
            await result;
        },
    };
}

describe('service worker navigation documents', () => {
    it('returns the requested network document without replacing the neutral Start shell', async () => {
        const worker = workerHarness();
        expect(await (await worker.navigate('/example/taiwan')).text()).toBe(EXAMPLE);
        expect(await worker.entries.get('/spa.html')!.clone().text()).toBe(NEUTRAL);
        expect([...worker.entries.keys()]).toEqual(['/spa.html']);
    });

    it('uses the neutral shell on timeout and never replaces it with a late route response', async () => {
        const worker = workerHarness();
        await worker.navigate('/example/taiwan');
        let finish!: (response: Response) => void;
        worker.setNetwork(() => new Promise(resolve => { finish = resolve; }));
        const navigation = worker.navigate('/create-trip');
        await worker.expireTimeout();
        expect(await (await navigation).text()).toBe(NEUTRAL);
        finish(basicResponse('<title>Create Trip | TravelFlow</title>'));
        await Promise.resolve();
        await Promise.resolve();
        expect(await worker.entries.get('/spa.html')!.clone().text()).toBe(NEUTRAL);
    });

    it('uses the neutral shell when the network fails', async () => {
        const worker = workerHarness();
        worker.setNetwork(async () => { throw new TypeError('Offline'); });
        expect(await (await worker.navigate('/create-trip')).text()).toBe(NEUTRAL);
    });

    it('repairs an older poisoned shell during install even when the precache hash is unchanged', async () => {
        const worker = workerHarness(EXAMPLE);
        await worker.install();
        expect(await worker.entries.get('/spa.html')!.clone().text()).toBe(NEUTRAL);
    });
});
