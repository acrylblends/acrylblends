import { I as MiddlewareHandler, t as Context } from "./context-DVQBjuns.js";
import { n as BufferSource } from "./types-Lqx5BxQF.js";
import { i as CookiePrefixOptions } from "./cookie-CCelEqky.js";
import { i as AcrylJsonWebKey, n as VerifyOptions, s as AsymmetricAlgorithm } from "./jwt-BARhotDz.js";

//#region ../../plugins/acryl-router/src/core/middleware/jwk/jwk.d.ts
/**
 * JWK Auth Middleware for Acryl.
 *
 *
 * @param {object} options - The options for the JWK middleware.
 * @param {AcrylJsonWebKey[] | ((ctx: Context) => Promise<AcrylJsonWebKey[]> | AcrylJsonWebKey[])} [options.keys] - The public keys used for JWK verification, or a function that returns them.
 * @param {string | ((ctx: Context) => Promise<string> | string)} [options.jwks_uri] - If set to a URI string or a function that returns a URI string, attempt to fetch JWKs from it. The response must be a JSON object containing a `keys` array, which will be merged with the `keys` option.
 * @param {boolean} [options.allow_anon] - If set to `true`, the middleware allows requests without a token to proceed without authentication.
 * @param {string} [options.cookie] - If set, the middleware attempts to retrieve the token from a cookie with these options (optionally signed) only if no token is found in the header.
 * @param {string} [options.headerName='Authorization'] - The name of the header to look for the JWT token. Default is 'Authorization'.
 * @param {string} [options.realm] - The protection space described by the `realm` parameter of the returned `WWW-Authenticate` challenge header. Defaults to the request URL.
 * @param {AsymmetricAlgorithm[]} options.alg - An array of allowed asymmetric algorithms for JWT verification. Only tokens signed with these algorithms will be accepted.
 * @param {RequestInit} [init] - Optional init options for the `fetch` request when retrieving JWKS from a URI.
 * @param {VerifyOptions} [options.verification] - Additional options for JWK payload verification.
 * @returns {MiddlewareHandler} The middleware handler function.
 *
 * @example
 * ```ts
 * const app = new Acryl()
 *
 * app.use("/auth/*", jwk({
 *   jwks_uri: (c) => `https://${c.env.authServer}/.well-known/jwks.json`,
 *   headerName: 'x-custom-auth-header', // Optional, default is 'Authorization'
 * }))
 *
 * app.get('/auth/page', (c) => {
 *   return c.text('You are authorized')
 * })
 * ```
 */
declare const jwk: (options: {
  keys?: AcrylJsonWebKey[] | ((ctx: Context) => Promise<AcrylJsonWebKey[]> | AcrylJsonWebKey[]);
  jwks_uri?: string | ((ctx: Context) => Promise<string> | string);
  allow_anon?: boolean;
  cookie?: string | {
    key: string;
    secret?: string | BufferSource;
    prefixOptions?: CookiePrefixOptions;
  };
  headerName?: string;
  alg: AsymmetricAlgorithm[];
  realm?: string;
  verification?: VerifyOptions;
}, init?: RequestInit) => MiddlewareHandler;
//#endregion
export { jwk };