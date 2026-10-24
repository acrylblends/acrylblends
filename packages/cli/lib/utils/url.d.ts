//#region ../../plugins/acryl-router/src/core/utils/url.d.ts
/**
 * @module
 * URL utility.
 */
type Pattern = readonly [string, string, RegExp | true] | '*';
declare const splitPath: (path: string) => string[];
declare const splitRoutingPath: (routePath: string) => string[];
declare const getPattern: (label: string, next?: string) => Pattern | null;
type Decoder = (str: string) => string;
declare const tryDecode: (str: string, decoder: Decoder) => string;
/**
 * Try to apply decodeURI() to given string.
 * If it fails, skip invalid percent encoding or invalid UTF-8 sequences, and apply decodeURI() to the rest as much as possible.
 * @param str The string to decode.
 * @returns The decoded string that sometimes contains undecodable percent encoding.
 * @example
 * tryDecodeURI('Hello%20World') // 'Hello World'
 * tryDecodeURI('Hello%20World/%A4%A2') // 'Hello World/%A4%A2'
 */
declare const tryDecodeURI: (str: string) => string;
declare const getPath: (request: Request) => string;
/**
 * @deprecated
 * Use the `URL` API instead.
 */
declare const getQueryStrings: (url: string) => string;
declare const getPathNoStrict: (request: Request) => string;
/**
 * Merge paths.
 * @param {string[]} ...paths - The paths to merge.
 * @returns {string} The merged path.
 * @example
 * mergePath('/api', '/users') // '/api/users'
 * mergePath('/api/', '/users') // '/api/users'
 * mergePath('/api', '/') // '/api'
 * mergePath('/api/', '/') // '/api/'
 */
declare const mergePath: (...paths: string[]) => string;
declare const checkOptionalParameter: (path: string) => string[] | null;
declare const tryDecodeURIComponent: (str: string) => string;
declare const getQueryParam: (url: string, key?: string) => string | undefined | Record<string, string>;
declare const getQueryParams: (url: string, key?: string) => string[] | undefined | Record<string, string[]>;
declare const decodeURIComponent_: typeof decodeURIComponent;
//#endregion
export { Pattern, checkOptionalParameter, decodeURIComponent_, getPath, getPathNoStrict, getPattern, getQueryParam, getQueryParams, getQueryStrings, mergePath, splitPath, splitRoutingPath, tryDecode, tryDecodeURI, tryDecodeURIComponent };