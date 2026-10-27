import { a as compareKeys, c as runChange, o as decodeValue, r as checkKey, s as encodeValue } from "../src-DRFVEQQb.js";
import { mkdir, open, readFile, readdir, rename, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
//#region ../../plugins/acryl-kv-json/src/open.ts
/**
* The plain way to open the JSON-file provider, for code without Cordis (an acrylblends app): `openKv({ path })` reads one JSON file into
* memory and resolves the `kv` port with the function that closes it. The Cordis plugin is a thin wrapper over this, so both run one code
* path. This entry imports nothing from Cordis.
*
* Every write persists the whole map: serialize to a temporary file in the same folder, flush it, rename it over the file, and flush the
* folder where the platform allows. The call resolves after the rename, so a crash leaves the old file or the new one, never half of one.
* Writes are grouped: the calls made in one turn of the event loop, and those that queue while a file write is in flight, are applied in
* call order and persisted together by one write, so a burst of calls costs one flush and one rename, not one each (on Windows each costs
* tens of milliseconds). One process owns the
* file: two writers would overwrite each other.
*/
/** The file's own format version, for a later change of layout. */
const FORMAT = 1;
/** Stray temporary files from a crash end in `.tmp` and start with the file's name. */
const tempPrefix = (file) => `${basename(file)}.`;
/** The file content for a map of key to JSON text, keys in code point order, so the same data is the same bytes. */
function serialize(entries) {
	const body = [...entries.keys()].sort(compareKeys).map((key) => `${JSON.stringify(key)}:${entries.get(key)}`).join(",");
	return `{"version":${FORMAT},"entries":{${body}}}\n`;
}
function unreadable(file, reason) {
	return /* @__PURE__ */ new Error(`acryl-kv-json: ${file} is not a readable kv file (${reason}); it was not changed`);
}
/** The entries of a file, or none when it does not exist. A file that exists and does not parse is an error: it is never started over. */
async function load(file) {
	let text;
	try {
		text = await readFile(file, "utf8");
	} catch (error) {
		if (error.code === "ENOENT") return /* @__PURE__ */ new Map();
		throw error;
	}
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		throw unreadable(file, error.message);
	}
	if (typeof parsed !== "object" || parsed === null || parsed.version !== FORMAT) throw unreadable(file, "not a version 1 kv file");
	const entries = parsed.entries;
	if (typeof entries !== "object" || entries === null || Array.isArray(entries)) throw unreadable(file, "no entries object");
	return new Map(Object.entries(entries).map(([key, value]) => [key, JSON.stringify(value)]));
}
/** Remove the temporary files an earlier crash left beside the file. */
async function removeStrays(file) {
	const prefix = tempPrefix(file);
	for (const name of await readdir(dirname(file))) if (name.startsWith(prefix) && name.endsWith(".tmp")) await rm(join(dirname(file), name), { force: true });
}
const RENAME_RETRIES = 8;
/** Rename over the target. Windows refuses while a scanner or an indexer holds the target for a moment, so it is retried briefly. */
async function replace(from, to) {
	for (let attempt = 0;; attempt += 1) try {
		await rename(from, to);
		return;
	} catch (error) {
		const code = error.code;
		if (attempt >= RENAME_RETRIES || code !== "EPERM" && code !== "EBUSY" && code !== "EACCES") throw error;
		await new Promise((resolveWait) => setTimeout(resolveWait, 10 * (attempt + 1)));
	}
}
/** Flush the folder entry of a renamed file (POSIX); Windows cannot open a folder, and a filesystem that refuses is no worse than before. */
async function flushFolder(folder) {
	if (process.platform === "win32") return;
	try {
		const handle = await open(folder, "r");
		try {
			await handle.sync();
		} finally {
			await handle.close();
		}
	} catch {}
}
/** Open (and create, when missing) a JSON-file store. @throws when the file exists and is not a readable kv file. */
async function openKv(options) {
	const file = resolve(options.path);
	await mkdir(dirname(file), { recursive: true });
	await removeStrays(file);
	let state = await load(file);
	let closed = false;
	let sequence = 0;
	/** Calls waiting for the next file write, in call order. */
	let queue = [];
	/** Whether the loop that writes the queue runs; cleared by the loop itself, so a call queued after it ends starts a new one. */
	let draining = false;
	/** The latest loop, for `close` to wait on. */
	let drained = Promise.resolve();
	const guard = () => {
		if (closed) throw new Error(`acryl-kv-json: ${file} is closed`);
	};
	/** Persist a map: the file is the old one or this one, never between. */
	const persist = async (next) => {
		sequence += 1;
		const temp = join(dirname(file), `${tempPrefix(file)}${process.pid}.${sequence}.tmp`);
		try {
			const handle = await open(temp, "w");
			try {
				await handle.writeFile(serialize(next), "utf8");
				await handle.sync();
			} finally {
				await handle.close();
			}
			await replace(temp, file);
		} catch (error) {
			await rm(temp, { force: true });
			throw error;
		}
		await flushFolder(dirname(file));
	};
	/**
	* Write the queue until it is empty. Each round takes every call queued so far and applies them in order to one copy of the state. A call
	* whose change throws rejects with its error and changes nothing, and the others in the round still apply. The copy becomes the state
	* only once it is on disk. A failed file write rejects every call in its round and leaves the state as it was.
	*/
	const drain = async () => {
		try {
			await Promise.resolve();
			await rounds();
		} finally {
			draining = false;
		}
	};
	const rounds = async () => {
		while (queue.length > 0) {
			const round = queue;
			queue = [];
			const draft = new Map(state);
			const applied = [];
			for (const call of round) {
				let change;
				try {
					change = call.change((key) => draft.get(key));
				} catch (error) {
					call.reject(error);
					continue;
				}
				if (change.text === void 0) draft.delete(change.key);
				else draft.set(change.key, change.text);
				applied.push({
					call,
					result: change.result
				});
			}
			if (applied.length === 0) continue;
			try {
				await persist(draft);
			} catch (error) {
				for (const { call } of applied) call.reject(error);
				continue;
			}
			state = draft;
			for (const { call, result } of applied) call.resolve(result);
		}
	};
	/** Queue one change behind every earlier call; it resolves once a file write that contains it is on disk. */
	const write = (change) => {
		guard();
		const done = new Promise((resolveCall, rejectCall) => {
			queue.push({
				change,
				resolve: resolveCall,
				reject: rejectCall
			});
		});
		if (!draining) {
			draining = true;
			drained = drain();
		}
		return done;
	};
	return {
		kv: {
			async get(key) {
				guard();
				checkKey(key);
				const text = state.get(key);
				return text === void 0 ? void 0 : decodeValue(text);
			},
			async set(key, value) {
				checkKey(key);
				const text = encodeValue(value);
				await write(() => ({
					key,
					text,
					result: void 0
				}));
			},
			async update(key, change) {
				checkKey(key);
				return write((read) => {
					const text = read(key);
					const encoded = encodeValue(runChange(change, text === void 0 ? void 0 : decodeValue(text)));
					return {
						key,
						text: encoded,
						result: decodeValue(encoded)
					};
				});
			},
			async delete(key) {
				checkKey(key);
				await write(() => ({
					key,
					text: void 0,
					result: void 0
				}));
			},
			async list(prefix = "") {
				guard();
				return [...state.keys()].filter((key) => key.startsWith(prefix)).sort(compareKeys);
			}
		},
		close: async () => {
			closed = true;
			await drained;
		}
	};
}
//#endregion
export { openKv };
