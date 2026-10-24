import { isIP } from "node:net";
//#region ../../plugins/acryl-router/src/connection.ts
/**
* Transport facts: who is on the other end of the socket and which local port it reached. The caller of `router.fetch` supplies them
* (an HTTP adapter passes the socket's peer address and real port); they travel in `c.env.connection`, beside the request and never in a header.
*/
const NONE = Object.freeze({});
/** The transport facts of this request; empty for an in-process call or an `Acryl` run outside the router. */
function connectionOf(c) {
	return c.env?.connection ?? NONE;
}
/** The peer in the core's conninfo shape, for middleware written against it (for example `ipRestriction`). */
const getConnInfo = (c) => {
	const { remoteAddress } = connectionOf(c);
	if (remoteAddress === void 0) return { remote: {} };
	const family = isIP(remoteAddress.replace(/^\[|\]$/gu, ""));
	return { remote: {
		transport: "tcp",
		address: remoteAddress,
		addressType: family === 6 ? "IPv6" : family === 4 ? "IPv4" : void 0
	} };
};
//#endregion
export { getConnInfo as n, connectionOf as t };
