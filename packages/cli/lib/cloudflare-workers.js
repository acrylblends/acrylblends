import { t as serveStatic$1 } from "./serve-static-Cp5adzGo.js";
import { WSContext, defineWebSocketHelper } from "./ws.js";
//#region ../../plugins/acryl-router/src/core/adapter/cloudflare-workers/utils.ts
const getContentFromKVAsset = async (path, options) => {
	let ASSET_MANIFEST;
	if (options && options.manifest) if (typeof options.manifest === "string") ASSET_MANIFEST = JSON.parse(options.manifest);
	else ASSET_MANIFEST = options.manifest;
	else if (typeof __STATIC_CONTENT_MANIFEST === "string") ASSET_MANIFEST = JSON.parse(__STATIC_CONTENT_MANIFEST);
	else ASSET_MANIFEST = __STATIC_CONTENT_MANIFEST;
	let ASSET_NAMESPACE;
	if (options && options.namespace) ASSET_NAMESPACE = options.namespace;
	else ASSET_NAMESPACE = __STATIC_CONTENT;
	const key = ASSET_MANIFEST[path];
	if (!key) return null;
	const content = await ASSET_NAMESPACE.get(key, { type: "stream" });
	if (!content) return null;
	return content;
};
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/cloudflare-workers/serve-static.ts
/**
* @deprecated
* `serveStatic` in the Cloudflare Workers adapter is deprecated.
* You can serve static files directly using Cloudflare Static Assets.
* @see https://developers.cloudflare.com/workers/static-assets/
* Cloudflare Static Assets is currently in open beta. If this doesn't work for you,
* please consider using Cloudflare Pages.
*/
const serveStatic = (options = {}) => {
	return async function serveStatic(c, next) {
		const getContent = async (path) => {
			return getContentFromKVAsset(path, {
				manifest: options.manifest,
				namespace: options.namespace ? options.namespace : c.env ? c.env.__STATIC_CONTENT : void 0
			});
		};
		return serveStatic$1({
			...options,
			getContent
		})(c, next);
	};
};
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/cloudflare-workers/serve-static-module.ts
const module = (options) => {
	return serveStatic(options);
};
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/cloudflare-workers/websocket.ts
const upgradeWebSocket = defineWebSocketHelper(async (c, events) => {
	if (c.req.header("Upgrade") !== "websocket") return;
	const webSocketPair = new WebSocketPair();
	const client = webSocketPair[0];
	const server = webSocketPair[1];
	const wsContext = new WSContext({
		close: (code, reason) => server.close(code, reason),
		get protocol() {
			return server.protocol;
		},
		raw: server,
		get readyState() {
			return server.readyState;
		},
		url: server.url ? new URL(server.url) : null,
		send: (source) => server.send(source)
	});
	if (events.onClose) server.addEventListener("close", (evt) => events.onClose?.(evt, wsContext));
	if (events.onMessage) server.addEventListener("message", (evt) => events.onMessage?.(evt, wsContext));
	if (events.onError) server.addEventListener("error", (evt) => events.onError?.(evt, wsContext));
	server.accept?.();
	return new Response(null, {
		status: 101,
		webSocket: client
	});
});
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/cloudflare-workers/conninfo.ts
const getConnInfo = (c) => ({ remote: { address: c.req.header("cf-connecting-ip") } });
//#endregion
export { getConnInfo, module as serveStatic, upgradeWebSocket };
