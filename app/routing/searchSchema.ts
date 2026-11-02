/**
 * Lenient building blocks for route `validateSearch` schemas.
 *
 * The flat search codec (`./search`) hands every route `string | string[]`
 * values. Schemas built here never throw and never add a key: an absent key
 * stays absent, so no default is ever written into a URL, and a value the app
 * cannot use (a repeated key, an unknown option) reads as `undefined`. Valid
 * values pass through as the same string, so a URL rebuilt from the validated
 * search keeps its exact bytes. Parameters a schema does not declare survive.
 *
 * These are plain functions on purpose. Area route definitions are part of
 * the eagerly loaded route tree, and even `zod/mini` added ~13 kB gzip to the
 * landing pages' module-preload graph for a handful of string checks.
 */
export type SearchField<T> = (value: unknown) => T | undefined;

/** Any single string value, kept exactly as written. */
export const searchText = (): SearchField<string> => value => (typeof value === 'string' ? value : undefined);

/** One of a fixed set of string options; anything else reads as absent. */
export const searchOption = <const T extends readonly [string, ...string[]]>(options: T): SearchField<T[number]> =>
    value => (typeof value === 'string' && (options as readonly string[]).includes(value) ? value as T[number] : undefined);

const DECIMAL = /^-?\d+(\.\d+)?$/;
/**
 * A decimal number kept as its original text, so `zoom=1.50` is not
 * rewritten to `1.5` when the router rebuilds the URL.
 */
export const searchNumberText = (): SearchField<string> => value => (typeof value === 'string' && DECIMAL.test(value) ? value : undefined);

export type SearchSchemaOutput<F extends Record<string, SearchField<unknown>>> =
    { [K in keyof F]?: NonNullable<ReturnType<F[K]>> } & Record<string, unknown>;

/** A `validateSearch` function that checks the declared keys and keeps every other one. */
export const defineSearchSchema = <F extends Record<string, SearchField<unknown>>>(fields: F) =>
    (input: unknown): SearchSchemaOutput<F> => {
        const raw = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
        const output: Record<string, unknown> = { ...raw };
        for (const key of Object.keys(fields)) {
            if (Object.prototype.hasOwnProperty.call(raw, key)) output[key] = fields[key](raw[key]);
        }
        return output as SearchSchemaOutput<F>;
    };
