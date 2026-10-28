import { L as MiddlewareHandler, v as Env } from "./context-DS3fYyG-.js";
import { r as GetConnInfo } from "./types-Dv_nV2cv.js";
import { a as WSEvents, n as UpgradeWebSocket } from "./index-C-SklY6u.js";
import { t as ServeStaticOptions$1 } from "./index-CseujaYI.js";

//#region ../../plugins/acryl-router/src/core/adapter/cloudflare-workers/serve-static.d.ts
type ServeStaticOptions<E extends Env = Env> = ServeStaticOptions$1<E> & {
  namespace?: unknown;
  manifest?: object | string;
};
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/cloudflare-workers/serve-static-module.d.ts
declare const module: <E extends Env = Env>(options: Omit<ServeStaticOptions<E>, "namespace">) => MiddlewareHandler;
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/cloudflare-workers/websocket.d.ts
declare const upgradeWebSocket: UpgradeWebSocket<WebSocket, any, Omit<WSEvents<WebSocket>, 'onOpen'>>;
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/cloudflare-workers/conninfo.d.ts
declare const getConnInfo: GetConnInfo;
//#endregion
export { getConnInfo, module as serveStatic, upgradeWebSocket };