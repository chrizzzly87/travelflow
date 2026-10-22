import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBufferedOgRenderer } from '../../netlify/edge-lib/buffered-og-image';
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
afterEach(() => vi.useRealTimers());
describe('complete OG image delivery', () => {
  it('loads the runtime only inside a request and reuses its initialization', async () => {
    const load = vi.fn(async () => class extends Response { constructor() { super(png); } });
    const render = createBufferedOgRenderer(load);
    expect(load).not.toHaveBeenCalled();
    const first = await render({}, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=120' } });
    expect([...new Uint8Array(await first.arrayBuffer())]).toEqual([...png]);
    expect(first.headers.get('content-type')).toBe('image/png');
    expect(first.headers.get('content-length')).toBe('8');
    expect(first.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=120');
    expect(first.headers.get('netlify-cdn-cache-control')).toBe(first.headers.get('cache-control'));
    await render({}); expect(load).toHaveBeenCalledTimes(1);
  });
  it('does not commit a successful response until all image bytes arrive', async () => {
    let complete!: () => void;
    const stream = new ReadableStream<Uint8Array>({ start(controller) { complete = () => { controller.enqueue(png); controller.close(); }; } });
    const render = createBufferedOgRenderer(async () => class extends Response { constructor() { super(stream); } });
    const ready = vi.fn(); const pending = render({}).then(ready);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(ready).not.toHaveBeenCalled(); complete(); await pending;
    expect(ready).toHaveBeenCalledTimes(1);
  });
  it('propagates asynchronous render errors instead of returning a broken 200 image', async () => {
    const render = createBufferedOgRenderer(async () => class extends Response { constructor() { super(new ReadableStream({ start(c) { c.error(new Error('wasm failed')); } })); } });
    await expect(render({})).rejects.toThrow('wasm failed');
  });
  it('cancels stalled streams after a bounded deadline', async () => {
    vi.useFakeTimers(); const cancel = vi.fn();
    const render = createBufferedOgRenderer(async () => class extends Response { constructor() { super(new ReadableStream({ cancel })); } }, 25);
    const pending = expect(render({})).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(26); await pending; expect(cancel).toHaveBeenCalledTimes(1);
  });
  it('rejects non-PNG data and allows a failed module load to retry', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(class extends Response { constructor() { super('not an image'); } });
    const render = createBufferedOgRenderer(load);
    await expect(render({})).rejects.toThrow('unavailable');
    await expect(render({})).rejects.toThrow('invalid PNG');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
