import { I as MiddlewareHandler, t as Context } from "./context-DVQBjuns.js";
import { HTTPException } from "./http-exception.js";

//#region ../../plugins/acryl-router/src/core/middleware/timeout/index.d.ts
type HTTPExceptionFunction = (context: Context) => HTTPException;
/**
 * Timeout Middleware for Acryl.
 *
 * @param {number} duration - The timeout duration in milliseconds.
 * @param {HTTPExceptionFunction | HTTPException} [exception=defaultTimeoutException] - The exception to throw when the timeout occurs. Can be a function that returns an HTTPException or an HTTPException object.
 * @returns {MiddlewareHandler} The middleware handler function.
 *
 * @example
 * ```ts
 * const app = new Acryl()
 *
 * app.use(
 *   '/long-request',
 *   timeout(5000) // Set timeout to 5 seconds
 * )
 *
 * app.get('/long-request', async (c) => {
 *   await someLongRunningFunction()
 *   return c.text('Completed within time limit')
 * })
 * ```
 */
declare const timeout: (duration: number, exception?: HTTPExceptionFunction | HTTPException) => MiddlewareHandler;
//#endregion
export { HTTPExceptionFunction, timeout };