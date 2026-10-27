import { s as Db } from "../index-D4FAsBZu.js";
import { f as Kv } from "../index-BLTYsyc1.js";

//#region ../../plugins/acryl-kv-db/src/open.d.ts
interface KvOnDbOptions {
  /** The table that holds the documents. Defaults to `kv`; a plain SQL identifier. */
  readonly table?: string;
}
/** The `kv` port over a `db`. It does not own the database: whoever opened it closes it, and calls after that reject. */
declare function kvOnDb(db: Db, options?: KvOnDbOptions): Kv;
//#endregion
export { type Kv, KvOnDbOptions, kvOnDb };