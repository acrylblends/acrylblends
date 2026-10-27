import { t as Db } from "../database-DBHdwefi.js";
import { n as Kv } from "../kv-9f-AlRKN.js";

//#region ../../plugins/acryl-kv-db/src/open.d.ts
interface KvOnDbOptions {
  /** The table that holds the documents. Defaults to `kv`; a plain SQL identifier. */
  readonly table?: string;
}
/** The `kv` port over a `db`. It does not own the database: whoever opened it closes it, and calls after that reject. */
declare function kvOnDb(db: Db, options?: KvOnDbOptions): Kv;
//#endregion
export { type Kv, KvOnDbOptions, kvOnDb };