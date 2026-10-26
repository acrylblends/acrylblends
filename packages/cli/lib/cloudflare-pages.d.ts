import { L as MiddlewareHandler, Y as Schema, g as BlankSchema, j as Input, v as Env } from "./context-DS3fYyG-.js";
import { r as GetConnInfo } from "./types-Dv_nV2cv.js";
import { t as Acryl } from "./app-D8riatvv.js";

//#region ../../plugins/acryl-router/src/core/adapter/cloudflare-pages/handler.d.ts
type Params<P extends string = any> = Record<P, string | string[]>;
type EventContext<Env = {}, P extends string = any, Data = Record<string, unknown>> = {
  request: Request;
  functionPath: string;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
  props: any;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: Env & {
    ASSETS: {
      fetch: typeof fetch;
    };
  };
  params: Params<P>;
  data: Data;
};
declare type PagesFunction<Env = unknown, Params extends string = any, Data extends Record<string, unknown> = Record<string, unknown>> = (context: EventContext<Env, Params, Data>) => Response | Promise<Response>;
declare const handle: <E extends Env = Env, S extends Schema = BlankSchema, BasePath extends string = "/">(app: Acryl<E, S, BasePath>) => PagesFunction<E["Bindings"]>;
declare function handleMiddleware<E extends Env = {}, P extends string = any, I extends Input = {}>(middleware: MiddlewareHandler<E & {
  Bindings: {
    eventContext: EventContext;
  };
}, P, I>): PagesFunction<E['Bindings']>;
/**
 *
 * @description `serveStatic()` is for advanced mode:
 * https://developers.cloudflare.com/pages/platform/functions/advanced-mode/#set-up-a-function
 */
declare const serveStatic: () => MiddlewareHandler;
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/cloudflare-pages/conninfo.d.ts
/**
 * Get connection information from Cloudflare Pages
 * @param c - Context
 * @returns Connection information including remote address
 * @example
 * ```ts
 * import { Acryl } from 'acrylblends'
 * import { handle, getConnInfo } from 'acrylblends/cloudflare-pages'
 *
 * const app = new Acryl()
 *
 * app.get('/', (c) => {
 *   const info = getConnInfo(c)
 *   return c.text(`Your IP: ${info.remote.address}`)
 * })
 *
 * export const onRequest = handle(app)
 * ```
 */
declare const getConnInfo: GetConnInfo;
//#endregion
export { type EventContext, getConnInfo, handle, handleMiddleware, serveStatic };