import { I as MiddlewareHandler, _ as Env, t as Context } from "./context-Bm7rI-oK.js";
import { t as Acryl } from "./app-CmAYW1Al.js";

//#region ../../plugins/acryl-router/src/core/middleware/method-not-allowed/index.d.ts
type MethodNotAllowedHandler<E extends Env> = (c: Context<E>, allowedMethods: string[]) => Response | Promise<Response>;
type MethodNotAllowedOptions<E extends Env> = {
  app: Acryl<E, any, any>;
  onMethodNotAllowed?: MethodNotAllowedHandler<E>;
};
/**
 * Method Not Allowed Middleware for Acryl.
 *
 * Returns a `405 Method Not Allowed` response with an `Allow` header when the request path
 * matches a registered route but the request method is not supported.
 *
 * @param {MethodNotAllowedOptions} options - The options for the middleware.
 * @param {Acryl} options.app - The Acryl instance used by the application.
 * @param {MethodNotAllowedHandler} [options.onMethodNotAllowed] - Generates the response, including its `Allow` header.
 * @returns {MiddlewareHandler} The middleware handler function.
 *
 * @example
 * ```ts
 * const app = new Acryl()
 *
 * app.use(methodNotAllowed({ app }))
 *
 * app.get('/hello', (c) => c.text('Hello!'))
 * app.post('/hello', (c) => c.text('Posted!'))
 *
 * // PUT /hello -> 405 Method Not Allowed
 * // Allow: GET, HEAD, POST
 * ```
 *
 * @example
 * ```ts
 * app.use(
 *   methodNotAllowed({
 *     app,
 *     onMethodNotAllowed: (c, methods) =>
 *       c.json({ error: 'Method Not Allowed' }, 405, { Allow: methods.join(', ') }),
 *   })
 * )
 * ```
 */
declare const methodNotAllowed: <E extends Env = Env>(options: MethodNotAllowedOptions<E>) => MiddlewareHandler<E>;
//#endregion
export { methodNotAllowed };