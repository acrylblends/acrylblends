import { a as SignatureKey, c as SignatureAlgorithm, i as AcrylJsonWebKey, n as VerifyOptions, r as VerifyOptionsWithAlg, s as AsymmetricAlgorithm, t as TokenHeader } from "../jwt-BA65QhnJ.js";
import { t as JWTPayload } from "../types-DR95J00T.js";

//#region ../../plugins/acryl-router/src/core/utils/jwt/index.d.ts
/**
 * @module
 * JWT utility.
 */
declare const Jwt: {
  sign: (payload: JWTPayload, privateKey: SignatureKey, alg?: SignatureAlgorithm) => Promise<string>;
  verify: (token: string, publicKey: SignatureKey, algOrOptions: SignatureAlgorithm | VerifyOptionsWithAlg) => Promise<JWTPayload>;
  decode: (token: string) => {
    header: TokenHeader;
    payload: JWTPayload;
  };
  verifyWithJwks: (token: string, options: {
    keys?: AcrylJsonWebKey[];
    jwks_uri?: string;
    verification?: VerifyOptions;
    allowedAlgorithms: readonly AsymmetricAlgorithm[];
  }, init?: RequestInit) => Promise<JWTPayload>;
};
//#endregion
export { Jwt };