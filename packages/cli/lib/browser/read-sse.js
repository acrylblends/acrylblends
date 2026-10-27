//#region ../../plugins/acryl-router/src/helpers/read-sse.ts
/**
* Read the events of a `text/event-stream` response as they arrive. Leaving the loop early (`break`, a thrown error) cancels the body, so the
* request to the server ends.
* @throws when the response is not `ok` (the status is in the message; the body is cancelled, not parsed), has no body, or fails while it is read.
*/
async function* readSSE(response, options = {}) {
	if (!response.ok) {
		await response.body?.cancel().catch(() => void 0);
		throw new Error(`readSSE: the request failed with ${String(response.status)}${response.statusText === "" ? "" : ` ${response.statusText}`}`);
	}
	if (response.body === null) throw new Error("readSSE: the response has no body to read");
	const { signal } = options;
	if (signal?.aborted === true) {
		await response.body.cancel().catch(() => void 0);
		return;
	}
	const reader = response.body.getReader();
	const onAbort = () => {
		reader.cancel().catch(() => void 0);
	};
	signal?.addEventListener("abort", onAbort, { once: true });
	const decoder = new TextDecoder("utf-8");
	let buffer = "";
	let skipLineFeed = false;
	let name = "";
	let data = [];
	let id;
	let retry;
	/** Apply one line; returns the event when this line completes one. */
	const apply = (line) => {
		if (line === "") {
			const event = data.length === 0 ? void 0 : {
				event: name === "" ? "message" : name,
				data: data.join("\n"),
				...id === void 0 ? {} : { id },
				...retry === void 0 ? {} : { retry }
			};
			name = "";
			data = [];
			id = void 0;
			retry = void 0;
			return event;
		}
		if (line.startsWith(":")) return void 0;
		const colon = line.indexOf(":");
		const field = colon === -1 ? line : line.slice(0, colon);
		let value = colon === -1 ? "" : line.slice(colon + 1);
		if (value.startsWith(" ")) value = value.slice(1);
		if (field === "event") name = value;
		else if (field === "data") data.push(value);
		else if (field === "id") {
			if (!value.includes("\0")) id = value;
		} else if (field === "retry" && /^\d+$/u.test(value)) retry = Number(value);
	};
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			let text = decoder.decode(value, { stream: true });
			if (skipLineFeed && text.startsWith("\n")) text = text.slice(1);
			if (text !== "") skipLineFeed = false;
			buffer += text;
			let start = 0;
			for (let index = 0; index < buffer.length; index += 1) {
				const code = buffer.charCodeAt(index);
				if (code !== 10 && code !== 13) continue;
				const line = buffer.slice(start, index);
				if (code === 13) if (index + 1 < buffer.length) {
					if (buffer.charCodeAt(index + 1) === 10) index += 1;
				} else skipLineFeed = true;
				start = index + 1;
				const event = apply(line);
				if (event !== void 0) yield event;
			}
			buffer = buffer.slice(start);
		}
	} finally {
		signal?.removeEventListener("abort", onAbort);
		await reader.cancel().catch(() => void 0);
	}
}
//#endregion
export { readSSE };
