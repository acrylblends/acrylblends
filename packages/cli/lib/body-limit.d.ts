import { L as MiddlewareHandler, t as Context } from "./context-DS3fYyG-.js";

//#region ../../plugins/acryl-router/src/core/middleware/body-limit/index.d.ts
type OnError = (c: Context) => Response | Promise<Response>;
type BodyLimitOptions = {
  maxSize: number;
  onError?: OnError;
};
/**
 * Body Limit Middleware for Acryl.
 *
 *
 * @param {BodyLimitOptions} options - The options for the body limit middleware.
 * @param {number} options.maxSize - The maximum body size allowed.
 * @param {OnError} [options.onError] - The error handler to be invoked if the specified body size is exceeded.
 * @returns {MiddlewareHandler} The middleware handler function.
 *
 * @example
 * ```ts
 * const app = new Acryl()
 *
 * app.post(
 *   '/upload',
 *   bodyLimit({
 *     maxSize: 50 * 1024, // 50kb
 *     onError: (c) => {
 *       return c.text('overflow :(', 413)
 *     },
 *   }),
 *   async (c) => {
 *     const body = await c.req.parseBody()
 *     if (body['file'] instanceof File) {
 *       console.log(`Got file sized: ${body['file'].size}`)
 *     }
 *     return c.text('pass :)')
 *   }
 * )
 * ```
 */
declare const bodyLimit: (options: BodyLimitOptions) => MiddlewareHandler;
//#endregion
export { bodyLimit };