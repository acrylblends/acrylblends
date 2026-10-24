//#region ../../plugins/acryl-router/src/core/utils/jwt/types.d.ts
/**
 * JWT Payload
 */
type JWTPayload = {
  [key: string]: unknown;
  /**
   * The token is checked to ensure it has not expired.
   */
  exp?: number;
  /**
   * The token is checked to ensure it is not being used before a specified time.
   */
  nbf?: number;
  /**
   * The token is checked to ensure it is not issued in the future.
   */
  iat?: number;
  /**
   * The token is checked to ensure it has been issued by a trusted issuer.
   */
  iss?: string;
  /**
   * The token is checked to ensure it is intended for a specific audience.
   */
  aud?: string | string[];
};
//#endregion
export { JWTPayload as t };