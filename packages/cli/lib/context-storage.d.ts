import { I as MiddlewareHandler, _ as Env, t as Context } from "./context-DVQBjuns.js";

//#region ../../plugins/acryl-router/src/core/middleware/context-storage/index.d.ts
/**
 * Context Storage Middleware for Acryl.
 *
 *
 * @returns {MiddlewareHandler} The middleware handler function.
 *
 * @example
 * ```ts
 * type Env = {
 *   Variables: {
 *     message: string
 *   }
 * }
 *
 * const app = new Acryl<Env>()
 *
 * app.use(contextStorage())
 *
 * app.use(async (c, next) => {
 *   c.set('message', 'Acryl is hot!!')
 *   await next()
 * })
 *
 * app.get('/', async (c) => c.text(getMessage()))
 *
 * const getMessage = () => {
 *   return getContext<Env>().var.message
 * }
 * ```
 */
declare const contextStorage: () => MiddlewareHandler;
declare const tryGetContext: <E extends Env = Env>() => Context<E> | undefined;
declare const getContext: <E extends Env = Env>() => Context<E>;
//#endregion
export { contextStorage, getContext, tryGetContext };