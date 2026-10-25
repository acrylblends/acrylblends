import { I as MiddlewareHandler } from "./context-DVQBjuns.js";
import { t as Acryl } from "./app-wFwpg-bt.js";

//#region ../../plugins/acryl-router/src/core/middleware/method-override/index.d.ts
type MethodOverrideOptions = {
  app: Acryl<any, any, any>;
} & ({
  form?: string;
  header?: never;
  query?: never;
} | {
  form?: never;
  header: string;
  query?: never;
} | {
  form?: never;
  header?: never;
  query: string;
});
/**
 * Method Override Middleware for Acryl.
 *
 *
 * @param {MethodOverrideOptions} options - The options for the method override middleware.
 * @param {Acryl} options.app - The instance of Acryl is used in your application.
 * @param {string} [options.form=_method] - Form key with a value containing the method name.
 * @param {string} [options.header] - Header name with a value containing the method name.
 * @param {string} [options.query] - Query parameter key with a value containing the method name.
 * @returns {MiddlewareHandler} The middleware handler function.
 *
 * @example
 * ```ts
 * const app = new Acryl()
 *
 * // If no options are specified, the value of `_method` in the form,
 * // e.g. DELETE, is used as the method.
 * app.use('/posts', methodOverride({ app }))
 *
 * app.delete('/posts', (c) => {
 *   // ....
 * })
 * ```
 */
declare const methodOverride: (options: MethodOverrideOptions) => MiddlewareHandler;
//#endregion
export { methodOverride };