//#region ../../plugins/acryl-kv/src/check.ts
/**
* What every `kv` provider checks the same way, so a bad call fails alike on a file and on SQL: the key, the value, and the order of keys.
*/
/** A key is a non-empty string. */
function checkKey(key) {
	if (typeof key !== "string" || key === "") throw new TypeError(`a kv key is a non-empty string, got ${typeof key === "string" ? "an empty string" : typeof key}`);
}
/**
* The JSON text of a value. `undefined`, functions, symbols, bigints, circular structures and non-finite numbers (which JSON would turn
* into `null`) are refused with a `TypeError`; nothing is stored for them.
*/
function encodeValue(value) {
	const text = JSON.stringify(value, (_key, part) => {
		if (typeof part === "number" && !Number.isFinite(part)) throw new TypeError(`a kv value is JSON; ${String(part)} is not`);
		return part;
	});
	if (text === void 0) throw new TypeError(`a kv value is JSON; ${typeof value} is not`);
	return text;
}
/** The value of stored JSON text: a new copy each time, so changing what `get` returned changes nothing stored. */
function decodeValue(text) {
	return JSON.parse(text);
}
/** Order two keys by code point (the order of UTF-8 bytes, which SQLite's binary collation and Postgres' "C" collation give too). */
function compareKeys(a, b) {
	if (a === b) return 0;
	const rank = (unit) => unit >= 55296 ? unit >= 57344 ? unit - 2048 : unit + 8192 : unit;
	const length = Math.min(a.length, b.length);
	for (let index = 0; index < length; index += 1) {
		const difference = rank(a.charCodeAt(index)) - rank(b.charCodeAt(index));
		if (difference !== 0) return difference;
	}
	return a.length - b.length;
}
/** The number of code points in a string (what SQL's `substr` counts). */
function codePoints(text) {
	let count = 0;
	for (const _ of text) count += 1;
	return count;
}
/**
* Call an `update` callback and check what it returns: the callback is synchronous, so a promise (an `async` function the types should have
* refused) is rejected with a message that says what to do, instead of being stored as `{}`.
*/
function runChange(change, current) {
	const next = change(current);
	if (typeof next === "object" && next !== null && typeof next.then === "function") throw new TypeError("the callback of kv.update is synchronous and returned a promise: read what you need first (await kv.get), then update with a plain function");
	return next;
}
//#endregion
//#region ../../plugins/acryl-kv/src/copy.ts
/**
* Copy every key of one store into another: the import when an app moves from a JSON file to SQL (the file opened with
* `acryl-kv-json` is the source, `kvOnDb` the target). The source is not changed.
* @throws when the target has a key the source has and `overwrite` is not set; nothing is written then.
*/
async function copyKv(source, target, options = {}) {
	const keys = await source.list(options.prefix);
	const existing = new Set(await target.list(options.prefix));
	const shared = keys.filter((key) => existing.has(key));
	if (shared.length > 0 && options.overwrite !== true) {
		const shown = shared.slice(0, 5).map((key) => JSON.stringify(key)).join(", ");
		throw new Error(`copyKv: the target already has ${shared.length} of these keys (${shown}${shared.length > 5 ? ", ..." : ""}); pass overwrite to replace them`);
	}
	let copied = 0;
	for (const key of keys) {
		const value = await source.get(key);
		if (value === void 0) continue;
		await target.set(key, value);
		copied += 1;
	}
	return {
		copied,
		overwritten: shared.length
	};
}
//#endregion
//#region ../../plugins/acryl-kv/src/index.ts
/**
* The `kv` port: named JSON documents for an app too small for SQL, whichever provider serves it (`acryl-kv-json` for one file,
* `acryl-kv-db` over the `db` port). Plain code opens a store with a provider's `openKv`; a Cordis plugin declares `inject: ['kv']`, imports
* `acryl-kv/cordis` for the `ctx.kv` type, and never imports a provider.
*
* This entry imports nothing from Cordis, at runtime or in its types.
*/
/** The service name every `kv` provider registers. */
const KV_SERVICE = "kv";
//#endregion
export { compareKeys as a, runChange as c, codePoints as i, copyKv as n, decodeValue as o, checkKey as r, encodeValue as s, KV_SERVICE as t };
