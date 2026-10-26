//#region ../../plugins/acryl-db/src/facade/database.d.ts
/** Values supported by the portable SQL drivers. */
type SqlValue = null | number | bigint | string | Uint8Array;
/**
 * Asynchronous SQL operations shared by a database and its transaction handles.
 *
 * `exec` runs SQL text without bindings and may contain several statements. `run`, `get`, and `all`
 * execute one statement with positional bindings. Adapters may cache prepared statements by SQL text,
 * so callers pass values as bindings instead of interpolating them. `run` resolves the number of rows
 * the statement changed.
 */
interface DbExecutor {
  exec(sql: string): Promise<void>;
  run(sql: string, ...params: SqlValue[]): Promise<{
    readonly changes: number;
  }>;
  get<T extends object>(sql: string, ...params: SqlValue[]): Promise<T | undefined>;
  all<T extends object>(sql: string, ...params: SqlValue[]): Promise<T[]>;
}
/**
 * Minimal portable SQL database facade.
 *
 * All operations are asynchronous so adapters may execute outside the caller's runtime.
 *
 * `transaction` passes the callback a transaction handle. All work in the transaction
 * must use that handle; the handle is invalid after the callback settles. Adapters must
 * queue unrelated operations and other transactions until the transaction finishes. The
 * returned promise settles after commit or rollback. Calling the database itself (including
 * `transaction`) from inside a callback therefore waits for that transaction and
 * never settles.
 *
 * When the callback rejects, the adapter must roll the transaction back before rejecting
 * with that same error. If rollback fails, it must reject with a different error (for
 * example an `AggregateError`) so callers cannot mistake the callback error for a
 * guaranteed rollback.
 *
 * Closing is the adapter's: the plugin that opened a database closes it, so the facade an
 * app receives has no `close`.
 */
interface Db extends DbExecutor {
  transaction<T>(callback: (transaction: DbExecutor) => Promise<T>): Promise<T>;
}
//#endregion
//#region ../../plugins/acryl-db/src/facade/migrations.d.ts
type Migration = {
  readonly version: number;
  readonly statements: readonly string[];
};
/**
 * Apply all pending migrations atomically, tracking their version in the named metadata table.
 *
 * The bookkeeping SQL runs unchanged on SQLite and Postgres: no `STRICT` table, `ON CONFLICT DO NOTHING`
 * instead of `INSERT OR IGNORE`, and the version written as a checked integer rather than a binding,
 * since the two dialects spell placeholders differently.
 */
declare function applyMigrations(database: Db, migrations: readonly Migration[], options: {
  readonly table: string;
}): Promise<void>;
//#endregion
//#region ../../plugins/acryl-db/src/facade/schema.d.ts
/** Validate a prefix before using it as part of a SQL identifier. */
declare function validateSchemaPrefix(prefix: string): void;
//#endregion
//#region ../../plugins/acryl-db/src/migration-files.d.ts
/**
 * Read every `NNN-name.sql` file of a folder, in number order.
 * @throws when a `.sql` file is not named `NNN-name.sql`, or the numbers do not run 1, 2, 3, ... without gaps or repeats.
 */
declare function readMigrationFiles(folder: string | URL): Promise<Migration[]>;
//#endregion
//#region ../../plugins/acryl-db/src/index.d.ts
/**
 * The `db` port: what an app's code sees of its relational database, whichever provider (`acryl-db-sqlite`, `acryl-db-postgres`) serves
 * it. Plain code (an acrylblends app) opens a database with a provider's `openDb`; a Cordis plugin declares `inject: ['db']`, imports
 * `acryl-db/cordis` for the `ctx.db` type, and never imports a driver.
 *
 * Bindings are positional `?` placeholders on every provider; a provider whose database spells them differently translates them.
 * This entry imports nothing from Cordis, at runtime or in its types.
 */
/** The service name every `db` provider registers. */
declare const DB_SERVICE = "db";
/** The table that records an app's migration version. */
declare const MIGRATIONS_TABLE = "_migrations";
//#endregion
export { DB_SERVICE, type Db, type DbExecutor, MIGRATIONS_TABLE, type Migration, type SqlValue, applyMigrations, readMigrationFiles, validateSchemaPrefix };