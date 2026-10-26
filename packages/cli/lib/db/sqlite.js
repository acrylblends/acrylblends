import { i as applyMigrations, n as MIGRATIONS_TABLE, r as readMigrationFiles } from "../src-MWcsMS8i.js";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
//#region ../../plugins/acryl-db-sqlite/src/facade/node.ts
const DEFAULT_WAL_AUTO_CHECKPOINT_PAGES = 1e3;
const DEFAULT_BUSY_TIMEOUT_MS = 5e3;
const ignore = () => {};
/**
* Runs operations in call order. An operation starts immediately when nothing is running or waiting;
* otherwise it waits for everything before it. An asynchronous operation holds the queue until it settles.
*/
var SerialOperationQueue = class {
	tail = Promise.resolve();
	pending = 0;
	run(operation) {
		if (this.pending > 0) return this.enqueue(operation);
		try {
			return Promise.resolve(operation());
		} catch (error) {
			return Promise.reject(error);
		}
	}
	runAsync(operation) {
		if (this.pending > 0) return this.enqueue(operation);
		this.pending++;
		const { promise: barrier, resolve: releaseBarrier } = Promise.withResolvers();
		this.tail = barrier;
		let started;
		try {
			started = operation();
		} catch (error) {
			started = Promise.reject(error);
		}
		return started.finally(() => {
			this.pending--;
			releaseBarrier();
		});
	}
	enqueue(operation) {
		this.pending++;
		return this.release(this.tail.then(operation));
	}
	release(operation) {
		const settled = operation.finally(() => {
			this.pending--;
		});
		this.tail = settled.then(ignore, ignore);
		return settled;
	}
};
/**
* Executes SQL on one connection. Prepared statements are cached per connection by SQL text, so the
* database and its transaction handles share them across transactions.
*/
var NodeSqliteExecutor = class {
	database;
	statements;
	constructor(database, statements) {
		this.database = database;
		this.statements = statements;
	}
	exec(sql) {
		return this.runOperation(() => {
			this.database.exec(sql);
		});
	}
	run(sql, ...params) {
		return this.runOperation(() => ({ changes: Number(this.statement(sql).run(...params).changes) }));
	}
	get(sql, ...params) {
		return this.runOperation(() => this.statement(sql).get(...params));
	}
	all(sql, ...params) {
		return this.runOperation(() => this.statement(sql).all(...params));
	}
	statement(sql) {
		let statement = this.statements.get(sql);
		if (statement === void 0) {
			statement = this.database.prepare(sql);
			this.statements.set(sql, statement);
		}
		return statement;
	}
};
var NodeSqliteTransaction = class extends NodeSqliteExecutor {
	scope;
	constructor(database, statements, scope) {
		super(database, statements);
		this.scope = scope;
	}
	async runOperation(operation) {
		if (!this.scope.active) throw new Error("SQLite transaction handle is no longer active");
		return operation();
	}
};
/** `Db` adapter backed by Node's built-in `node:sqlite`. */
var NodeSqliteDatabase = class extends NodeSqliteExecutor {
	access = new SerialOperationQueue();
	closed = false;
	constructor(database) {
		super(database, /* @__PURE__ */ new Map());
	}
	transaction(callback) {
		return this.access.runAsync(async () => {
			this.database.exec("BEGIN IMMEDIATE");
			const scope = { active: true };
			try {
				const result = await callback(new NodeSqliteTransaction(this.database, this.statements, scope));
				scope.active = false;
				this.database.exec("COMMIT");
				return result;
			} catch (error) {
				scope.active = false;
				try {
					this.database.exec("ROLLBACK");
				} catch (rollbackError) {
					throw new AggregateError([error, rollbackError], "SQLite transaction failed and rollback failed");
				}
				throw error;
			}
		});
	}
	close() {
		return this.access.run(() => {
			if (this.closed) return;
			this.closed = true;
			this.statements.clear();
			try {
				this.database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
			} finally {
				this.database.close();
			}
		});
	}
	runOperation(operation) {
		return this.access.run(operation);
	}
};
/** Open and configure a Node-backed SQLite database facade. */
async function openNodeSqliteDatabase(path, options = {}) {
	const checkpointPages = options.walAutoCheckpointPages ?? DEFAULT_WAL_AUTO_CHECKPOINT_PAGES;
	const timeout = options.busyTimeoutMs ?? DEFAULT_BUSY_TIMEOUT_MS;
	if (path !== ":memory:") await mkdir(dirname(path), { recursive: true });
	const adapter = new NodeSqliteDatabase(new DatabaseSync(path, { timeout }));
	try {
		await adapter.exec("PRAGMA journal_mode = WAL");
		await adapter.exec("PRAGMA synchronous = NORMAL");
		await adapter.exec(`PRAGMA wal_autocheckpoint = ${checkpointPages}`);
		return adapter;
	} catch (error) {
		try {
			await adapter.close();
		} catch {}
		throw error;
	}
}
//#endregion
//#region ../../plugins/acryl-db-sqlite/src/open.ts
/**
* The plain way to open the SQLite provider, for code without Cordis (an acrylblends app): `openDb({ path, migrations })` opens one
* `node:sqlite` file with the ported facade's settings (WAL, `synchronous = NORMAL`, a busy timeout) and foreign keys enforced, applies the
* numbered migrations, and resolves the `db` port with the function that closes it. The Cordis plugin is a thin wrapper over this, so both
* run one code path.
* This entry imports nothing from Cordis.
*/
/**
* Open, configure and migrate a SQLite database.
* @throws when the migration files are misnamed or misnumbered, or a migration fails (the file is closed, and unchanged), or the
*   database's schema is newer than the migrations.
*/
async function openDb(options) {
	const migrations = options.migrations === void 0 ? [] : await readMigrationFiles(options.migrations);
	const database = await openNodeSqliteDatabase(options.path, {
		...options.busyTimeoutMs === void 0 ? {} : { busyTimeoutMs: options.busyTimeoutMs },
		...options.walAutoCheckpointPages === void 0 ? {} : { walAutoCheckpointPages: options.walAutoCheckpointPages }
	});
	try {
		await database.exec("PRAGMA foreign_keys = ON");
		await applyMigrations(database, migrations, { table: MIGRATIONS_TABLE });
	} catch (error) {
		await database.close();
		throw error;
	}
	return {
		db: {
			exec: (sql) => database.exec(sql),
			run: (sql, ...params) => database.run(sql, ...params),
			get: (sql, ...params) => database.get(sql, ...params),
			all: (sql, ...params) => database.all(sql, ...params),
			transaction: (work) => database.transaction(work)
		},
		close: () => database.close()
	};
}
//#endregion
export { openDb };
