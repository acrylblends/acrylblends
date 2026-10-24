import { t as Context } from "./context-Bm7rI-oK.js";
import { i as NetAddrInfo, n as ConnInfo, r as GetConnInfo, t as AddressType } from "./types-CDO6I3B0.js";

//#region ../../plugins/acryl-router/src/connection.d.ts
/** An in-process caller (the terminal UI, a test) passes nothing, so a handler that needs a trusted peer must refuse an empty one. */
interface ConnectionInfo {
  /** The peer address of the socket, when the request came over one (for example `127.0.0.1`). */
  readonly remoteAddress?: string | undefined;
  /** The local port the socket is connected to, the real one a `Host` header should be checked against. */
  readonly localPort?: number | undefined;
}
/** What the router puts in `c.env`. */
interface RouterBindings {
  readonly connection: ConnectionInfo;
}
/** The `Env` of an `Acryl` that wants `c.env.connection` typed: `new Acryl<RouterEnv>()`. */
interface RouterEnv {
  Bindings: RouterBindings;
}
/** The transport facts of this request; empty for an in-process call or an `Acryl` run outside the router. */
declare function connectionOf(c: Context): ConnectionInfo;
/** The peer in the core's conninfo shape, for middleware written against it (for example `ipRestriction`). */
declare const getConnInfo: GetConnInfo;
//#endregion
export { type AddressType, type ConnInfo, type ConnectionInfo, type GetConnInfo, type NetAddrInfo, type RouterBindings, type RouterEnv, connectionOf, getConnInfo };