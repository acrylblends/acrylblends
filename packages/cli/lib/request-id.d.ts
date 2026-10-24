import { I as MiddlewareHandler, t as Context } from "./context-Bm7rI-oK.js";

//#region ../../plugins/acryl-router/src/core/middleware/request-id/request-id.d.ts
type RequestIdVariables = {
  requestId: string;
};
type RequestIdOptions = {
  limitLength?: number;
  headerName?: string;
  generator?: (c: Context) => string;
};
/**
 * Request ID Middleware for Acryl.
 *
 * @param {object} options - Options for Request ID middleware.
 * @param {number} [options.limitLength=255] - The maximum length of request id.
 * @param {string} [options.headerName=X-Request-Id] - The header name used in request id.
 * @param {generator} [options.generator=() => crypto.randomUUID()] - The request id generation function.
 *
 * @returns {MiddlewareHandler} The middleware handler function.
 *
 * @example
 * ```ts
 * type Variables = RequestIdVariables
 * const app = new Acryl<{Variables: Variables}>()
 *
 * app.use(requestId())
 * app.get('/', (c) => {
 *   console.log(c.get('requestId')) // Debug
 *   return c.text('Hello World!')
 * })
 * ```
 */
declare const requestId: ({
  limitLength,
  headerName,
  generator
}?: RequestIdOptions) => MiddlewareHandler;
//#endregion
//#region ../../plugins/acryl-router/src/core/middleware/request-id/index.d.ts
declare module '../../context.ts' {
  interface ContextVariableMap extends RequestIdVariables {}
}
//#endregion
export { type RequestIdVariables, requestId };