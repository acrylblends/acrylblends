import { n as BufferSource } from "./types-Lqx5BxQF.js";

//#region ../../plugins/acryl-router/src/core/utils/cookie.d.ts
type Cookie = Record<string, string>;
type SignedCookie = Record<string, string | false>;
type PartitionedCookieConstraint = {
  partitioned: true;
  secure: true;
} | {
  partitioned?: boolean;
  secure?: boolean;
};
type SecureCookieConstraint = {
  secure: true;
};
type HostCookieConstraint = {
  secure: true;
  path: '/';
  domain?: undefined;
};
type CookieOptions = {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None' | 'strict' | 'lax' | 'none';
  partitioned?: boolean;
  priority?: 'Low' | 'Medium' | 'High' | 'low' | 'medium' | 'high';
  prefix?: CookiePrefixOptions;
} & PartitionedCookieConstraint;
type CookiePrefixOptions = 'host' | 'secure';
type CookieConstraint<Name> = Name extends `__Secure-${string}` ? CookieOptions & SecureCookieConstraint : Name extends `__Host-${string}` ? CookieOptions & HostCookieConstraint : CookieOptions;
declare const parse: (cookie: string, name?: string) => Cookie;
declare const parseSigned: (cookie: string, secret: string | BufferSource, name?: string) => Promise<SignedCookie>;
declare const serialize: <Name extends string>(name: Name, value: string, opt?: CookieConstraint<Name>) => string;
declare const serializeSigned: (name: string, value: string, secret: string | BufferSource, opt?: CookieOptions) => Promise<string>;
//#endregion
export { SignedCookie as a, serialize as c, CookiePrefixOptions as i, serializeSigned as l, CookieConstraint as n, parse as o, CookieOptions as r, parseSigned as s, Cookie as t };