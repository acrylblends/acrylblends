import { I as MiddlewareHandler, t as Context } from "./context-Bm7rI-oK.js";

//#region ../../plugins/acryl-router/src/middleware/loopback-only.d.ts
interface LoopbackOptions {
  /** Hostnames a `Host` header may name. Default: the loopback names `127.0.0.1`, `localhost` and `[::1]`. */
  readonly hostnames?: readonly string[];
  /**
   * What a request that changes things (not GET, HEAD or OPTIONS) must show: `same-origin` (default) refuses an `Origin` header that is not this same
   * authority (including `null`), which stops another web page from driving a local app. A browser always sends `Origin` on a cross-origin change, so a
   * request with no `Origin` (curl, a script) is allowed: the `Host` it names is already checked to be a loopback address with this server's port, which
   * is what stops DNS rebinding. `none` checks only the peer and the `Host`.
   */
  readonly mutations?: 'same-origin' | 'none';
  /**
   * A call made inside the process (the terminal UI, a test) has no socket, so no peer to check. `deny` (default) refuses it, the safe choice for a route
   * that guards something; `allow` lets it through for routes whose in-process caller is the host's own code. A request that came over a socket is always
   * checked in full: only a call with no connection facts at all counts as in process.
   */
  readonly inProcess?: 'deny' | 'allow';
  /**
   * Who may call. `local` (default): any program on this machine, a browser page only as `mutations` allows. `own-page`: only this app's own page,
   * for private routes a script on the machine must not drive or read either. A request then shows an `Origin` that is exactly this authority (with
   * `Sec-Fetch-Site` absent or `same-origin`), or, for a read (GET, HEAD, OPTIONS), which browsers often send without `Origin`, `Sec-Fetch-Site:
   * same-origin` and a `Referer` from this authority. `mutations` is not consulted: every request is held to that rule.
   */
  readonly callers?: 'local' | 'own-page';
}
/**
 * The authority a loopback request addressed: the `Host` header as a URL, or `undefined` when the request does not come from a loopback peer to the
 * real local port, names another host, or is marked cross-site by the browser. The peer and the port come from the transport (`connectionOf(c)`), never
 * from a header; an in-process call has neither and is refused.
 */
declare const LOOPBACK_HOSTNAMES: readonly string[];
declare function loopbackAuthority(c: Context, hostnames?: readonly string[]): URL | undefined;
/** Whether a changing request is acceptable by its `Origin`: absent (not a browser cross-origin change) or naming this same authority. `null` and any other origin are not. */
declare function sameOrigin(c: Context, authority: URL): boolean;
/** Whether the request comes from a page served by this authority itself: the `own-page` rule of {@link LoopbackOptions.callers}. */
declare function fromOwnPage(c: Context, authority: URL): boolean;
/**
 * Only requests from this machine to this app: loopback peer, the real port, an allowed `Host`, and for mutations a matching `Origin` (with
 * `callers: 'own-page'`, every request from this app's own page). Everything else gets a 403.
 */
declare function loopbackOnly(options?: LoopbackOptions): MiddlewareHandler;
//#endregion
export { LOOPBACK_HOSTNAMES, LoopbackOptions, fromOwnPage, loopbackAuthority, loopbackOnly, sameOrigin };