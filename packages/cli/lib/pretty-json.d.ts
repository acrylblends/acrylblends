import { L as MiddlewareHandler } from "./context-DS3fYyG-.js";

//#region ../../plugins/acryl-router/src/core/middleware/pretty-json/index.d.ts
interface PrettyOptions {
  /**
   * Number of spaces for indentation.
   * @default 2
   */
  space?: number;
  /**
   * Query conditions for when to Pretty.
   * @default 'pretty'
   */
  query?: string;
  /**
   * Force prettification of JSON responses regardless of query parameters.
   * @default false
   */
  force?: boolean;
}
/**
 * Pretty JSON Middleware for Acryl.
 *
 *
 * @param options - The options for the pretty JSON middleware.
 * @returns {MiddlewareHandler} The middleware handler function.
 *
 * @example
 * ```ts
 * const app = new Acryl()
 *
 * app.use(prettyJSON()) // With options: prettyJSON({ space: 4 })
 * app.get('/', (c) => {
 *   return c.json({ message: 'Acryl!' })
 * })
 * ```
 */
declare const prettyJSON: (options?: PrettyOptions) => MiddlewareHandler;
//#endregion
export { prettyJSON };