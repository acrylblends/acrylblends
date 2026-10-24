//#region ../../plugins/acryl-router/src/core/middleware/etag/digest.ts
const mergeBuffers = (buffer1, buffer2) => {
	if (!buffer1) return buffer2;
	const merged = new Uint8Array(new ArrayBuffer(buffer1.byteLength + buffer2.byteLength));
	merged.set(new Uint8Array(buffer1), 0);
	merged.set(buffer2, buffer1.byteLength);
	return merged;
};
const CHUNK_SIZE = 256 * 1024;
const generateDigest = async (stream, generator) => {
	if (!stream) return null;
	let result = void 0;
	let chunk;
	let chunkLength = 0;
	const digest = async (body) => {
		result = await generator(mergeBuffers(result, body));
	};
	const reader = stream.getReader();
	for (;;) {
		const { value, done } = await reader.read();
		if (done) break;
		let offset = 0;
		while (offset < value.byteLength) {
			const remaining = value.byteLength - offset;
			if (chunkLength === 0 && remaining >= CHUNK_SIZE) {
				await digest(value.subarray(offset, offset + CHUNK_SIZE));
				offset += CHUNK_SIZE;
				continue;
			}
			const requiredLength = chunkLength + remaining;
			if (requiredLength < CHUNK_SIZE) {
				if (!chunk) chunk = value.slice(offset);
				else {
					if (chunk.byteLength < requiredLength) {
						const nextChunk = new Uint8Array(new ArrayBuffer(Math.min(CHUNK_SIZE, Math.max(requiredLength, chunk.byteLength * 2))));
						nextChunk.set(chunk.subarray(0, chunkLength));
						chunk = nextChunk;
					}
					chunk.set(value.subarray(offset), chunkLength);
				}
				chunkLength = requiredLength;
				break;
			}
			const length = CHUNK_SIZE - chunkLength;
			if (chunk?.byteLength !== CHUNK_SIZE) {
				const nextChunk = new Uint8Array(/* @__PURE__ */ new ArrayBuffer(CHUNK_SIZE));
				if (chunk) nextChunk.set(chunk.subarray(0, chunkLength));
				chunk = nextChunk;
			}
			chunk.set(value.subarray(offset, offset + length), chunkLength);
			await digest(chunk);
			chunkLength = 0;
			offset += length;
		}
	}
	if (chunk && chunkLength > 0) await digest(chunk.subarray(0, chunkLength));
	if (!result) return null;
	return Array.prototype.map.call(new Uint8Array(result), (x) => x.toString(16).padStart(2, "0")).join("");
};
//#endregion
//#region ../../plugins/acryl-router/src/core/middleware/etag/index.ts
/**
* Default headers to pass through on 304 responses. From the spec:
* > The response must not contain a body and must include the headers that
* > would have been sent in an equivalent 200 OK response: Cache-Control,
* > Content-Location, Date, ETag, Expires, and Vary.
*/
const RETAINED_304_HEADERS = [
	"cache-control",
	"content-location",
	"date",
	"etag",
	"expires",
	"vary"
];
const stripWeak = (tag) => tag.replace(/^W\//, "");
function etagMatches(etag, ifNoneMatch) {
	return ifNoneMatch != null && ifNoneMatch.split(",").some((t) => stripWeak(t.trim()) === stripWeak(etag));
}
function initializeGenerator(generator) {
	if (!generator) {
		if (crypto && crypto.subtle) generator = (body) => crypto.subtle.digest({ name: "SHA-1" }, body);
	}
	return generator;
}
/**
* ETag Middleware for Acryl.
*
*
* @param {ETagOptions} [options] - The options for the ETag middleware.
* @param {boolean} [options.weak=false] - Define using or not using a weak validation. If true is set, then `W/` is added to the prefix of the value.
* @param {string[]} [options.retainedHeaders=RETAINED_304_HEADERS] - The headers that you want to retain in the 304 Response.
* @param {function(Uint8Array): ArrayBuffer | Promise<ArrayBuffer>} [options.generateDigest] -
* A custom digest generation function. By default, it uses 'SHA-1'
* This function is called with the response body as a `Uint8Array` and should return a hash as an `ArrayBuffer` or a Promise of one.
* @returns {MiddlewareHandler} The middleware handler function.
*
* @example
* ```ts
* const app = new Acryl()
*
* app.use('/etag/*', etag())
* app.get('/etag/abc', (c) => {
*   return c.text('Acryl is hot')
* })
* ```
*/
const etag = (options) => {
	const retainedHeaders = new Set((options?.retainedHeaders ?? RETAINED_304_HEADERS).map((header) => header.toLowerCase()));
	const weak = options?.weak ?? false;
	const generator = initializeGenerator(options?.generateDigest);
	return async function etag(c, next) {
		const ifNoneMatch = c.req.header("If-None-Match") ?? null;
		await next();
		if (!(c.req.method === "GET" || c.req.method === "HEAD" || c.req.method === "QUERY") || !c.res.ok) return;
		const res = c.res;
		let etag = res.headers.get("ETag");
		if (!etag) {
			if (!generator) return;
			const hash = await generateDigest(res.clone().body, generator);
			if (hash === null) return;
			etag = weak ? `W/"${hash}"` : `"${hash}"`;
		}
		if (ifNoneMatch === "*" || etagMatches(etag, ifNoneMatch)) {
			c.res = new Response(null, {
				status: 304,
				statusText: "Not Modified",
				headers: { ETag: etag }
			});
			for (const key of Array.from(c.res.headers.keys())) if (!retainedHeaders.has(key.toLowerCase())) c.res.headers.delete(key);
		} else c.res.headers.set("ETag", etag);
	};
};
//#endregion
export { RETAINED_304_HEADERS, etag };
