//#region ../../plugins/acryl-router/src/core/utils/encode.d.ts
/**
 * @module
 * Encode utility.
 */
declare const decodeBase64Url: (str: string) => Uint8Array<ArrayBuffer>;
declare const encodeBase64Url: (buf: ArrayBufferLike) => string;
declare const encodeBase64: (buf: ArrayBufferLike) => string;
declare const decodeBase64: (str: string) => Uint8Array<ArrayBuffer>;
//#endregion
export { decodeBase64, decodeBase64Url, encodeBase64, encodeBase64Url };