/** Node TypeScript cannot resolve Deno URL imports. Describe the consumed
 * constructor contract of the pinned edge runtime module. */
declare module 'https://deno.land/x/og_edge@0.0.6/mod.ts' {
    export const ImageResponse: import('./buffered-og-image').OgImageConstructor;
}

/** Edge OG renderers import React from esm.sh for Deno's bundler. Type it
 * against the project's installed React so JSX and hooks stay checked. */
declare module 'https://esm.sh/react@18.3.1' {
    import React from 'react';
    export default React;
}

/** Path helpers used by scripts/render-site-og-static-batch.deno.ts (run under Deno). */
declare module 'https://deno.land/std@0.224.0/path/mod.ts' {
    export function dirname(path: string): string;
    export function fromFileUrl(url: string | URL): string;
    export function join(...paths: string[]): string;
    export function normalize(path: string): string;
}
