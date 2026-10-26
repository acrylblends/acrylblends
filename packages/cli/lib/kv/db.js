import { a as compareKeys, c as runChange, i as codePoints, o as decodeValue, r as checkKey, s as encodeValue } from "../src-DRFVEQQb.js";
//#region ../../plugins/acryl-kv-db/src/open.ts
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/u;
/** The `kv` port over a `db`. It does not own the database: whoever opened it closes it, and calls after that reject. */
function kvOnDb(db, options = {}) {
	const table = options.table ?? "kv";
	if (!IDENTIFIER.test(table)) throw new TypeError(`acryl-kv-db: the table name must be a plain lower case SQL identifier, got ${JSON.stringify(table)}`);
	let ready;
	const ensure = () => {
		ready ??= db.exec(`CREATE TABLE IF NOT EXISTS ${table} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`).catch((error) => {
			ready = void 0;
			throw error;
		});
		return ready;
	};
	/**
	* Run a statement after the table exists. The table's statement and this one are both handed to the database at once (its queue keeps
	* their order), so a `close()` called right after a write cannot slip between them and leave the write on a closed database.
	*/
	const after = async (work) => {
		const created = ensure();
		const result = work();
		const [, value] = await Promise.all([created, result]);
		return value;
	};
	const upsert = `INSERT INTO ${table} (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
	return {
		async get(key) {
			checkKey(key);
			const row = await after(() => db.get(`SELECT value FROM ${table} WHERE key = ?`, key));
			return row === void 0 ? void 0 : decodeValue(row.value);
		},
		async set(key, value) {
			checkKey(key);
			const text = encodeValue(value);
			await after(() => db.run(upsert, key, text));
		},
		async update(key, change) {
			checkKey(key);
			return after(() => db.transaction(async (tx) => {
				const row = await tx.get(`SELECT value FROM ${table} WHERE key = ?`, key);
				const text = encodeValue(runChange(change, row === void 0 ? void 0 : decodeValue(row.value)));
				await tx.run(upsert, key, text);
				return decodeValue(text);
			}));
		},
		async delete(key) {
			checkKey(key);
			await after(() => db.run(`DELETE FROM ${table} WHERE key = ?`, key));
		},
		async list(prefix = "") {
			return (await after(() => prefix === "" ? db.all(`SELECT key FROM ${table}`) : db.all(`SELECT key FROM ${table} WHERE substr(key, 1, ?) = ?`, codePoints(prefix), prefix))).map((row) => row.key).sort(compareKeys);
		}
	};
}
//#endregion
export { kvOnDb };
