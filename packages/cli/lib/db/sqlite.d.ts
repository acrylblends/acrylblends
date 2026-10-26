import { n as DbExecutor, r as SqlValue, t as Db } from "../database-D_UN6We8.js";

//#region ../../plugins/acryl-db-sqlite/src/open.d.ts
interface OpenDbOptions {
  /** The database file, its folder created if missing; `:memory:` for a database that lives until `close`. */
  readonly path: string;
  /** A folder of `NNN-name.sql` files numbered from 1, as a path or a file URL, applied in order before `openDb` resolves. */
  readonly migrations?: string | URL;
  /** How long SQLite waits for a competing file lock, in milliseconds. Defaults to 5000. */
  readonly busyTimeoutMs?: number;
  /** The WAL auto-checkpoint threshold in pages; 0 disables it. Defaults to 1000. */
  readonly walAutoCheckpointPages?: number;
}
/** An open database: the port, and the one function that closes it. */
interface OpenDb {
  readonly db: Db;
  /** Waits for running operations and transactions, checkpoints the WAL and releases the file. Calling it again does nothing. */
  close(): Promise<void>;
}
/**
 * Open, configure and migrate a SQLite database.
 * @throws when the migration files are misnamed or misnumbered, or a migration fails (the file is closed, and unchanged), or the
 *   database's schema is newer than the migrations.
 */
declare function openDb(options: OpenDbOptions): Promise<OpenDb>;
//#endregion
export { type Db, type DbExecutor, OpenDb, OpenDbOptions, type SqlValue, openDb };