/** Node TypeScript cannot resolve Deno URL imports. Describe the consumed
 * constructor contract of the pinned edge runtime module. */
declare module 'https://deno.land/x/og_edge@0.0.6/mod.ts' {
    export const ImageResponse: import('./buffered-og-image').OgImageConstructor;
}
