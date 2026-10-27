import { f as Kv, p as KvOpened } from "../index-BLTYsyc1.js";

//#region ../../plugins/acryl-kv-json/src/open.d.ts
interface OpenKvOptions {
  /** The JSON file; its folder is created if missing. */
  readonly path: string;
}
/** Open (and create, when missing) a JSON-file store. @throws when the file exists and is not a readable kv file. */
declare function openKv(options: OpenKvOptions): Promise<KvOpened>;
//#endregion
export { type Kv, type KvOpened, OpenKvOptions, openKv };