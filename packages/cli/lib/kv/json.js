import { a as compareKeys, c as runChange, o as decodeValue, r as checkKey, s as encodeValue } from "../src-DRFVEQQb.js";
import { mkdir, open, readFile, readdir, rename, rm } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
//#region ../../plugins/acryl-kv-json/src/open.ts
/**
* The plain way to open the JSON-file provider, for code without Cordis (an acrylblends app): `openKv({ path })` reads one JSON file into
* memory and resolves the `kv` port with the function that closes it. The Cordis plugin is a thin wrapper over this, so both run one code
* path. This entry imports nothing from Cordis.
*
* Every write queues behind the writes before it and persists the whole map: serialize to a temporary file in the same folder, flush it,
* rename it over the file, and flush the folder where the platform allows. The call resolves after the rename, so a crash leaves the old file
* or the new one, never half of one. One process owns the file: two writers would overwrite each other.
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
	let tail = Promise.resolve();
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
	/** Run a change after every earlier one; the map it works on becomes the state only once it is on disk. */
	const write = (change) => {
		guard();
		const task = tail.then(async () => {
			const draft = new Map(state);
			const result = change(draft);
			await persist(draft);
			state = draft;
			return result;
		});
		tail = task.catch(() => void 0);
		return task;
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
				await write((draft) => {
					draft.set(key, text);
				});
			},
			async update(key, change) {
				checkKey(key);
				return write((draft) => {
					const text = draft.get(key);
					const encoded = encodeValue(runChange(change, text === void 0 ? void 0 : decodeValue(text)));
					draft.set(key, encoded);
					return decodeValue(encoded);
				});
			},
			async delete(key) {
				checkKey(key);
				await write((draft) => {
					draft.delete(key);
				});
			},
			async list(prefix = "") {
				guard();
				return [...state.keys()].filter((key) => key.startsWith(prefix)).sort(compareKeys);
			}
		},
		close: async () => {
			closed = true;
			await tail;
		}
	};
}
//#endregion
export { openKv };
