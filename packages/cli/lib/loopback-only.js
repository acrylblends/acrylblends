import { t as connectionOf } from "./connection-C7xgP1hP.js";
import { BlockList, isIP } from "node:net";
//#region ../../plugins/acryl-router/src/middleware/loopback-only.ts
const loopback = new BlockList();
loopback.addSubnet("127.0.0.0", 8, "ipv4");
loopback.addSubnet("::1", 128, "ipv6");
const SAFE_METHODS = /* @__PURE__ */ new Set([
	"GET",
	"HEAD",
	"OPTIONS"
]);
/**
* The authority a loopback request addressed: the `Host` header as a URL, or `undefined` when the request does not come from a loopback peer to the
* real local port, names another host, or is marked cross-site by the browser. The peer and the port come from the transport (`connectionOf(c)`), never
* from a header; an in-process call has neither and is refused.
*/
const LOOPBACK_HOSTNAMES = [
	"127.0.0.1",
	"localhost",
	"[::1]"
];
function loopbackAuthority(c, hostnames = LOOPBACK_HOSTNAMES) {
	const { remoteAddress, localPort } = connectionOf(c);
	const host = c.req.header("host");
	if (remoteAddress === void 0 || localPort === void 0 || host === void 0) return void 0;
	const address = (remoteAddress.replace(/^\[|\]$/gu, "").split("%", 1)[0] ?? "").replace(/^::ffff:/iu, "");
	const family = isIP(address);
	if (family === 0 || !loopback.check(address, family === 4 ? "ipv4" : "ipv6")) return void 0;
	let authority;
	try {
		authority = new URL(`http://${host}`);
	} catch {
		return;
	}
	if (authority.protocol !== "http:" || Number(authority.port || "80") !== localPort || !hostnames.includes(authority.hostname) || c.req.header("sec-fetch-site") === "cross-site") return void 0;
	return authority;
}
/** Whether a changing request is acceptable by its `Origin`: absent (not a browser cross-origin change) or naming this same authority. `null` and any other origin are not. */
function sameOrigin(c, authority) {
	const origin = c.req.header("origin");
	if (origin === void 0) return true;
	try {
		const parsed = new URL(origin);
		return parsed.protocol === "http:" && parsed.host === authority.host && parsed.pathname === "/";
	} catch {
		return false;
	}
}
function originOf(value) {
	if (value === void 0) return void 0;
	try {
		return new URL(value).origin;
	} catch {
		return;
	}
}
/** Whether the request comes from a page served by this authority itself: the `own-page` rule of {@link LoopbackOptions.callers}. */
function fromOwnPage(c, authority) {
	const origin = c.req.header("origin");
	const fetchSite = c.req.header("sec-fetch-site");
	if (origin !== void 0 && originOf(origin) === origin && origin === authority.origin) return fetchSite === void 0 || fetchSite === "same-origin";
	return SAFE_METHODS.has(c.req.method) && fetchSite === "same-origin" && originOf(c.req.header("referer")) === authority.origin;
}
/**
* Only requests from this machine to this app: loopback peer, the real port, an allowed `Host`, and for mutations a matching `Origin` (with
* `callers: 'own-page'`, every request from this app's own page). Everything else gets a 403.
*/
function loopbackOnly(options = {}) {
	const mutations = options.mutations ?? "same-origin";
	const inProcess = options.inProcess ?? "deny";
	const ownPage = options.callers === "own-page";
	return async (c, next) => {
		const connection = connectionOf(c);
		if (inProcess === "allow" && connection.remoteAddress === void 0 && connection.localPort === void 0) {
			await next();
			return;
		}
		const authority = loopbackAuthority(c, options.hostnames);
		if (authority === void 0) return c.json({ error: "request authority rejected" }, 403);
		if (ownPage) {
			if (!fromOwnPage(c, authority)) return c.json({ error: "only this app's own page may call this" }, 403);
			await next();
			return;
		}
		if (mutations === "same-origin" && !SAFE_METHODS.has(c.req.method) && !sameOrigin(c, authority)) return c.json({ error: "a change must come from this app's own origin" }, 403);
		await next();
	};
}
//#endregion
export { LOOPBACK_HOSTNAMES, fromOwnPage, loopbackAuthority, loopbackOnly, sameOrigin };
