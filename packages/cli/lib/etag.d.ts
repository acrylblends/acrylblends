import { L as MiddlewareHandler } from "./context-DS3fYyG-.js";

//#region ../../plugins/acryl-router/src/core/middleware/etag/index.d.ts
type ETagOptions = {
  retainedHeaders?: string[];
  weak?: boolean;
  generateDigest?: (body: Uint8Array<ArrayBuffer>) => ArrayBuffer | Promise<ArrayBuffer>;
};
/**
 * Default headers to pass through on 304 responses. From the spec:
 * > The response must not contain a body and must include the headers that
 * > would have been sent in an equivalent 200 OK response: Cache-Control,
 * > Content-Location, Date, ETag, Expires, and Vary.
 */
declare const RETAINED_304_HEADERS: string[];
/**
 * ETag Middleware for Acryl.
 *
 *
 * @param {ETagOptions} [options] - The options for the ETag middleware.
 * @param {boolean} [options.weak=false] - Define using or not using a weak validation. If true is set, then `W/` is added to the prefix of the value.
 * @param {string[]} [options.retainedHeaders=RETAINED_304_HEADERS] - The headers that you want to retain in the 304 Response.
 * @param {function(Uint8Array): ArrayBuffer | Promise<ArrayBuffer>} [options.generateDigest] -
 * A custom digest generation function. By default, it uses 'SHA-1'
 * This function is called with the response body as a `Uint8Array` and should return a hash as an `ArrayBuffer` or a Promise of one.
 * @returns {MiddlewareHandler} The middleware handler function.
 *
 * @example
 * ```ts
 * const app = new Acryl()
 *
 * app.use('/etag/*', etag())
 * app.get('/etag/abc', (c) => {
 *   return c.text('Acryl is hot')
 * })
 * ```
 */
declare const etag: (options?: ETagOptions) => MiddlewareHandler;
//#endregion
export { RETAINED_304_HEADERS, etag };