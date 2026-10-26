import { L as MiddlewareHandler, t as Context, v as Env } from "./context-DS3fYyG-.js";
import { r as GetConnInfo } from "./types-Dv_nV2cv.js";
import { f as FileSystemModule, m as ToSSGAdaptorInterface } from "./index-DaJtL7ci.js";
import { a as WSEvents, n as UpgradeWebSocket } from "./index-BvFh1Gfx.js";
import { t as ServeStaticOptions } from "./index-CseujaYI.js";

//#region ../../plugins/acryl-router/src/core/adapter/bun/serve-static.d.ts
declare const serveStatic: <E extends Env = Env>(options?: ServeStaticOptions<E>) => MiddlewareHandler;
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/bun/ssg.d.ts
/**
 * @experimental
 * `bunFileSystemModule` is an experimental feature.
 * The API might be changed.
 */
declare const bunFileSystemModule: FileSystemModule;
/**
 * @experimental
 * `toSSG` is an experimental feature.
 * The API might be changed.
 */
declare const toSSG: ToSSGAdaptorInterface;
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/bun/websocket.d.ts
/**
 * @internal
 */
interface BunServerWebSocket<T> {
  send(data: string | ArrayBuffer | Uint8Array, compress?: boolean): void;
  close(code?: number, reason?: string): void;
  data: T;
  readyState: 0 | 1 | 2 | 3;
}
interface BunWebSocketHandler<T> {
  open(ws: BunServerWebSocket<T>): void;
  close(ws: BunServerWebSocket<T>, code?: number, reason?: string): void;
  message(ws: BunServerWebSocket<T>, message: string | {
    buffer: ArrayBufferLike;
  }): void;
}
interface CreateWebSocket<T> {
  upgradeWebSocket: UpgradeWebSocket<T>;
  websocket: BunWebSocketHandler<BunWebSocketData>;
}
interface BunWebSocketData {
  events: WSEvents;
  url: URL;
  protocol: string;
}
declare const upgradeWebSocket: UpgradeWebSocket<any>;
declare const websocket: BunWebSocketHandler<BunWebSocketData>;
/**
 * @deprecated Import `upgradeWebSocket` and `websocket` directly from `acryl-router/bun` instead.
 * @returns A function to create a Bun WebSocket handler.
 */
declare const createBunWebSocket: <T>() => CreateWebSocket<T>;
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/bun/conninfo.d.ts
/**
 * Get ConnInfo with Bun
 * @param c Context
 * @returns ConnInfo
 */
declare const getConnInfo: GetConnInfo;
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/bun/server.d.ts
/**
 * Get Bun Server Object from Context
 * @template T - The type of Bun Server
 * @param c Context
 * @returns Bun Server
 */
declare const getBunServer: <T>(c: Context) => T | undefined;
//#endregion
export { type BunWebSocketData, type BunWebSocketHandler, bunFileSystemModule, createBunWebSocket, getBunServer, getConnInfo, serveStatic, toSSG, upgradeWebSocket, websocket };