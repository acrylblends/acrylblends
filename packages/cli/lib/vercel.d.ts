import { r as GetConnInfo } from "./types-Dv_nV2cv.js";
import { t as Acryl } from "./app-D8riatvv.js";

//#region ../../plugins/acryl-router/src/core/adapter/vercel/handler.d.ts
declare const handle: (app: Acryl<any, any, any>) => (req: Request) => Response | Promise<Response>;
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/vercel/conninfo.d.ts
declare const getConnInfo: GetConnInfo;
//#endregion
export { getConnInfo, handle };