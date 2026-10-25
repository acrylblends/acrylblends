import { I as MiddlewareHandler } from "./context-B5Y1lLha.js";

//#region ../../plugins/acryl-router/src/core/middleware/logger/index.d.ts
type PrintFunc = (str: string, ...rest: string[]) => void;
/**
 * Logger Middleware for Acryl.
 *
 *
 * @param {PrintFunc} [fn=console.log] - Optional function for customized logging behavior.
 * @returns {MiddlewareHandler} The middleware handler function.
 *
 * @example
 * ```ts
 * const app = new Acryl()
 *
 * app.use(logger())
 * app.get('/', (c) => c.text('Hello Acryl!'))
 * ```
 */
declare const logger: (fn?: PrintFunc) => MiddlewareHandler;
//#endregion
export { logger };