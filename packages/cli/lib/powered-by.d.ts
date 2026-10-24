import { I as MiddlewareHandler } from "./context-Bm7rI-oK.js";

//#region ../../plugins/acryl-router/src/core/middleware/powered-by/index.d.ts
type PoweredByOptions = {
  /**
   * The value for X-Powered-By header.
   * @default Acryl
   */
  serverName?: string;
};
/**
 * Powered By Middleware for Acryl.
 *
 * @param options - The options for the Powered By Middleware.
 * @returns {MiddlewareHandler} The middleware handler function.
 *
 * @example
 * ```ts
 * import { poweredBy } from 'acrylblends/powered-by'
 *
 * const app = new Acryl()
 *
 * app.use(poweredBy()) // With options: poweredBy({ serverName: "My Server" })
 * ```
 */
declare const poweredBy: (options?: PoweredByOptions) => MiddlewareHandler;
//#endregion
export { poweredBy };