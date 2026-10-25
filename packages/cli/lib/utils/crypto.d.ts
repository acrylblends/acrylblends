import { _ as JSONValue } from "../types-D9DEXMjE.js";

//#region ../../plugins/acryl-router/src/core/utils/crypto.d.ts
type Algorithm = {
  name: string;
  alias: string;
};
type Data = string | boolean | number | JSONValue | ArrayBufferView | ArrayBuffer;
declare const sha256: (data: Data) => Promise<string | null>;
declare const sha1: (data: Data) => Promise<string | null>;
declare const md5: (data: Data) => Promise<string | null>;
declare const createHash: (data: Data, algorithm: Algorithm) => Promise<string | null>;
//#endregion
export { createHash, md5, sha1, sha256 };