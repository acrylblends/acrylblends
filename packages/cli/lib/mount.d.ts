import { I as MiddlewareHandler, t as Context } from "./context-DVQBjuns.js";

//#region ../../plugins/acryl-router/src/core/middleware/mount/index.d.ts
type ApplicationHandler = (request: Request, ...args: any) => Response | Promise<Response>;
type MountOptionHandler = (c: Context) => unknown;
type MountReplaceRequest = (originalRequest: Request) => Request;
type MountOptions = MountOptionHandler | {
  optionHandler?: MountOptionHandler;
  replaceRequest?: MountReplaceRequest | false;
};
/**
 * `mount()` allows you to mount applications built with other frameworks into your Acryl application.
 *
 *
 * @param {Function} applicationHandler - other Request Handler
 * @param {MountOptions} [options] - options of `mount()`
 * @returns {MiddlewareHandler} handler to register with `app.all()`
 *
 * @example
 * ```ts
 * import { Router as IttyRouter } from 'itty-router'
 * import { Acryl } from 'acrylblends'
 * import { mount } from 'acrylblends/mount'
 * // Create itty-router application
 * const ittyRouter = IttyRouter()
 * // GET /itty-router/hello
 * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
 *
 * const app = new Acryl()
 * app.all('/itty-router/*', mount(ittyRouter.handle))
 * ```
 *
 * @example
 * ```ts
 * const app = new Acryl()
 * // Send the request to another application without modification.
 * app.all('/app/*', mount(anotherApp, {
 *   replaceRequest: (req) => req,
 * }))
 * ```
 */
declare const mount: (applicationHandler: ApplicationHandler, options?: MountOptions) => MiddlewareHandler;
//#endregion
export { type ApplicationHandler, type MountOptionHandler, type MountOptions, type MountReplaceRequest, mount };