import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
//#region ../../plugins/acryl-db/src/facade/schema.ts
/** Validate a prefix before using it as part of a SQL identifier. */
function validateSchemaPrefix(prefix) {
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(prefix)) throw new Error(`Invalid SQL schema prefix ${JSON.stringify(prefix)}`);
	if (prefix.toLowerCase().startsWith("sqlite_")) throw new Error(`SQL schema prefix ${JSON.stringify(prefix)} is reserved`);
}
//#endregion
//#region ../../plugins/acryl-db/src/facade/migrations.ts
/**
* Apply all pending migrations atomically, tracking their version in the named metadata table.
*
* The bookkeeping SQL runs unchanged on SQLite and Postgres: no `STRICT` table, `ON CONFLICT DO NOTHING`
* instead of `INSERT OR IGNORE`, and the version written as a checked integer rather than a binding,
* since the two dialects spell placeholders differently.
*/
async function applyMigrations(database, migrations, options) {
	const { table } = options;
	validateSchemaPrefix(table);
	for (let index = 0; index < migrations.length; index++) if (migrations[index]?.version !== index + 1) throw new Error("Migrations must have contiguous versions starting at 1");
	await database.transaction(async (transaction) => {
		await transaction.exec(`CREATE TABLE IF NOT EXISTS ${table} (
			singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
			version INTEGER NOT NULL CHECK (version >= 0)
		)`);
		await transaction.exec(`INSERT INTO ${table} (singleton, version) VALUES (1, 0) ON CONFLICT DO NOTHING`);
		const row = await transaction.get(`SELECT version FROM ${table} WHERE singleton = 1`);
		if (row === void 0) throw new Error("Schema metadata is missing");
		const storedVersion = Number(row.version);
		const currentVersion = migrations.at(-1)?.version ?? 0;
		if (storedVersion > currentVersion) throw new Error(`Schema version ${storedVersion} is newer than supported version ${currentVersion}`);
		for (const migration of migrations) {
			if (migration.version <= storedVersion) continue;
			for (const statement of migration.statements) await transaction.exec(statement);
			await transaction.exec(`UPDATE ${table} SET version = ${String(migration.version)} WHERE singleton = 1`);
		}
	});
}
//#endregion
//#region ../../plugins/acryl-db/src/migration-files.ts
/**
* An app's migrations as numbered SQL files: `migrations/001-notes.sql`, `002-tags.sql`, ... Each file is one migration, run as one
* `exec` (so it may hold several statements), numbered from 1 with no gaps.
*/
const FILE = /^(\d+)-[a-z0-9][a-z0-9-]*\.sql$/u;
/**
* Read every `NNN-name.sql` file of a folder, in number order.
* @throws when a `.sql` file is not named `NNN-name.sql`, or the numbers do not run 1, 2, 3, ... without gaps or repeats.
*/
async function readMigrationFiles(folder) {
	const dir = typeof folder === "string" ? folder : fileURLToPath(folder);
	const numbered = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort().map((name) => {
		const match = FILE.exec(name);
		if (match?.[1] === void 0) throw new Error(`acryl-db: migration file ${name} in ${dir} must be named NNN-name.sql, like 001-notes.sql`);
		return {
			name,
			version: Number(match[1])
		};
	}).sort((a, b) => a.version - b.version);
	numbered.forEach((file, index) => {
		if (file.version !== index + 1) throw new Error(`acryl-db: migration ${file.name} in ${dir} should be number ${String(index + 1)}; the files must be numbered 1, 2, 3, ... with no gaps or repeats`);
	});
	return Promise.all(numbered.map(async (file) => ({
		version: file.version,
		statements: [await readFile(join(dir, file.name), "utf8")]
	})));
}
//#endregion
//#region ../../plugins/acryl-db/src/index.ts
/**
* The `db` port: what an app's code sees of its relational database, whichever provider (`acryl-db-sqlite`, `acryl-db-postgres`) serves
* it. Plain code (an acrylblends app) opens a database with a provider's `openDb`; a Cordis plugin declares `inject: ['db']`, imports
* `acryl-db/cordis` for the `ctx.db` type, and never imports a driver.
*
* Bindings are positional `?` placeholders on every provider; a provider whose database spells them differently translates them.
* This entry imports nothing from Cordis, at runtime or in its types.
*/
/** The service name every `db` provider registers. */
const DB_SERVICE = "db";
/** The table that records an app's migration version. */
const MIGRATIONS_TABLE = "_migrations";
//#endregion
export { validateSchemaPrefix as a, applyMigrations as i, MIGRATIONS_TABLE as n, readMigrationFiles as r, DB_SERVICE as t };
