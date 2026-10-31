/**
 * Lenient building blocks for route `validateSearch` schemas.
 *
 * The flat search codec (`./search`) hands every route `string | string[]`
 * values. Schemas built from these helpers never throw and never add a key:
 * an absent key stays absent, so no default is ever written into a URL, and
 * a value the app cannot use (a repeated key, an unknown option) reads as
 * `undefined`. Valid values pass through unchanged as the same string, so a
 * URL that is rebuilt from the validated search keeps its exact bytes.
 * Wrap them in `z.looseObject` so parameters a route does not know survive.
 *
 * `zod/mini` keeps these schemas small: route definitions are part of the
 * eagerly loaded route tree.
 */
import * as z from 'zod/mini';

/** Any single string value, kept exactly as written. */
export const searchText = () => z.catch(z.optional(z.string()), undefined);

/** One of a fixed set of string options; anything else reads as absent. */
export const searchOption = <const T extends readonly [string, ...string[]]>(options: T) =>
    z.catch(z.optional(z.enum(options)), undefined);

/**
 * A decimal number kept as its original text, so `zoom=1.50` is not
 * rewritten to `1.5` when the router rebuilds the URL.
 */
export const searchNumberText = () => z.catch(z.optional(z.string().check(z.regex(/^-?\d+(\.\d+)?$/))), undefined);

/** Parse with a lenient schema; a non-object input reads as an empty search. */
export const parseSearchWith = <T extends z.ZodMiniType<Record<string, unknown>>>(schema: T, search: unknown): z.infer<T> => {
    const result = schema.safeParse(search ?? {});
    return result.success ? result.data : schema.parse({});
};
