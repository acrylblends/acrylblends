import { HtmlEscapedCallbackPhase, resolveCallback } from "./utils/html.js";
import { n as TEXT_PLAIN } from "./context-DDO0cfuP.js";
import { StreamingApi } from "./utils/stream.js";
//#region ../../plugins/acryl-router/src/core/helper/streaming/utils.ts
let isOldBunVersion = () => {
	const version = typeof Bun !== "undefined" ? Bun.version : void 0;
	if (version === void 0) return false;
	const result = version.startsWith("1.1") || version.startsWith("1.0") || version.startsWith("0.");
	isOldBunVersion = () => result;
	return result;
};
//#endregion
//#region ../../plugins/acryl-router/src/core/helper/streaming/stream.ts
const contextStash$1 = /* @__PURE__ */ new WeakMap();
const stream = (c, cb, onError) => {
	const { readable, writable } = new TransformStream();
	const stream = new StreamingApi(writable, readable);
	if (isOldBunVersion()) c.req.raw.signal.addEventListener("abort", () => {
		if (!stream.closed) stream.abort();
	});
	contextStash$1.set(stream.responseReadable, c);
	(async () => {
		try {
			await cb(stream);
		} catch (e) {
			if (e === void 0) {} else if (e instanceof Error && onError) await onError(e, stream);
			else console.error(e);
		} finally {
			stream.close();
		}
	})();
	return c.newResponse(stream.responseReadable);
};
//#endregion
//#region ../../plugins/acryl-router/src/core/helper/streaming/sse.ts
var SSEStreamingApi = class extends StreamingApi {
	constructor(writable, readable) {
		super(writable, readable);
	}
	async writeSSE(message) {
		const dataLines = (await resolveCallback(message.data, HtmlEscapedCallbackPhase.Stringify, false, {})).split(/\r\n|\r|\n/).map((line) => {
			return `data: ${line}`;
		}).join("\n");
		for (const key of ["event", "id"]) {
			const value = message[key];
			if (value && /[\r\n]/.test(value)) throw new Error(`${key} must not contain "\\r" or "\\n"`);
		}
		const sseData = [
			message.event && `event: ${message.event}`,
			dataLines,
			message.id !== void 0 && `id: ${message.id}`,
			message.retry !== void 0 && `retry: ${message.retry}`
		].filter(Boolean).join("\n") + "\n\n";
		await this.write(sseData);
	}
};
const run = async (stream, cb, onError) => {
	try {
		await cb(stream);
	} catch (e) {
		if (e instanceof Error && onError) {
			await onError(e, stream);
			await stream.writeSSE({
				event: "error",
				data: e.message
			});
		} else console.error(e);
	} finally {
		stream.close();
	}
};
const contextStash = /* @__PURE__ */ new WeakMap();
const streamSSE = (c, cb, onError) => {
	const { readable, writable } = new TransformStream();
	const stream = new SSEStreamingApi(writable, readable);
	if (isOldBunVersion()) c.req.raw.signal.addEventListener("abort", () => {
		if (!stream.closed) stream.abort();
	});
	contextStash.set(stream.responseReadable, c);
	c.header("Transfer-Encoding", "chunked");
	c.header("Content-Type", "text/event-stream");
	c.header("Cache-Control", "no-cache");
	c.header("Connection", "keep-alive");
	run(stream, cb, onError);
	return c.newResponse(stream.responseReadable);
};
//#endregion
//#region ../../plugins/acryl-router/src/core/helper/streaming/text.ts
const streamText = (c, cb, onError) => {
	c.header("Content-Type", TEXT_PLAIN);
	c.header("X-Content-Type-Options", "nosniff");
	c.header("Transfer-Encoding", "chunked");
	return stream(c, cb, onError);
};
//#endregion
export { stream as i, SSEStreamingApi as n, streamSSE as r, streamText as t };
