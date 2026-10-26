import { r as GetConnInfo } from "./types-Dv_nV2cv.js";
import { t as Acryl } from "./app-D8riatvv.js";

//#region ../../plugins/acryl-router/src/core/adapter/netlify/handler.d.ts
declare const handle: (app: Acryl<any, any>) => ((req: Request, context: any) => Response | Promise<Response>);
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/netlify/conninfo.d.ts
/**
 * Get connection information from Netlify
 * @param c - Context
 * @returns Connection information including remote address
 * @example
 * ```ts
 * import { Acryl } from 'acrylblends'
 * import { handle, getConnInfo } from 'acrylblends/netlify'
 *
 * const app = new Acryl()
 *
 * app.get('/', (c) => {
 *   const info = getConnInfo(c)
 *   return c.text(`Your IP: ${info.remote.address}`)
 * })
 *
 * export default handle(app)
 * ```
 */
declare const getConnInfo: GetConnInfo;
//#endregion
export { getConnInfo, handle };