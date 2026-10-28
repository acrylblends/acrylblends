import { t as Acryl } from "./app-D8riatvv.js";
import { a as UpgradeRouter, c as WebSocketData, i as UpgradeHubOptions, l as WebSocketLike, n as UpgradeEmitter, o as RequestError, r as UpgradeHub, s as upgradeWebSocket, t as Owner, u as WebSocketServerLike } from "./upgrade-hub-C25yjWG9.js";
import { ServeStaticOptions, serveStatic } from "./node-server/serve-static.js";
import { getConnInfo } from "./node-server/conninfo.js";
import { AddressInfo } from "node:net";
import { IncomingMessage, Server, ServerOptions, ServerResponse, createServer } from "node:http";
import { Http2SecureServer, Http2Server, Http2ServerRequest, Http2ServerResponse, SecureServerOptions, ServerOptions as ServerOptions$1, createSecureServer, createServer as createServer$1 } from "node:http2";
import { Server as Server$1, ServerOptions as ServerOptions$2, createServer as createServer$2 } from "node:https";

//#region ../../plugins/acryl-node-server/src/adapter/types.d.ts
type HttpBindings = {
  incoming: IncomingMessage;
  outgoing: ServerResponse;
};
type Http2Bindings = {
  incoming: Http2ServerRequest;
  outgoing: Http2ServerResponse;
};
type FetchCallback = (request: Request, env: HttpBindings | Http2Bindings) => Promise<unknown> | unknown;
type ServerType = Server | Http2Server | Http2SecureServer;
type createHttpOptions = {
  serverOptions?: ServerOptions;
  createServer?: typeof createServer;
};
type createHttpsOptions = {
  serverOptions?: ServerOptions$2;
  createServer?: typeof createServer$2;
};
type createHttp2Options = {
  serverOptions?: ServerOptions$1;
  createServer?: typeof createServer$1;
};
type createSecureHttp2Options = {
  serverOptions?: SecureServerOptions;
  createServer?: typeof createSecureServer;
};
type ServerOptions$3 = createHttpOptions | createHttpsOptions | createHttp2Options | createSecureHttp2Options;
type BaseOptions = {
  fetch: FetchCallback;
  overrideGlobalObjects?: boolean;
  autoCleanupIncoming?: boolean;
  port?: number; /** The interface to listen on; `serve` uses `127.0.0.1` when it is not given. */
  hostname?: string;
  websocket?: {
    server: WebSocketServerLike;
  };
};
type Options = BaseOptions & ServerOptions$3;
/** Options for the default HTTP/1 server: `serve` and `createAdaptorServer` return an `http.Server`. */
type HttpOptions = BaseOptions & createHttpOptions;
/** Options naming `https.createServer`: an `https.Server`. */
type HttpsOptions = BaseOptions & {
  serverOptions?: ServerOptions$2;
  createServer: typeof createServer$2;
};
/** Options naming `http2.createServer`: an `Http2Server`. */
type Http2Options = BaseOptions & {
  serverOptions?: ServerOptions$1;
  createServer: typeof createServer$1;
};
/** Options naming `http2.createSecureServer`: an `Http2SecureServer`. */
type SecureHttp2Options = BaseOptions & {
  serverOptions?: SecureServerOptions;
  createServer: typeof createSecureServer;
};
type CustomErrorHandler = (err: unknown) => void | Response | Promise<void | Response>;
//#endregion
//#region ../../plugins/acryl-node-server/src/adapter/server.d.ts
declare function createAdaptorServer(options: SecureHttp2Options): Http2SecureServer;
declare function createAdaptorServer(options: Http2Options): Http2Server;
declare function createAdaptorServer(options: HttpsOptions): Server$1;
declare function createAdaptorServer(options: HttpOptions): Server;
declare function createAdaptorServer(options: Options): ServerType;
declare function serve(options: SecureHttp2Options, listeningListener?: (info: AddressInfo) => void): Http2SecureServer;
declare function serve(options: Http2Options, listeningListener?: (info: AddressInfo) => void): Http2Server;
declare function serve(options: HttpsOptions, listeningListener?: (info: AddressInfo) => void): Server$1;
declare function serve(options: HttpOptions, listeningListener?: (info: AddressInfo) => void): Server;
declare function serve(options: Options, listeningListener?: (info: AddressInfo) => void): ServerType;
//#endregion
//#region ../../plugins/acryl-node-server/src/adapter/listener.d.ts
declare const getRequestListener: (fetchCallback: FetchCallback, options?: {
  hostname?: string;
  errorHandler?: CustomErrorHandler;
  overrideGlobalObjects?: boolean;
  autoCleanupIncoming?: boolean;
}) => (incoming: IncomingMessage | Http2ServerRequest, outgoing: ServerResponse | Http2ServerResponse) => Promise<void>;
//#endregion
//#region ../../plugins/acryl-node-server/src/client-modules.d.ts
/** Options of {@link clientModules}. */
interface ClientModulesOptions {
  /** The folder of client modules, absolute or relative to the working directory. */
  readonly root: string;
  /** The folder {@link buildClientModules} wrote; with `NODE_ENV=production` it is served instead of compiling, which needs no `typescript`. */
  readonly compiled?: string | undefined;
  /** At most this many bytes of compiled modules are kept in memory (least recently served first out); 16 MiB when not given. */
  readonly cacheBytes?: number | undefined;
  /** The folder holding `jsx-dom.js`, `client.js` and `read-sse.js`; the framework's own when not given. */
  readonly runtimeDir?: string | undefined;
}
/** Options of {@link buildClientModules}. */
interface BuildClientModulesOptions {
  /** The folder of client modules, absolute or relative to the working directory. */
  readonly root: string;
  /** Where the compiled modules go, at the same relative paths and file names; it must not lie inside `root`. */
  readonly outDir: string;
  /** The folder holding `jsx-dom.js`, `client.js` and `read-sse.js`; the framework's own when not given. */
  readonly runtimeDir?: string | undefined;
}
/**
 * An app serving a folder of client modules to the browser. Route it where the page's script tags point: `app.route('/client',
 * clientModules({ root: 'src/client' }))` serves `src/client/counter.tsx` at `/client/counter.tsx`. Files are compiled on request and
 * cached until they change (bounded by `cacheBytes`); a response carries an ETag and `Cache-Control: no-cache`, so an edit shows on the
 * next reload. With `NODE_ENV=production` and `compiled` set, only the `compiled` folder is served and nothing is compiled.
 * @param options - the folder, the precompiled folder, and the cache bound.
 * @returns the app.
 */
declare function clientModules(options: ClientModulesOptions): Acryl;
/**
 * Compile a folder of client modules once, for a production that has no `typescript`: each module is written to `outDir` at the same
 * relative path and file name (so the page's URLs stay the same), compiled exactly as {@link clientModules} compiles it, and the three
 * browser files are copied to `outDir/@acrylblends/`. Files already in `outDir` that no source produces are left there.
 * @param options - the source folder and the output folder.
 * @returns the paths written, relative to `outDir`.
 * @throws MissingTypeScriptError when the app has no `typescript`; an error when `outDir` lies inside `root`.
 */
declare function buildClientModules(options: BuildClientModulesOptions): string[];
//#endregion
export { type BuildClientModulesOptions, type ClientModulesOptions, type Http2Bindings, type HttpBindings, type Owner, RequestError, type ServeStaticOptions, type ServerType, UpgradeEmitter, UpgradeHub, type UpgradeHubOptions, type UpgradeRouter, type WebSocketData, type WebSocketLike, type WebSocketServerLike, buildClientModules, clientModules, createAdaptorServer, getConnInfo, getRequestListener, serve, serveStatic, upgradeWebSocket };