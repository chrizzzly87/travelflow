export type OgImageConstructor = new (element: unknown, options: Record<string, unknown>) => Response;

// Defer module evaluation (including WASM initialization fetches) until there is
// an active request. Fully consume the PNG before committing success headers.
export const createBufferedOgRenderer = (load: () => Promise<OgImageConstructor>, timeoutMs = 15_000) => {
  let loading: Promise<OgImageConstructor> | undefined;
  return async (element: unknown, options: Record<string, unknown> = {}): Promise<Response> => {
    let cancelled = false;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const render = async () => {
      loading ??= load().catch(error => { loading = undefined; throw error; });
      const Constructor = await loading;
      if (cancelled) throw new Error('OG image rendering timed out.');
      const source = new Constructor(element, options);
      if (!source.ok || !source.body) throw new Error('OG renderer returned no image.');
      reader = source.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 4 * 1024 * 1024) throw new Error('OG image exceeds input budget.');
        chunks.push(chunk.value);
      }
      const png = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { png.set(chunk, offset); offset += chunk.byteLength; }
      if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => png[index] === byte)) throw new Error('OG renderer returned an invalid PNG.');
      const headers = new Headers(options.headers as HeadersInit | undefined);
      headers.set('content-type', 'image/png');
      headers.set('content-length', String(size));
      const cache = headers.get('cache-control') || 'public, max-age=0, s-maxage=3600';
      headers.set('cache-control', cache);
      headers.set('netlify-cdn-cache-control', cache);
      return new Response(png, { status: source.status, headers });
    };
    try {
      return await Promise.race([render(), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { cancelled = true; reject(new Error('OG image rendering timed out.')); }, timeoutMs);
      })]);
    } finally {
      clearTimeout(timer);
      if (reader) void reader.cancel().catch(() => {});
    }
  };
};
