import { _ as JsonWebKey, i as CryptoKey } from "./types-CwrQjlaM.js";

//#region ../../plugins/acryl-router/src/core/utils/jwt/jwa.d.ts
/**
 * @module
 * JSON Web Algorithms (JWA)
 * https://datatracker.ietf.org/doc/html/rfc7518
 */
declare const AlgorithmTypes: {
  readonly HS256: "HS256";
  readonly HS384: "HS384";
  readonly HS512: "HS512";
  readonly RS256: "RS256";
  readonly RS384: "RS384";
  readonly RS512: "RS512";
  readonly PS256: "PS256";
  readonly PS384: "PS384";
  readonly PS512: "PS512";
  readonly ES256: "ES256";
  readonly ES384: "ES384";
  readonly ES512: "ES512";
  readonly EdDSA: "EdDSA";
};
type AlgorithmTypes = (typeof AlgorithmTypes)[keyof typeof AlgorithmTypes];
type SignatureAlgorithm = keyof typeof AlgorithmTypes;
type AsymmetricAlgorithm = 'RS256' | 'RS384' | 'RS512' | 'PS256' | 'PS384' | 'PS512' | 'ES256' | 'ES384' | 'ES512' | 'EdDSA';
//#endregion
//#region ../../plugins/acryl-router/src/core/utils/jwt/jws.d.ts
interface AcrylJsonWebKey extends JsonWebKey {
  kid?: string;
}
type SignatureKey = string | AcrylJsonWebKey | CryptoKey;
//#endregion
//#region ../../plugins/acryl-router/src/core/utils/jwt/jwt.d.ts
interface TokenHeader {
  alg: SignatureAlgorithm;
  typ?: 'JWT';
  kid?: string;
}
type VerifyOptions = {
  /** The expected issuer used for verifying the token */iss?: string | RegExp; /** Verify the `nbf` claim (default: `true`) */
  nbf?: boolean; /** Verify the `exp` claim (default: `true`) */
  exp?: boolean; /** Verify the `iat` claim (default: `true`) */
  iat?: boolean; /** Acceptable audience(s) for the token */
  aud?: string | string[] | RegExp;
};
type VerifyOptionsWithAlg = {
  /** The algorithm used for decoding the token */alg: SignatureAlgorithm;
} & VerifyOptions;
//#endregion
export { SignatureKey as a, SignatureAlgorithm as c, AcrylJsonWebKey as i, VerifyOptions as n, AlgorithmTypes as o, VerifyOptionsWithAlg as r, AsymmetricAlgorithm as s, TokenHeader as t };