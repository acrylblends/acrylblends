import { I as MiddlewareHandler } from "./context-Bm7rI-oK.js";
import { n as BufferSource } from "./types-CwrQjlaM.js";
import { i as CookiePrefixOptions } from "./cookie-ClMaKDQf.js";
import { a as SignatureKey, c as SignatureAlgorithm, i as AcrylJsonWebKey, n as VerifyOptions, o as AlgorithmTypes, r as VerifyOptionsWithAlg, s as AsymmetricAlgorithm, t as TokenHeader } from "./jwt-Dg493Tai.js";
import { t as JWTPayload } from "./types-DR95J00T.js";

//#region ../../plugins/acryl-router/src/core/middleware/jwt/jwt.d.ts
type JwtVariables<T = any> = {
  jwtPayload: T;
};
/**
 * JWT Auth Middleware for Acryl.
 *
 *
 * @param {object} options - The options for the JWT middleware.
 * @param {SignatureKey} options.secret - A value of your secret key.
 * @param {string} [options.cookie] - If this value is set, then the value is retrieved from the cookie header using that value as a key, which is then validated as a token.
 * @param {SignatureAlgorithm} options.alg - An algorithm type that is used for verifying (required). Available types are `HS256` | `HS384` | `HS512` | `RS256` | `RS384` | `RS512` | `PS256` | `PS384` | `PS512` | `ES256` | `ES384` | `ES512` | `EdDSA`.
 * @param {string} [options.headerName='Authorization'] - The name of the header to look for the JWT token. Default is 'Authorization'.
 * @param {string} [options.realm] - The protection space described by the `realm` parameter of the returned `WWW-Authenticate` challenge header. Defaults to the request URL.
 * @param {VerifyOptions} [options.verification] - Additional options for JWT payload verification.
 * @returns {MiddlewareHandler} The middleware handler function.
 *
 * @example
 * ```ts
 * const app = new Acryl()
 *
 * app.use(
 *   '/auth/*',
 *   jwt({
 *     secret: process.env.JWT_SECRET, // never a literal in source
 *     alg: 'HS256',
 *     headerName: 'x-custom-auth-header', // Optional, default is 'Authorization'
 *   })
 * )
 *
 * app.get('/auth/page', (c) => {
 *   return c.text('You are authorized')
 * })
 * ```
 */
declare const jwt: (options: {
  secret: SignatureKey;
  cookie?: string | {
    key: string;
    secret?: string | BufferSource;
    prefixOptions?: CookiePrefixOptions;
  };
  alg: SignatureAlgorithm;
  headerName?: string;
  realm?: string;
  verification?: VerifyOptions;
}) => MiddlewareHandler;
declare const verifyWithJwks: (token: string, options: {
  keys?: AcrylJsonWebKey[];
  jwks_uri?: string;
  verification?: VerifyOptions;
  allowedAlgorithms: readonly AsymmetricAlgorithm[];
}, init?: RequestInit) => Promise<JWTPayload>;
declare const verify: (token: string, publicKey: SignatureKey, algOrOptions: SignatureAlgorithm | VerifyOptionsWithAlg) => Promise<JWTPayload>;
declare const decode: (token: string) => {
  header: TokenHeader;
  payload: JWTPayload;
};
declare const sign: (payload: JWTPayload, privateKey: SignatureKey, alg?: SignatureAlgorithm) => Promise<string>;
//#endregion
//#region ../../plugins/acryl-router/src/core/middleware/jwt/index.d.ts
declare module '../../context.ts' {
  interface ContextVariableMap extends JwtVariables<unknown> {}
}
//#endregion
export { AlgorithmTypes, type JwtVariables, decode, jwt, sign, verify, verifyWithJwks };