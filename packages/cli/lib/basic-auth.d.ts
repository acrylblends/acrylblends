import { I as MiddlewareHandler, t as Context } from "./context-B5Y1lLha.js";

//#region ../../plugins/acryl-router/src/core/middleware/basic-auth/index.d.ts
type MessageFunction = (c: Context) => string | object | Promise<string | object>;
type BasicAuthOptions = {
  username: string;
  password: string;
  realm?: string;
  hashFunction?: Function;
  invalidUserMessage?: string | object | MessageFunction;
  onAuthSuccess?: (c: Context, username: string) => void | Promise<void>;
} | {
  verifyUser: (username: string, password: string, c: Context) => boolean | Promise<boolean>;
  realm?: string;
  hashFunction?: Function;
  invalidUserMessage?: string | object | MessageFunction;
  onAuthSuccess?: (c: Context, username: string) => void | Promise<void>;
};
/**
 * Basic Auth Middleware for Acryl.
 *
 *
 * @param {BasicAuthOptions} options - The options for the basic authentication middleware.
 * @param {string} options.username - The username for authentication.
 * @param {string} options.password - The password for authentication.
 * @param {string} [options.realm="Secure Area"] - The realm attribute for the WWW-Authenticate header.
 * @param {Function} [options.hashFunction] - The hash function used for secure comparison.
 * @param {Function} [options.verifyUser] - The function to verify user credentials.
 * @param {string | object | MessageFunction} [options.invalidUserMessage="Unauthorized"] - The invalid user message.
 * @param {Function} [options.onAuthSuccess] - Callback function called on successful authentication.
 * @returns {MiddlewareHandler} The middleware handler function.
 * @throws {HTTPException} If neither "username and password" nor "verifyUser" options are provided.
 *
 * @example
 * ```ts
 * const app = new Acryl()
 *
 * app.use(
 *   '/auth/*',
 *   basicAuth({
 *     username: process.env.BASIC_AUTH_USERNAME,
 *     password: process.env.BASIC_AUTH_PASSWORD,
 *   })
 * )
 *
 * app.get('/auth/page', (c) => {
 *   return c.text('You are authorized')
 * })
 * ```
 *
 * @example
 * ```ts
 * // With onAuthSuccess callback
 * app.use(
 *   '/auth/*',
 *   basicAuth({
 *     username: process.env.BASIC_AUTH_USERNAME,
 *     password: process.env.BASIC_AUTH_PASSWORD,
 *     onAuthSuccess: (c, username) => {
 *       c.set('user', { name: username, role: 'admin' })
 *       console.log(`User ${username} authenticated`)
 *     },
 *   })
 * )
 * ```
 */
declare const basicAuth: (options: BasicAuthOptions, ...users: {
  username: string;
  password: string;
}[]) => MiddlewareHandler;
//#endregion
export { basicAuth };