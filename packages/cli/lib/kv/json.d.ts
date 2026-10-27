import { n as KvOpened, t as Kv } from "../kv-DWDm0Lja.js";

//#region ../../plugins/acryl-kv-json/src/open.d.ts
interface OpenKvOptions {
  /** The JSON file; its folder is created if missing. */
  readonly path: string;
}
/** Open (and create, when missing) a JSON-file store. @throws when the file exists and is not a readable kv file. */
declare function openKv(options: OpenKvOptions): Promise<KvOpened>;
//#endregion
export { type Kv, type KvOpened, OpenKvOptions, openKv };