import { createBufferedOgRenderer, type OgImageConstructor } from './buffered-og-image.ts';

// og_edge starts WASM/font downloads when its module is evaluated. Keep that
// work inside the request, rather than during the Edge isolate's bootstrap.
export const renderOgImage = createBufferedOgRenderer(async () => {
  const { ImageResponse } = await import('https://deno.land/x/og_edge@0.0.6/mod.ts');
  return ImageResponse as unknown as OgImageConstructor;
});
