import { t as Context } from "./context-Bm7rI-oK.js";
import { n as BufferSource } from "./types-CwrQjlaM.js";
import { a as SignedCookie, i as CookiePrefixOptions, r as CookieOptions, t as Cookie } from "./cookie-ClMaKDQf.js";

//#region ../../plugins/acryl-router/src/core/helper/cookie/index.d.ts
interface GetCookie {
  (c: Context, key: string): string | undefined;
  (c: Context): Cookie;
  (c: Context, key: string, prefixOptions?: CookiePrefixOptions): string | undefined;
}
interface GetSignedCookie {
  (c: Context, secret: string | BufferSource, key: string): Promise<string | undefined | false>;
  (c: Context, secret: string | BufferSource): Promise<SignedCookie>;
  (c: Context, secret: string | BufferSource, key: string, prefixOptions?: CookiePrefixOptions): Promise<string | undefined | false>;
}
declare const getCookie: GetCookie;
declare const getSignedCookie: GetSignedCookie;
declare const generateCookie: (name: string, value: string, opt?: CookieOptions) => string;
declare const setCookie: (c: Context, name: string, value: string, opt?: CookieOptions) => void;
declare const generateSignedCookie: (name: string, value: string, secret: string | BufferSource, opt?: CookieOptions) => Promise<string>;
declare const setSignedCookie: (c: Context, name: string, value: string, secret: string | BufferSource, opt?: CookieOptions) => Promise<void>;
declare const deleteCookie: (c: Context, name: string, opt?: CookieOptions) => string | undefined;
//#endregion
export { deleteCookie, generateCookie, generateSignedCookie, getCookie, getSignedCookie, setCookie, setSignedCookie };