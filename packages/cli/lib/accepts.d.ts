import { t as Context } from "./context-DVQBjuns.js";
import { t as AcceptHeader } from "./headers-tu2YYN8T.js";

//#region ../../plugins/acryl-router/src/core/helper/accepts/accepts.d.ts
interface Accept {
  type: string;
  params: Record<string, string>;
  q: number;
}
interface acceptsConfig {
  header: AcceptHeader;
  supports: string[];
  default: string;
}
interface acceptsOptions extends acceptsConfig {
  match?: (accepts: Accept[], config: acceptsConfig) => string;
}
/**
 * Match the accept header with the given options.
 * @example
 * ```ts
 * app.get('/users', (c) => {
 *   const lang = accepts(c, {
 *     header: 'Accept-Language',
 *     supports: ['en', 'zh'],
 *     default: 'en',
 *   })
 * })
 * ```
 */
declare const accepts: (c: Context, options: acceptsOptions) => string;
//#endregion
export { accepts };