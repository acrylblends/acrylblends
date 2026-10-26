import { t as serveStatic$1 } from "./serve-static-Cp5adzGo.js";
import { c as toSSG$1 } from "./ssg-BwjcA-Ge.js";
import { WSContext, createWSMessageEvent, defineWebSocketHelper } from "./ws.js";
import { stat } from "node:fs/promises";
import { join } from "node:path";
//#region ../../plugins/acryl-router/src/core/adapter/bun/serve-static.ts
const serveStatic = (options = {}) => {
	return async function serveStatic(c, next) {
		const getContent = async (path) => {
			const file = Bun.file(path);
			return await file.exists() ? file : null;
		};
		const isDir = async (path) => {
			let isDir;
			try {
				isDir = (await stat(path)).isDirectory();
			} catch {}
			return isDir;
		};
		return serveStatic$1({
			...options,
			getContent,
			join,
			isDir
		})(c, next);
	};
};
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/bun/ssg.ts
/**
* @experimental
* `bunFileSystemModule` is an experimental feature.
* The API might be changed.
*/
const bunFileSystemModule = {
	writeFile: async (path, data) => {
		await Bun.write(path, data);
	},
	mkdir: async () => {}
};
/**
* @experimental
* `toSSG` is an experimental feature.
* The API might be changed.
*/
const toSSG = async (app, options) => {
	return toSSG$1(app, bunFileSystemModule, options);
};
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/bun/server.ts
/**
* Get Bun Server Object from Context
* @template T - The type of Bun Server
* @param c Context
* @returns Bun Server
*/
const getBunServer = (c) => "server" in c.env ? c.env.server : c.env;
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/bun/websocket.ts
/**
* @internal
*/
const createWSContext = (ws) => {
	return new WSContext({
		send: (source, options) => {
			ws.send(source, options?.compress);
		},
		raw: ws,
		readyState: ws.readyState,
		url: ws.data.url,
		protocol: ws.data.protocol,
		close(code, reason) {
			ws.close(code, reason);
		}
	});
};
const upgradeWebSocket = defineWebSocketHelper((c, events) => {
	const server = getBunServer(c);
	if (!server) throw new TypeError("env has to include the 2nd argument of fetch.");
	if (server.upgrade(c.req.raw, { data: {
		events,
		url: new URL(c.req.url),
		protocol: c.req.header("sec-websocket-protocol")?.split(",")[0]?.trim() ?? ""
	} })) return new Response(null);
});
const websocket = {
	open(ws) {
		const websocketListeners = ws.data.events;
		if (websocketListeners.onOpen) websocketListeners.onOpen(new Event("open"), createWSContext(ws));
	},
	close(ws, code, reason) {
		const websocketListeners = ws.data.events;
		if (websocketListeners.onClose) websocketListeners.onClose(new CloseEvent("close", {
			code,
			reason
		}), createWSContext(ws));
	},
	message(ws, message) {
		const websocketListeners = ws.data.events;
		if (websocketListeners.onMessage) {
			const normalizedReceiveData = typeof message === "string" ? message : message.buffer;
			websocketListeners.onMessage(createWSMessageEvent(normalizedReceiveData), createWSContext(ws));
		}
	}
};
/**
* @deprecated Import `upgradeWebSocket` and `websocket` directly from `acryl-router/bun` instead.
* @returns A function to create a Bun WebSocket handler.
*/
const createBunWebSocket = () => ({
	upgradeWebSocket,
	websocket
});
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/bun/conninfo.ts
/**
* Get ConnInfo with Bun
* @param c Context
* @returns ConnInfo
*/
const getConnInfo = (c) => {
	const server = getBunServer(c);
	if (!server) throw new TypeError("env has to include the 2nd argument of fetch.");
	if (typeof server.requestIP !== "function") throw new TypeError("server.requestIP is not a function.");
	const info = server.requestIP(c.req.raw);
	if (!info) return { remote: {} };
	return { remote: {
		address: info.address,
		addressType: info.family === "IPv6" || info.family === "IPv4" ? info.family : void 0,
		port: info.port
	} };
};
//#endregion
export { bunFileSystemModule, createBunWebSocket, getBunServer, getConnInfo, serveStatic, toSSG, upgradeWebSocket, websocket };
