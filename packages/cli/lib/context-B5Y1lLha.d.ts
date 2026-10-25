import { c as Result, l as Router } from "./router-CvUxUTOq.js";
import { i as ResponseHeader, n as CustomHeader, r as RequestHeader } from "./headers-tu2YYN8T.js";
import { c as StatusCode, n as ContentfulStatusCode, o as RedirectStatusCode } from "./http-status-DaAwGAFL.js";
import { C as Simplify, E as UnionToIntersection, _ as JSONValue, d as InvalidJSONValue, f as IsAny, h as JSONParsed, l as IfAnyThenEmptyObject, x as RemoveBlankRecord } from "./types-D9DEXMjE.js";
import { t as BaseMime } from "./mime-BQOYHl-l.js";

//#region ../../plugins/acryl-router/src/core/request/constants.d.ts
declare const GET_MATCH_RESULT: unique symbol;
//#endregion
//#region ../../plugins/acryl-router/src/core/app-base.d.ts
type GetPath<E extends Env> = (request: Request, options?: {
  env?: E['Bindings'];
}) => string;
type AcrylOptions<E extends Env> = {
  /**
   * `router` option specifies which router to use.
   *
   *
   * @example
   * ```ts
   * const app = new Acryl({ router: new RegExpRouter() })
   * ```
   */
  router?: Router<[H, RouterRoute]>;
} & ({
  /**
   * `strict` option specifies whether to distinguish whether the last path is a directory or not.
   *
   *
   * @default true
   */
  strict?: true;
  /**
   * `getPath` can handle the host header value.
   *
   *
   * @example
   * ```ts
   * const app = new Acryl({
   *  getPath: (req) =>
   *   '/' + req.headers.get('host') + req.url.replace(/^https?:\/\/[^/]+(\/[^?]*)/, '$1'),
   * })
   *
   * app.get('/www1.example.com/hello', () => c.text('hello www1'))
   *
   * // A following request will match the route:
   * // new Request('http://www1.example.com/hello', {
   * //  headers: { host: 'www1.example.com' },
   * // })
   * ```
   */
  getPath?: GetPath<E>;
} | {
  /**
   * `strict` option specifies whether to distinguish whether the last path is a directory or not.
   * When `strict` is `false`, `getPath` is not used.
   *
   *
   * @default true
   */
  strict: false;
  getPath?: never;
});
type MountOptionHandler = (c: Context) => unknown;
type MountReplaceRequest = (originalRequest: Request) => Request;
type MountOptions = MountOptionHandler | {
  optionHandler?: MountOptionHandler;
  replaceRequest?: MountReplaceRequest | false;
};
declare class Acryl<E extends Env = Env, S extends Schema = {}, BasePath extends string = '/', CurrentPath extends string = BasePath> {
  #private;
  get: HandlerInterface<E, 'get', S, BasePath, CurrentPath>;
  post: HandlerInterface<E, 'post', S, BasePath, CurrentPath>;
  put: HandlerInterface<E, 'put', S, BasePath, CurrentPath>;
  delete: HandlerInterface<E, 'delete', S, BasePath, CurrentPath>;
  options: HandlerInterface<E, 'options', S, BasePath, CurrentPath>;
  patch: HandlerInterface<E, 'patch', S, BasePath, CurrentPath>;
  query: HandlerInterface<E, 'query', S, BasePath, CurrentPath>;
  all: HandlerInterface<E, 'all', S, BasePath, CurrentPath>;
  on: OnHandlerInterface<E, S, BasePath>;
  use: MiddlewareHandlerInterface<E, S, BasePath>;
  router: Router<[H, RouterRoute]>;
  readonly getPath: GetPath<E>;
  private _basePath;
  routes: RouterRoute[];
  constructor(options?: AcrylOptions<E>);
  private errorHandler;
  /**
   * `.route()` allows grouping other Acryl instance in routes.
   *
   *
   * @param {string} path - base Path
   * @param {Acryl} app - other Acryl instance
   * @returns {Acryl} routed Acryl instance
   *
   * @example
   * ```ts
   * const app = new Acryl()
   * const app2 = new Acryl()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route<SubPath extends string, SubEnv extends Env, SubSchema extends Schema, SubBasePath extends string, SubCurrentPath extends string>(path: SubPath, app: Acryl<SubEnv, SubSchema, SubBasePath, SubCurrentPath>): Acryl<E, MergeSchemaPath<SubSchema, MergePath<BasePath, SubPath>> | S, BasePath, CurrentPath>;
  /**
   * `.basePath()` allows base paths to be specified.
   *
   *
   * @param {string} path - base Path
   * @returns {Acryl} changed Acryl instance
   *
   * @example
   * ```ts
   * const api = new Acryl().basePath('/api')
   * ```
   */
  basePath<SubPath extends string>(path: SubPath): Acryl<E, S, MergePath<BasePath, SubPath>, MergePath<BasePath, SubPath>>;
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Acryl} changed Acryl instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError: (handler: ErrorHandler<E>) => Acryl<E, S, BasePath, CurrentPath>;
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Acryl} changed Acryl instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound: (handler: NotFoundHandler<E>) => Acryl<E, S, BasePath, CurrentPath>;
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Acryl application.
   *
   * @deprecated Use `mount()` from `acryl-router/mount` instead. `.mount()` will be removed in v5.
   *
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Acryl} mounted Acryl instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Acryl } from 'acrylblends'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Acryl()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Acryl()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path: string, applicationHandler: (request: Request, ...args: any) => Response | Promise<Response>, options?: MountOptions): Acryl<E, S, BasePath, CurrentPath>;
  /**
   * `.fetch()` will be entry point of your app.
   *
   *
   * @param {Request} request - request Object of request
   * @param {Env} env - env Object
   * @param {ExecutionContext} executionCtx - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch: (request: Request, env?: E['Bindings'] | {}, executionCtx?: ExecutionContext) => Response | Promise<Response>;
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   */
  request: (input: Request | string | URL, requestInit?: RequestInit, Env?: E["Bindings"] | {}, executionCtx?: ExecutionContext) => Response | Promise<Response>;
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * ACRYL ships no service-worker adapter: mount the app with `ctx.router.route(path, app)` and serve it through an ACRYL adapter instead.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire: () => void;
}
//#endregion
//#region ../../plugins/acryl-router/src/core/types.d.ts
type Bindings = object;
type Variables = object;
type BlankEnv = {};
type Env = {
  Bindings?: Bindings;
  Variables?: Variables;
};
type Next = () => Promise<void>;
type ExtractInput<I extends Input | Input['in']> = I extends Input ? unknown extends I['in'] ? {} : I['in'] : I;
type Input = {
  in?: {};
  out?: {};
  outputFormat?: ResponseFormat;
};
type BlankSchema = {};
type BlankInput = {};
interface RouterRoute {
  basePath: string;
  path: string;
  method: string;
  handler: H;
}
type HandlerResponse<O> = Response | TypedResponse<O> | Promise<Response | TypedResponse<O>> | Promise<void>;
type Handler<E extends Env = any, P extends string = any, I extends Input = BlankInput, R extends HandlerResponse<any> = any> = (c: Context<E, P, I>, next: Next) => R;
type MiddlewareHandler<E extends Env = any, P extends string = string, I extends Input = {}, R extends HandlerResponse<any> = Response> = (c: Context<E, P, I>, next: Next) => Promise<R | void>;
type H<E extends Env = any, P extends string = any, I extends Input = BlankInput, R extends HandlerResponse<any> = any> = Handler<E, P, I, R> | MiddlewareHandler<E, P, I, R>;
/**
 * You can extend this interface to define a custom `c.notFound()` Response type.
 *
 * @example
 * declare module 'acrylblends' {
 *   interface NotFoundResponse extends Response, TypedResponse<string, 404, 'text'> {}
 * }
 */
interface NotFoundResponse {}
type NotFoundHandler<E extends Env = any> = (c: Context<E>) => NotFoundResponse extends Response ? NotFoundResponse | Promise<NotFoundResponse> : Response | Promise<Response>;
interface HTTPResponseError extends Error {
  getResponse: () => Response;
}
type ErrorHandler<E extends Env = any> = (err: Error | HTTPResponseError, c: Context<E>) => Response | Promise<Response>;
interface HandlerInterface<E extends Env = Env, M extends string = string, S extends Schema = BlankSchema, BasePath extends string = '/', CurrentPath extends string = BasePath> {
  <P extends string = CurrentPath, I extends Input = BlankInput, R extends HandlerResponse<any> = any, E2 extends Env = E>(handler: H<E2, P, I, R>): Acryl<IntersectNonAnyTypes<[E, E2]>, S & ToSchema<M, P, I, MergeTypedResponse<R>>, BasePath, CurrentPath>;
  <P extends string = CurrentPath, I extends Input = BlankInput, I2 extends Input = I, R extends HandlerResponse<any> = any, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, M1 extends H<E2, P, I> = H<E2, P, I>>(...handlers: [H<E2, P, I> & M1, H<E3, P, I2, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3]>, S & ToSchema<M, P, I2, MergeTypedResponse<R> | MergeMiddlewareResponse<M1>>, BasePath, CurrentPath>;
  <P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, E2 extends Env = E>(path: P, handler: H<E2, MergedPath, I, R>): Acryl<E, AddSchemaIfHasResponse<MergeTypedResponse<R>, S, M, P, I, BasePath>, BasePath, MergePath<BasePath, P>>;
  <P extends string = CurrentPath, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, M1 extends H<E2, P, I> = H<E2, P, I>, M2 extends H<E3, P, I2> = H<E3, P, I2>>(...handlers: [H<E2, P, I> & M1, H<E3, P, I2> & M2, H<E4, P, I3, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4]>, S & ToSchema<M, P, I3, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2>>, BasePath, CurrentPath>;
  <P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>>(path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2, R>]): Acryl<E, AddSchemaIfHasResponse<MergeTypedResponse<R> | MergeMiddlewareResponse<M1>, S, M, P, I2, BasePath>, BasePath, MergePath<BasePath, P>>;
  <P extends string = CurrentPath, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, M1 extends H<E2, P, I> = H<E2, P, I>, M2 extends H<E3, P, I2> = H<E3, P, I2>, M3 extends H<E4, P, I3> = H<E4, P, I3>>(...handlers: [H<E2, P, I> & M1, H<E3, P, I2> & M2, H<E4, P, I3> & M3, H<E5, P, I4, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, S & ToSchema<M, P, I4, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3>>, BasePath, CurrentPath>;
  <P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>>(path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3, R>]): Acryl<E, AddSchemaIfHasResponse<MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2>, S, M, P, I3, BasePath>, BasePath, MergePath<BasePath, P>>;
  <P extends string = CurrentPath, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, M1 extends H<E2, P, I> = H<E2, P, I>, M2 extends H<E3, P, I2> = H<E3, P, I2>, M3 extends H<E4, P, I3> = H<E4, P, I3>, M4 extends H<E5, P, I4> = H<E5, P, I4>>(...handlers: [H<E2, P, I> & M1, H<E3, P, I2> & M2, H<E4, P, I3> & M3, H<E5, P, I4> & M4, H<E6, P, I5, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, S & ToSchema<M, P, I5, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4>>, BasePath, CurrentPath>;
  <P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>>(path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4, R>]): Acryl<E, AddSchemaIfHasResponse<MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3>, S, M, P, I4, BasePath>, BasePath, MergePath<BasePath, P>>;
  <P extends string = CurrentPath, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, M1 extends H<E2, P, I> = H<E2, P, I>, M2 extends H<E3, P, I2> = H<E3, P, I2>, M3 extends H<E4, P, I3> = H<E4, P, I3>, M4 extends H<E5, P, I4> = H<E5, P, I4>, M5 extends H<E6, P, I5> = H<E6, P, I5>>(...handlers: [H<E2, P, I> & M1, H<E3, P, I2> & M2, H<E4, P, I3> & M3, H<E5, P, I4> & M4, H<E6, P, I5> & M5, H<E7, P, I6, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, S & ToSchema<M, P, I6, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5>>, BasePath, CurrentPath>;
  <P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>, M4 extends H<E5, MergedPath, I4> = H<E5, MergedPath, I4>>(path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4> & M4, H<E6, MergedPath, I5, R>]): Acryl<E, AddSchemaIfHasResponse<MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4>, S, M, P, I5, BasePath>, BasePath, MergePath<BasePath, P>>;
  <P extends string = CurrentPath, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, I7 extends Input = I & I2 & I3 & I4 & I5 & I6, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, M1 extends H<E2, P, I> = H<E2, P, I>, M2 extends H<E3, P, I2> = H<E3, P, I2>, M3 extends H<E4, P, I3> = H<E4, P, I3>, M4 extends H<E5, P, I4> = H<E5, P, I4>, M5 extends H<E6, P, I5> = H<E6, P, I5>, M6 extends H<E7, P, I6> = H<E7, P, I6>>(...handlers: [H<E2, P, I> & M1, H<E3, P, I2> & M2, H<E4, P, I3> & M3, H<E5, P, I4> & M4, H<E6, P, I5> & M5, H<E7, P, I6> & M6, H<E8, P, I7, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, S & ToSchema<M, P, I7, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5> | MergeMiddlewareResponse<M6>>, BasePath, CurrentPath>;
  <P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>, M4 extends H<E5, MergedPath, I4> = H<E5, MergedPath, I4>, M5 extends H<E6, MergedPath, I5> = H<E6, MergedPath, I5>>(path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4> & M4, H<E6, MergedPath, I5> & M5, H<E7, MergedPath, I6, R>]): Acryl<E, AddSchemaIfHasResponse<MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5>, S, M, P, I6, BasePath>, BasePath, MergePath<BasePath, P>>;
  <P extends string = CurrentPath, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, I7 extends Input = I & I2 & I3 & I4 & I5 & I6, I8 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, E9 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, M1 extends H<E2, P, I> = H<E2, P, I>, M2 extends H<E3, P, I2> = H<E3, P, I2>, M3 extends H<E4, P, I3> = H<E4, P, I3>, M4 extends H<E5, P, I4> = H<E5, P, I4>, M5 extends H<E6, P, I5> = H<E6, P, I5>, M6 extends H<E7, P, I6> = H<E7, P, I6>, M7 extends H<E8, P, I7> = H<E8, P, I7>>(...handlers: [H<E2, P, I> & M1, H<E3, P, I2> & M2, H<E4, P, I3> & M3, H<E5, P, I4> & M4, H<E6, P, I5> & M5, H<E7, P, I6> & M6, H<E8, P, I7> & M7, H<E9, P, I8, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9]>, S & ToSchema<M, P, I8, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5> | MergeMiddlewareResponse<M6> | MergeMiddlewareResponse<M7>>, BasePath, CurrentPath>;
  <P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, I7 extends Input = I & I2 & I3 & I4 & I5 & I6, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>, M4 extends H<E5, MergedPath, I4> = H<E5, MergedPath, I4>, M5 extends H<E6, MergedPath, I5> = H<E6, MergedPath, I5>, M6 extends H<E7, MergedPath, I6> = H<E7, MergedPath, I6>>(path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4> & M4, H<E6, MergedPath, I5> & M5, H<E7, MergedPath, I6> & M6, H<E8, MergedPath, I7, R>]): Acryl<E, AddSchemaIfHasResponse<MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5> | MergeMiddlewareResponse<M6>, S, M, P, I7, BasePath>, BasePath, MergePath<BasePath, P>>;
  <P extends string = CurrentPath, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, I7 extends Input = I & I2 & I3 & I4 & I5 & I6, I8 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7, I9 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7 & I8, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, E9 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, E10 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9]>, M1 extends H<E2, P, I> = H<E2, P, I>, M2 extends H<E3, P, I2> = H<E3, P, I2>, M3 extends H<E4, P, I3> = H<E4, P, I3>, M4 extends H<E5, P, I4> = H<E5, P, I4>, M5 extends H<E6, P, I5> = H<E6, P, I5>, M6 extends H<E7, P, I6> = H<E7, P, I6>, M7 extends H<E8, P, I7> = H<E8, P, I7>, M8 extends H<E9, P, I8> = H<E9, P, I8>>(...handlers: [H<E2, P, I> & M1, H<E3, P, I2> & M2, H<E4, P, I3> & M3, H<E5, P, I4> & M4, H<E6, P, I5> & M5, H<E7, P, I6> & M6, H<E8, P, I7> & M7, H<E9, P, I8> & M8, H<E10, P, I9, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9, E10]>, S & ToSchema<M, P, I9, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5> | MergeMiddlewareResponse<M6> | MergeMiddlewareResponse<M7> | MergeMiddlewareResponse<M8>>, BasePath, CurrentPath>;
  <P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, I7 extends Input = I & I2 & I3 & I4 & I5 & I6, I8 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, E9 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>, M4 extends H<E5, MergedPath, I4> = H<E5, MergedPath, I4>, M5 extends H<E6, MergedPath, I5> = H<E6, MergedPath, I5>, M6 extends H<E7, MergedPath, I6> = H<E7, MergedPath, I6>, M7 extends H<E8, MergedPath, I7> = H<E8, MergedPath, I7>>(path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4> & M4, H<E6, MergedPath, I5> & M5, H<E7, MergedPath, I6> & M6, H<E8, MergedPath, I7> & M7, H<E9, MergedPath, I8, R>]): Acryl<E, AddSchemaIfHasResponse<MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5> | MergeMiddlewareResponse<M6> | MergeMiddlewareResponse<M7>, S, M, P, I8, BasePath>, BasePath, MergePath<BasePath, P>>;
  <P extends string = CurrentPath, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, I7 extends Input = I & I2 & I3 & I4 & I5 & I6, I8 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7, I9 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7 & I8, I10 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7 & I8 & I9, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, E9 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, E10 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9]>, E11 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9, E10]>, M1 extends H<E2, P, I> = H<E2, P, I>, M2 extends H<E3, P, I2> = H<E3, P, I2>, M3 extends H<E4, P, I3> = H<E4, P, I3>, M4 extends H<E5, P, I4> = H<E5, P, I4>, M5 extends H<E6, P, I5> = H<E6, P, I5>, M6 extends H<E7, P, I6> = H<E7, P, I6>, M7 extends H<E8, P, I7> = H<E8, P, I7>, M8 extends H<E9, P, I8> = H<E9, P, I8>, M9 extends H<E10, P, I9> = H<E10, P, I9>>(...handlers: [H<E2, P, I> & M1, H<E3, P, I2> & M2, H<E4, P, I3> & M3, H<E5, P, I4> & M4, H<E6, P, I5> & M5, H<E7, P, I6> & M6, H<E8, P, I7> & M7, H<E9, P, I8> & M8, H<E10, P, I9> & M9, H<E11, P, I10, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9, E10, E11]>, S & ToSchema<M, P, I10, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5> | MergeMiddlewareResponse<M6> | MergeMiddlewareResponse<M7> | MergeMiddlewareResponse<M8> | MergeMiddlewareResponse<M9>>, BasePath, CurrentPath>;
  <P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, I7 extends Input = I & I2 & I3 & I4 & I5 & I6, I8 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7, I9 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7 & I8, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, E9 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, E10 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>, M4 extends H<E5, MergedPath, I4> = H<E5, MergedPath, I4>, M5 extends H<E6, MergedPath, I5> = H<E6, MergedPath, I5>, M6 extends H<E7, MergedPath, I6> = H<E7, MergedPath, I6>, M7 extends H<E8, MergedPath, I7> = H<E8, MergedPath, I7>, M8 extends H<E9, MergedPath, I8> = H<E9, MergedPath, I8>>(path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4> & M4, H<E6, MergedPath, I5> & M5, H<E7, MergedPath, I6> & M6, H<E8, MergedPath, I7> & M7, H<E9, MergedPath, I8> & M8, H<E10, MergedPath, I9, R>]): Acryl<E, AddSchemaIfHasResponse<MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5> | MergeMiddlewareResponse<M6> | MergeMiddlewareResponse<M7> | MergeMiddlewareResponse<M8>, S, M, P, I9, BasePath>, BasePath, MergePath<BasePath, P>>;
  <P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, I7 extends Input = I & I2 & I3 & I4 & I5 & I6, I8 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7, I9 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7 & I8, I10 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7 & I8 & I9, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, E9 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, E10 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9]>, E11 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9, E10]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>, M4 extends H<E5, MergedPath, I4> = H<E5, MergedPath, I4>, M5 extends H<E6, MergedPath, I5> = H<E6, MergedPath, I5>, M6 extends H<E7, MergedPath, I6> = H<E7, MergedPath, I6>, M7 extends H<E8, MergedPath, I7> = H<E8, MergedPath, I7>, M8 extends H<E9, MergedPath, I8> = H<E9, MergedPath, I8>, M9 extends H<E10, MergedPath, I9> = H<E10, MergedPath, I9>>(path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4> & M4, H<E6, MergedPath, I5> & M5, H<E7, MergedPath, I6> & M6, H<E8, MergedPath, I7> & M7, H<E9, MergedPath, I8> & M8, H<E10, MergedPath, I9> & M9, H<E11, MergedPath, I10, R>]): Acryl<E, AddSchemaIfHasResponse<MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5> | MergeMiddlewareResponse<M6> | MergeMiddlewareResponse<M7> | MergeMiddlewareResponse<M8> | MergeMiddlewareResponse<M9>, S, M, P, I10, BasePath>, BasePath, MergePath<BasePath, P>>;
  <P extends string = CurrentPath, I extends Input = BlankInput, R extends HandlerResponse<any> = any>(...handlers: H<E, P, I, R>[]): Acryl<E, S & ToSchema<M, P, I, MergeTypedResponse<R>>, BasePath, CurrentPath>;
  <P extends string, I extends Input = BlankInput, R extends HandlerResponse<any> = any>(path: P, ...handlers: [H<E, MergePath<BasePath, P>, I, R>, ...H<E, MergePath<BasePath, P>, I, R>[]]): Acryl<E, S & ToSchema<M, MergePath<BasePath, P>, I, MergeTypedResponse<R>>, BasePath, MergePath<BasePath, P>>;
  <P extends string, R extends HandlerResponse<any> = any, I extends Input = BlankInput>(path: P): Acryl<E, S & ToSchema<M, MergePath<BasePath, P>, I, MergeTypedResponse<R>>, BasePath, MergePath<BasePath, P>>;
}
interface MiddlewareHandlerInterface<E extends Env = Env, S extends Schema = BlankSchema, BasePath extends string = '/'> {
  <E2 extends Env = E>(...handlers: MiddlewareHandler<E2, MergePath<BasePath, '*'>>[]): Acryl<IntersectNonAnyTypes<[E, E2]>, S, BasePath, MergePath<BasePath, '*'>>;
  <E2 extends Env = E>(handler: MiddlewareHandler<E2, MergePath<BasePath, '*'>>): Acryl<IntersectNonAnyTypes<[E, E2]>, S, BasePath, MergePath<BasePath, '*'>>;
  <E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, P extends string = MergePath<BasePath, '*'>>(...handlers: [MiddlewareHandler<E2, P>, MiddlewareHandler<E3, P>]): Acryl<IntersectNonAnyTypes<[E, E2, E3]>, S, BasePath, P>;
  <P extends string, MergedPath extends MergePath<BasePath, P>, E2 extends Env = E>(path: P, handler: MiddlewareHandler<E2, MergedPath, any, any>): Acryl<IntersectNonAnyTypes<[E, E2]>, S, BasePath, MergedPath>;
  <E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, P extends string = MergePath<BasePath, '*'>>(...handlers: [MiddlewareHandler<E2, P, any, any>, MiddlewareHandler<E3, P, any, any>, MiddlewareHandler<E4, P, any, any>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4]>, S, BasePath, P>;
  <P extends string, MergedPath extends MergePath<BasePath, P>, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>>(path: P, ...handlers: [MiddlewareHandler<E2, P>, MiddlewareHandler<E3, P>]): Acryl<IntersectNonAnyTypes<[E, E2, E3]>, S, BasePath, MergedPath>;
  <E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, P extends string = MergePath<BasePath, '*'>>(...handlers: [MiddlewareHandler<E2, P>, MiddlewareHandler<E3, P>, MiddlewareHandler<E4, P>, MiddlewareHandler<E5, P>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, S, BasePath, P>;
  <P extends string, MergedPath extends MergePath<BasePath, P>, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>>(path: P, ...handlers: [MiddlewareHandler<E2, P>, MiddlewareHandler<E3, P>, MiddlewareHandler<E4, P>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4]>, S, BasePath, MergedPath>;
  <E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, P extends string = MergePath<BasePath, '*'>>(...handlers: [MiddlewareHandler<E2, P>, MiddlewareHandler<E3, P>, MiddlewareHandler<E4, P>, MiddlewareHandler<E5, P>, MiddlewareHandler<E6, P>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, S, BasePath, P>;
  <P extends string, MergedPath extends MergePath<BasePath, P>, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>>(path: P, ...handlers: [MiddlewareHandler<E2, P>, MiddlewareHandler<E3, P>, MiddlewareHandler<E4, P>, MiddlewareHandler<E5, P>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, S, BasePath, MergedPath>;
  <E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, P extends string = MergePath<BasePath, '*'>>(...handlers: [MiddlewareHandler<E2, P>, MiddlewareHandler<E3, P>, MiddlewareHandler<E4, P>, MiddlewareHandler<E5, P>, MiddlewareHandler<E6, P>, MiddlewareHandler<E7, P>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, S, BasePath, P>;
  <P extends string, MergedPath extends MergePath<BasePath, P>, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>>(path: P, ...handlers: [MiddlewareHandler<E2, P>, MiddlewareHandler<E3, P>, MiddlewareHandler<E4, P>, MiddlewareHandler<E5, P>, MiddlewareHandler<E6, P>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, S, BasePath, MergedPath>;
  <E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, P extends string = MergePath<BasePath, '*'>>(...handlers: [MiddlewareHandler<E2, P>, MiddlewareHandler<E3, P>, MiddlewareHandler<E4, P>, MiddlewareHandler<E5, P>, MiddlewareHandler<E6, P>, MiddlewareHandler<E7, P>, MiddlewareHandler<E8, P>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, S, BasePath, P>;
  <P extends string, MergedPath extends MergePath<BasePath, P>, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>>(path: P, ...handlers: [MiddlewareHandler<E2, P>, MiddlewareHandler<E3, P>, MiddlewareHandler<E4, P>, MiddlewareHandler<E5, P>, MiddlewareHandler<E6, P>, MiddlewareHandler<E7, P>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, S, BasePath, MergedPath>;
  <E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, E9 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, P extends string = MergePath<BasePath, '*'>>(...handlers: [MiddlewareHandler<E2, P>, MiddlewareHandler<E3, P>, MiddlewareHandler<E4, P>, MiddlewareHandler<E5, P>, MiddlewareHandler<E6, P>, MiddlewareHandler<E7, P>, MiddlewareHandler<E8, P>, MiddlewareHandler<E9, P>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9]>, S, BasePath, P>;
  <P extends string, MergedPath extends MergePath<BasePath, P>, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>>(path: P, ...handlers: [MiddlewareHandler<E2, P>, MiddlewareHandler<E3, P>, MiddlewareHandler<E4, P>, MiddlewareHandler<E5, P>, MiddlewareHandler<E6, P>, MiddlewareHandler<E7, P>, MiddlewareHandler<E8, P>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, S, BasePath, MergedPath>;
  <E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, E9 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, E10 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9]>, P extends string = MergePath<BasePath, '*'>>(...handlers: [MiddlewareHandler<E2, P>, MiddlewareHandler<E3, P>, MiddlewareHandler<E4, P>, MiddlewareHandler<E5, P>, MiddlewareHandler<E6, P>, MiddlewareHandler<E7, P>, MiddlewareHandler<E8, P>, MiddlewareHandler<E9, P>, MiddlewareHandler<E10, P>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9, E10]>, S, BasePath, P>;
  <P extends string, MergedPath extends MergePath<BasePath, P>, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, E9 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>>(path: P, ...handlers: [MiddlewareHandler<E2, P>, MiddlewareHandler<E3, P>, MiddlewareHandler<E4, P>, MiddlewareHandler<E5, P>, MiddlewareHandler<E6, P>, MiddlewareHandler<E7, P>, MiddlewareHandler<E8, P>, MiddlewareHandler<E9, P>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9]>, S, BasePath, MergedPath>;
  <E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, E9 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, E10 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9]>, E11 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9, E10]>, P extends string = MergePath<BasePath, '*'>>(...handlers: [MiddlewareHandler<E2, P>, MiddlewareHandler<E3, P>, MiddlewareHandler<E4, P>, MiddlewareHandler<E5, P>, MiddlewareHandler<E6, P>, MiddlewareHandler<E7, P>, MiddlewareHandler<E8, P>, MiddlewareHandler<E9, P>, MiddlewareHandler<E10, P>, MiddlewareHandler<E11, P>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9, E10, E11]>, S, BasePath, P>;
  <P extends string, MergedPath extends MergePath<BasePath, P>, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, E9 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, E10 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9]>>(path: P, ...handlers: [MiddlewareHandler<E2, P>, MiddlewareHandler<E3, P>, MiddlewareHandler<E4, P>, MiddlewareHandler<E5, P>, MiddlewareHandler<E6, P>, MiddlewareHandler<E7, P>, MiddlewareHandler<E8, P>, MiddlewareHandler<E9, P>, MiddlewareHandler<E10, P>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9, E10]>, S, BasePath, MergedPath>;
  <P extends string, E2 extends Env = E>(path: P, ...handlers: MiddlewareHandler<E2, MergePath<BasePath, P>>[]): Acryl<E, S, BasePath, MergePath<BasePath, P>>;
}
interface OnHandlerInterface<E extends Env = Env, S extends Schema = BlankSchema, BasePath extends string = '/'> {
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, E2 extends Env = E>(method: M, path: P, handler: H<E2, MergedPath, I, R>): Acryl<IntersectNonAnyTypes<[E, E2]>, S & ToSchema<M, MergePath<BasePath, P>, I, MergeTypedResponse<R>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>>(method: M, path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3]>, S & ToSchema<M, MergePath<BasePath, P>, I2, MergeTypedResponse<R> | MergeMiddlewareResponse<M1>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>>(method: M, path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4]>, S & ToSchema<M, MergePath<BasePath, P>, I3, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>>(method: M, path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, S & ToSchema<M, MergePath<BasePath, P>, I4, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>, M4 extends H<E5, MergedPath, I4> = H<E5, MergedPath, I4>>(method: M, path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4> & M4, H<E6, MergedPath, I5, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, S & ToSchema<M, MergePath<BasePath, P>, I5, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>, M4 extends H<E5, MergedPath, I4> = H<E5, MergedPath, I4>, M5 extends H<E6, MergedPath, I5> = H<E6, MergedPath, I5>>(method: M, path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4> & M4, H<E6, MergedPath, I5> & M5, H<E7, MergedPath, I6, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, S & ToSchema<M, MergePath<BasePath, P>, I6, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, I7 extends Input = I & I2 & I3 & I4 & I5 & I6, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>, M4 extends H<E5, MergedPath, I4> = H<E5, MergedPath, I4>, M5 extends H<E6, MergedPath, I5> = H<E6, MergedPath, I5>, M6 extends H<E7, MergedPath, I6> = H<E7, MergedPath, I6>>(method: M, path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4> & M4, H<E6, MergedPath, I5> & M5, H<E7, MergedPath, I6> & M6, H<E8, MergedPath, I7, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, S & ToSchema<M, MergePath<BasePath, P>, I7, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5> | MergeMiddlewareResponse<M6>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, I7 extends Input = I & I2 & I3 & I4 & I5 & I6, I8 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, E9 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>, M4 extends H<E5, MergedPath, I4> = H<E5, MergedPath, I4>, M5 extends H<E6, MergedPath, I5> = H<E6, MergedPath, I5>, M6 extends H<E7, MergedPath, I6> = H<E7, MergedPath, I6>, M7 extends H<E8, MergedPath, I7> = H<E8, MergedPath, I7>>(method: M, path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4> & M4, H<E6, MergedPath, I5> & M5, H<E7, MergedPath, I6> & M6, H<E8, MergedPath, I7> & M7, H<E9, MergedPath, I8, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9]>, S & ToSchema<M, MergePath<BasePath, P>, I8, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5> | MergeMiddlewareResponse<M6> | MergeMiddlewareResponse<M7>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, I7 extends Input = I & I2 & I3 & I4 & I5 & I6, I8 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7, I9 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7 & I8, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, E9 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, E10 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>, M4 extends H<E5, MergedPath, I4> = H<E5, MergedPath, I4>, M5 extends H<E6, MergedPath, I5> = H<E6, MergedPath, I5>, M6 extends H<E7, MergedPath, I6> = H<E7, MergedPath, I6>, M7 extends H<E8, MergedPath, I7> = H<E8, MergedPath, I7>, M8 extends H<E9, MergedPath, I8> = H<E9, MergedPath, I8>>(method: M, path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4> & M4, H<E6, MergedPath, I5> & M5, H<E7, MergedPath, I6> & M6, H<E8, MergedPath, I7> & M7, H<E9, MergedPath, I8> & M8, H<E10, MergedPath, I9, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9, E10]>, S & ToSchema<M, MergePath<BasePath, P>, I9, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5> | MergeMiddlewareResponse<M6> | MergeMiddlewareResponse<M7> | MergeMiddlewareResponse<M8>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, I7 extends Input = I & I2 & I3 & I4 & I5 & I6, I8 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7, I9 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7 & I8, I10 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7 & I8 & I9, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, E9 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, E10 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9]>, E11 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9, E10]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>, M4 extends H<E5, MergedPath, I4> = H<E5, MergedPath, I4>, M5 extends H<E6, MergedPath, I5> = H<E6, MergedPath, I5>, M6 extends H<E7, MergedPath, I6> = H<E7, MergedPath, I6>, M7 extends H<E8, MergedPath, I7> = H<E8, MergedPath, I7>, M8 extends H<E9, MergedPath, I8> = H<E9, MergedPath, I8>, M9 extends H<E10, MergedPath, I9> = H<E10, MergedPath, I9>>(method: M, path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4> & M4, H<E6, MergedPath, I5> & M5, H<E7, MergedPath, I6> & M6, H<E8, MergedPath, I7> & M7, H<E9, MergedPath, I8> & M8, H<E10, MergedPath, I9> & M9, H<E11, MergedPath, I10, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9, E10, E11]>, S & ToSchema<M, MergePath<BasePath, P>, I10, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5> | MergeMiddlewareResponse<M6> | MergeMiddlewareResponse<M7> | MergeMiddlewareResponse<M8> | MergeMiddlewareResponse<M9>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, R extends HandlerResponse<any> = any, I extends Input = BlankInput>(method: M, path: P, ...handlers: [H<E, MergePath<BasePath, P>, I, R>, ...H<E, MergePath<BasePath, P>, I, R>[]]): Acryl<E, S & ToSchema<M, MergePath<BasePath, P>, I, MergeTypedResponse<R>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, E2 extends Env = E>(methods: M[], path: P, handler: H<E2, MergedPath, I, R>): Acryl<IntersectNonAnyTypes<[E, E2]>, S & ToSchema<M, MergePath<BasePath, P>, I, MergeTypedResponse<R>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>>(methods: M[], path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3]>, S & ToSchema<M, MergePath<BasePath, P>, I2, MergeTypedResponse<R> | MergeMiddlewareResponse<M1>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>>(methods: M[], path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4]>, S & ToSchema<M, MergePath<BasePath, P>, I3, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>>(methods: M[], path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, S & ToSchema<M, MergePath<BasePath, P>, I4, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>, M4 extends H<E5, MergedPath, I4> = H<E5, MergedPath, I4>>(methods: M[], path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4> & M4, H<E6, MergedPath, I5, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, S & ToSchema<M, MergePath<BasePath, P>, I5, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>, M4 extends H<E5, MergedPath, I4> = H<E5, MergedPath, I4>, M5 extends H<E6, MergedPath, I5> = H<E6, MergedPath, I5>>(methods: M[], path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4> & M4, H<E6, MergedPath, I5> & M5, H<E7, MergedPath, I6, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, S & ToSchema<M, MergePath<BasePath, P>, I6, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, I7 extends Input = I & I2 & I3 & I4 & I5 & I6, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>, M4 extends H<E5, MergedPath, I4> = H<E5, MergedPath, I4>, M5 extends H<E6, MergedPath, I5> = H<E6, MergedPath, I5>, M6 extends H<E7, MergedPath, I6> = H<E7, MergedPath, I6>>(methods: M[], path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4> & M4, H<E6, MergedPath, I5> & M5, H<E7, MergedPath, I6> & M6, H<E8, MergedPath, I7, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, S & ToSchema<M, MergePath<BasePath, P>, I7, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5> | MergeMiddlewareResponse<M6>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, I7 extends Input = I & I2 & I3 & I4 & I5 & I6, I8 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, E9 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>, M4 extends H<E5, MergedPath, I4> = H<E5, MergedPath, I4>, M5 extends H<E6, MergedPath, I5> = H<E6, MergedPath, I5>, M6 extends H<E7, MergedPath, I6> = H<E7, MergedPath, I6>, M7 extends H<E8, MergedPath, I7> = H<E8, MergedPath, I7>>(methods: M[], path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4> & M4, H<E6, MergedPath, I5> & M5, H<E7, MergedPath, I6> & M6, H<E8, MergedPath, I7> & M7, H<E9, MergedPath, I8, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9]>, S & ToSchema<M, MergePath<BasePath, P>, I8, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5> | MergeMiddlewareResponse<M6> | MergeMiddlewareResponse<M7>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, I7 extends Input = I & I2 & I3 & I4 & I5 & I6, I8 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7, I9 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7 & I8, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, E9 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, E10 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>, M4 extends H<E5, MergedPath, I4> = H<E5, MergedPath, I4>, M5 extends H<E6, MergedPath, I5> = H<E6, MergedPath, I5>, M6 extends H<E7, MergedPath, I6> = H<E7, MergedPath, I6>, M7 extends H<E8, MergedPath, I7> = H<E8, MergedPath, I7>, M8 extends H<E9, MergedPath, I8> = H<E9, MergedPath, I8>>(methods: M[], path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4> & M4, H<E6, MergedPath, I5> & M5, H<E7, MergedPath, I6> & M6, H<E8, MergedPath, I7> & M7, H<E9, MergedPath, I8> & M8, H<E10, MergedPath, I9, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9, E10]>, S & ToSchema<M, MergePath<BasePath, P>, I9, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5> | MergeMiddlewareResponse<M6> | MergeMiddlewareResponse<M7> | MergeMiddlewareResponse<M8>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, MergedPath extends MergePath<BasePath, P>, R extends HandlerResponse<any> = any, I extends Input = BlankInput, I2 extends Input = I, I3 extends Input = I & I2, I4 extends Input = I & I2 & I3, I5 extends Input = I & I2 & I3 & I4, I6 extends Input = I & I2 & I3 & I4 & I5, I7 extends Input = I & I2 & I3 & I4 & I5 & I6, I8 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7, I9 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7 & I8, I10 extends Input = I & I2 & I3 & I4 & I5 & I6 & I7 & I8 & I9, E2 extends Env = E, E3 extends Env = IntersectNonAnyTypes<[E, E2]>, E4 extends Env = IntersectNonAnyTypes<[E, E2, E3]>, E5 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4]>, E6 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5]>, E7 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6]>, E8 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7]>, E9 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8]>, E10 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9]>, E11 extends Env = IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9, E10]>, M1 extends H<E2, MergedPath, I> = H<E2, MergedPath, I>, M2 extends H<E3, MergedPath, I2> = H<E3, MergedPath, I2>, M3 extends H<E4, MergedPath, I3> = H<E4, MergedPath, I3>, M4 extends H<E5, MergedPath, I4> = H<E5, MergedPath, I4>, M5 extends H<E6, MergedPath, I5> = H<E6, MergedPath, I5>, M6 extends H<E7, MergedPath, I6> = H<E7, MergedPath, I6>, M7 extends H<E8, MergedPath, I7> = H<E8, MergedPath, I7>, M8 extends H<E9, MergedPath, I8> = H<E9, MergedPath, I8>, M9 extends H<E10, MergedPath, I9> = H<E10, MergedPath, I9>>(methods: M[], path: P, ...handlers: [H<E2, MergedPath, I> & M1, H<E3, MergedPath, I2> & M2, H<E4, MergedPath, I3> & M3, H<E5, MergedPath, I4> & M4, H<E6, MergedPath, I5> & M5, H<E7, MergedPath, I6> & M6, H<E8, MergedPath, I7> & M7, H<E9, MergedPath, I8> & M8, H<E10, MergedPath, I9> & M9, H<E11, MergedPath, I10, R>]): Acryl<IntersectNonAnyTypes<[E, E2, E3, E4, E5, E6, E7, E8, E9, E10, E11]>, S & ToSchema<M, MergePath<BasePath, P>, I10, MergeTypedResponse<R> | MergeMiddlewareResponse<M1> | MergeMiddlewareResponse<M2> | MergeMiddlewareResponse<M3> | MergeMiddlewareResponse<M4> | MergeMiddlewareResponse<M5> | MergeMiddlewareResponse<M6> | MergeMiddlewareResponse<M7> | MergeMiddlewareResponse<M8> | MergeMiddlewareResponse<M9>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, P extends string, R extends HandlerResponse<any> = any, I extends Input = BlankInput>(methods: M[], path: P, ...handlers: [H<E, MergePath<BasePath, P>, I, R>, ...H<E, MergePath<BasePath, P>, I, R>[]]): Acryl<E, S & ToSchema<M, MergePath<BasePath, P>, I, MergeTypedResponse<R>>, BasePath, MergePath<BasePath, P>>;
  <M extends string, const Ps extends string[], I extends Input = BlankInput, R extends HandlerResponse<any> = any, E2 extends Env = E>(methods: M | M[], paths: Ps, ...handlers: H<E2, MergePath<BasePath, Ps[number]>, I, R>[]): Acryl<E, S & ToSchema<M, MergePath<BasePath, Ps[number]>, I, MergeTypedResponse<R>>, BasePath, Ps extends [...string[], infer LastPath extends string] ? MergePath<BasePath, LastPath> : never>;
}
type ToSchemaOutput<RorO, I extends Input | Input['in']> = RorO extends TypedResponse<infer T, infer U, infer F> ? {
  output: unknown extends T ? {} : T;
  outputFormat: I extends {
    outputFormat: string;
  } ? I['outputFormat'] : F;
  status: U;
} : {
  output: unknown extends RorO ? {} : RorO;
  outputFormat: unknown extends RorO ? 'json' : I extends {
    outputFormat: string;
  } ? I['outputFormat'] : 'json';
  status: StatusCode;
};
type ToSchema<M extends string, P extends string, I extends Input | Input['in'], RorO> = IsAny<RorO> extends true ? { [K in P]: { [K2 in M as AddDollar<K2>]: {
  input: AddParam<ExtractInput<I>, P>;
  output: {};
  outputFormat: ResponseFormat;
  status: StatusCode;
} } } : [RorO] extends [never] ? {} : [RorO] extends [Promise<void>] ? {} : { [K in P]: { [K2 in M as AddDollar<K2>]: Simplify<{
  input: AddParam<ExtractInput<I>, P>;
} & ToSchemaOutput<RorO, I>> } };
type Schema = {
  [Path: string]: {
    [Method: `$${Lowercase<string>}`]: Endpoint;
  };
};
type AddSchemaIfHasResponse<Merged, S extends Schema, M extends string, P extends string, I extends Input | Input['in'], BasePath extends string> = [Merged] extends [Promise<void>] ? S : S & ToSchema<M, MergePath<BasePath, P>, I, Merged>;
type Endpoint = {
  input: any;
  output: any;
  outputFormat: ResponseFormat;
  status: StatusCode;
};
type ExtractParams<Path extends string> = string extends Path ? Record<string, string> : Path extends `${infer _Start}:${infer Param}/${infer Rest}` ? { [K in Param | keyof ExtractParams<`/${Rest}`>]: string } : Path extends `${infer _Start}:${infer Param}` ? { [K in Param]: string } : never;
type FlattenIfIntersect<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
type MergeSchemaPath<OrigSchema extends Schema, SubPath extends string> = { [P in keyof OrigSchema as MergePath<SubPath, P & string>]: [OrigSchema[P]] extends [Record<string, Endpoint>] ? { [M in keyof OrigSchema[P]]: MergeEndpointParamsWithPath<OrigSchema[P][M], SubPath> } : never };
type MergeEndpointParamsWithPath<T extends Endpoint, SubPath extends string> = T extends unknown ? {
  input: T['input'] extends {
    param: infer _;
  } ? ExtractParams<SubPath> extends never ? T['input'] : FlattenIfIntersect<T['input'] & {
    param: { [K in keyof ExtractParams<SubPath> as K extends `${infer Prefix}{${infer _}}` ? Prefix : K]: string };
  }> : RemoveBlankRecord<ExtractParams<SubPath>> extends never ? T['input'] : T['input'] & {
    param: { [K in keyof ExtractParams<SubPath> as K extends `${infer Prefix}{${infer _}}` ? Prefix : K]: string };
  };
  output: T['output'];
  outputFormat: T['outputFormat'];
  status: T['status'];
} : never;
type AddParam<I, P extends string> = ParamKeys<P> extends never ? I : I extends {
  param: infer _;
} ? I : I & {
  param: UnionToIntersection<ParamKeyToRecord<ParamKeys<P>>>;
};
type AddDollar<T extends string> = `$${Lowercase<T>}`;
type MergePath<A extends string, B extends string> = B extends '' ? MergePath<A, '/'> : A extends '' ? B : A extends '/' ? B : A extends `${infer P}/` ? B extends `/${infer Q}` ? `${P}/${Q}` : `${P}/${B}` : B extends `/${infer Q}` ? Q extends '' ? A : `${A}/${Q}` : `${A}/${B}`;
type KnownResponseFormat = 'json' | 'text' | 'redirect';
type ResponseFormat = KnownResponseFormat | string;
type TypedResponse<T = unknown, U extends StatusCode = StatusCode, F extends ResponseFormat = (T extends string ? 'text' : T extends JSONValue ? 'json' : ResponseFormat)> = {
  _data: T;
  _status: U;
  _format: F;
};
type MergeTypedResponse<T> = T extends Promise<void> ? T : T extends Promise<infer T2> ? T2 extends TypedResponse ? T2 : TypedResponse : T extends TypedResponse ? T : TypedResponse;
type ExtractTypedResponseOnly<T> = T extends TypedResponse ? T : never;
type MergeMiddlewareResponse<T> = T extends ((c: any, next: any) => Promise<infer R>) ? Exclude<R, void> extends never ? never : Exclude<R, void> extends Response | TypedResponse<any, any, any> ? ExtractTypedResponseOnly<Exclude<R, void>> : never : T extends ((c: any, next: any) => infer R) ? R extends Response | TypedResponse<any, any, any> ? ExtractTypedResponseOnly<R> : never : never;
type FormValue = string | Blob;
type ParsedFormValue = string | File;
type ValidationTargets<T extends FormValue = ParsedFormValue, P extends string = string> = {
  json: any;
  form: Record<string, T | T[]>;
  query: Record<string, string | string[]>;
  param: Record<P, P extends `${infer _}?` ? string | undefined : string>;
  header: Record<RequestHeader | CustomHeader, string>;
  cookie: Record<string, string>;
};
type ParamKey<Component> = Component extends `:${infer NameWithPattern}` ? NameWithPattern extends `${infer Name}{${infer Rest}` ? Rest extends `${infer _Pattern}?` ? `${Name}?` : Name : NameWithPattern : never;
type ParamKeys<Path> = Path extends `${infer Component}/${infer Rest}` ? ParamKey<Component> | ParamKeys<Rest> : ParamKey<Path>;
type ParamKeyToRecord<T extends string> = T extends `${infer R}?` ? Record<R, string | undefined> : { [K in T]: string };
type InputToDataByTarget<T extends Input['out'], Target extends keyof ValidationTargets> = T extends { [K in Target]: infer R } ? R : never;
type RemoveQuestion<T> = T extends `${infer R}?` ? R : T;
type ExtractSchema<T> = UnionToIntersection<T extends Acryl<infer _, infer S, any, any> ? S : never>;
type ExtractSchemaForStatusCode<T, Status extends number> = { [Path in keyof ExtractSchema<T>]: { [Method in keyof ExtractSchema<T>[Path]]: Extract<ExtractSchema<T>[Path][Method], {
  status: Status;
}> } };
type ExtractHandlerResponse<T> = T extends ((c: any, next: any) => Promise<infer R>) ? Exclude<R, void> extends never ? never : Exclude<R, void> extends Response | TypedResponse<any, any, any> ? Exclude<R, void> : never : T extends ((c: any, next: any) => infer R) ? R extends Response | TypedResponse<any, any, any> ? R : never : never;
type ProcessHead<T> = IfAnyThenEmptyObject<T extends Env ? (Env extends T ? {} : T) : T>;
type IntersectNonAnyTypes<T extends any[]> = T extends [infer Head, ...infer Rest] ? ProcessHead<Head> & IntersectNonAnyTypes<Rest> : {};
declare abstract class FetchEventLike {
  abstract readonly request: Request;
  abstract respondWith(promise: Response | Promise<Response>): void;
  abstract passThroughOnException(): void;
  abstract waitUntil(promise: Promise<void>): void;
}
//#endregion
//#region ../../plugins/acryl-router/src/core/utils/body.d.ts
type BodyDataValueDot = {
  [x: string]: string | File | BodyDataValueDot;
};
type BodyDataValueDotAll = {
  [x: string]: string | File | (string | File)[] | BodyDataValueDotAll;
};
type SimplifyBodyData<T> = { [K in keyof T]: string | File | (string | File)[] | BodyDataValueDotAll extends T[K] ? string | File | (string | File)[] | BodyDataValueDotAll : string | File | BodyDataValueDot extends T[K] ? string | File | BodyDataValueDot : string | File | (string | File)[] extends T[K] ? string | File | (string | File)[] : string | File } & {};
type BodyDataValueComponent<T> = string | File | (T extends {
  all: false;
} ? never : T extends {
  all: true;
} | {
  all: boolean;
} ? (string | File)[] : never);
type BodyDataValueObject<T> = {
  [key: string]: BodyDataValueComponent<T> | BodyDataValueObject<T>;
};
type BodyDataValue<T> = BodyDataValueComponent<T> | (T extends {
  dot: false;
} ? never : T extends {
  dot: true;
} | {
  dot: boolean;
} ? BodyDataValueObject<T> : never);
type BodyData<T extends Partial<ParseBodyOptions> = {}> = SimplifyBodyData<Record<string, BodyDataValue<T>>>;
type ParseBodyOptions = {
  /**
   * Determines whether all fields with multiple values should be parsed as arrays.
   * @default false
   * @example
   * const data = new FormData()
   * data.append('file', 'aaa')
   * data.append('file', 'bbb')
   * data.append('message', 'hello')
   *
   * If all is false:
   * parseBody should return { file: 'bbb', message: 'hello' }
   *
   * If all is true:
   * parseBody should return { file: ['aaa', 'bbb'], message: 'hello' }
   */
  all: boolean;
  /**
   * Determines whether all fields with dot notation should be parsed as nested objects.
   * @default false
   * @example
   * const data = new FormData()
   * data.append('obj.key1', 'value1')
   * data.append('obj.key2', 'value2')
   *
   * If dot is false:
   * parseBody should return { 'obj.key1': 'value1', 'obj.key2': 'value2' }
   *
   * If dot is true:
   * parseBody should return { obj: { key1: 'value1', key2: 'value2' } }
   */
  dot: boolean;
};
/**
 * Parses the body of a request based on the provided options.
 *
 * @template T - The type of the parsed body data.
 * @param {AcrylRequest | Request} request - The request object to parse.
 * @param {Partial<ParseBodyOptions>} [options] - Options for parsing the body.
 * @returns {Promise<T>} The parsed body data.
 */
interface ParseBody {
  <Options extends Partial<ParseBodyOptions>, T extends BodyData<Options>>(request: AcrylRequest | Request, options?: Options): Promise<T>;
  <T extends BodyData>(request: AcrylRequest | Request, options?: Partial<ParseBodyOptions>): Promise<T>;
}
declare const parseBody: ParseBody;
//#endregion
//#region ../../plugins/acryl-router/src/core/request.d.ts
type Body = {
  json: any;
  text: string;
  arrayBuffer: ArrayBuffer;
  blob: Blob;
  formData: FormData;
};
type BodyCache = Partial<Body>;
declare class AcrylRequest<P extends string = '/', I extends Input['out'] = {}> {
  #private;
  /**
   * `.raw` can get the raw Request object.
   *
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw: Request;
  routeIndex: number;
  /**
   * `.path` can get the pathname of the request.
   *
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path: string;
  bodyCache: BodyCache;
  constructor(request: Request, path?: string, matchResult?: Result<[unknown, RouterRoute]>);
  /**
   * `.req.param()` gets the path parameters.
   *
   *
   * @example
   * ```ts
   * const name = c.req.param('name')
   * // or all parameters at once
   * const { id, comment_id } = c.req.param()
   * ```
   */
  param<P2 extends ParamKeys<P> = ParamKeys<P>>(key: string extends P ? never : P2 extends `${infer _}?` ? never : P2): string;
  param<P2 extends RemoveQuestion<ParamKeys<P>> = RemoveQuestion<ParamKeys<P>>>(key: P2): string | undefined;
  param(key: string): string | undefined;
  param<P2 extends string = P>(): Simplify<UnionToIntersection<ParamKeyToRecord<ParamKeys<P2>>>>;
  /**
   * `.query()` can get querystring parameters.
   *
   *
   * @example
   * ```ts
   * // Query params
   * app.get('/search', (c) => {
   *   const query = c.req.query('q')
   * })
   *
   * // Get all params at once
   * app.get('/search', (c) => {
   *   const { q, limit, offset } = c.req.query()
   * })
   * ```
   */
  query(key: string): string | undefined;
  query(): Record<string, string>;
  /**
   * `.queries()` can get multiple querystring parameter values, e.g. /search?tags=A&tags=B
   *
   *
   * @example
   * ```ts
   * app.get('/search', (c) => {
   *   // tags will be string[]
   *   const tags = c.req.queries('tags')
   * })
   * ```
   */
  queries(key: string): string[] | undefined;
  queries(): Record<string, string[]>;
  /**
   * `.header()` can get the request header value.
   *
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const userAgent = c.req.header('User-Agent')
   * })
   * ```
   */
  header(name: RequestHeader): string | undefined;
  header(name: string): string | undefined;
  header(): Record<RequestHeader | (string & CustomHeader), string>;
  /**
   * `.parseBody()` can parse Request body of type `multipart/form-data` or `application/x-www-form-urlencoded`
   *
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.parseBody()
   * })
   * ```
   */
  parseBody<Options extends Partial<ParseBodyOptions>, T extends BodyData<Options>>(options?: Options): Promise<T>;
  parseBody<T extends BodyData>(options?: Partial<ParseBodyOptions>): Promise<T>;
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json<T = any>(): Promise<T>;
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text(): Promise<string>;
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer(): Promise<ArrayBuffer>;
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes(): Promise<Uint8Array>;
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   */
  blob(): Promise<Blob>;
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   */
  formData(): Promise<FormData>;
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target: keyof ValidationTargets, data: {}): void;
  /**
   * Gets validated data from the request.
   *
   * @param target - The target of the validation.
   * @returns The validated data.
   *
   */
  valid<T extends keyof I & keyof ValidationTargets>(target: T): InputToDataByTarget<I, T>;
  /**
   * `.url` can get the request url strings.
   *
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url(): string;
  /**
   * `.method` can get the method name of the request.
   *
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method(): string;
  get [GET_MATCH_RESULT](): Result<[unknown, RouterRoute]>;
  /**
   * `.matchedRoutes` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "acryl-router/route" instead.
   *
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes(): RouterRoute[];
  /**
   * `.routePath` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "acryl-router/route" instead.
   *
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath(): string;
}
/**
 * Clones a AcrylRequest's underlying raw Request object.
 *
 * This utility handles both consumed and unconsumed request bodies:
 * - If the request body hasn't been consumed, it uses the native `clone()` method
 * - If the request body has been consumed, it reconstructs a new Request using cached body data
 *
 * This is particularly useful when you need to:
 * - Process the same request body multiple times
 * - Pass requests to external services after validation
 *
 * @param req - The AcrylRequest object to clone
 * @returns A Promise that resolves to a new Request object with the same properties
 * @throws {HTTPException} If the request body was consumed directly via `req.raw`
 *   without using AcrylRequest methods (e.g., `req.json()`, `req.text()`), making it
 *   impossible to reconstruct the body from cache
 *
 * @example
 * ```ts
 * // Clone after consuming the body (e.g., after validation)
 * app.post('/forward',
 *   validator('json', (data) => data),
 *   async (c) => {
 *     const validated = c.req.valid('json')
 *     // Body has been consumed, but cloneRawRequest still works
 *     const clonedReq = await cloneRawRequest(c.req)
 *     return fetch('http://backend-service.com', clonedReq)
 *   }
 * )
 * ```
 */
declare const cloneRawRequest: (req: AcrylRequest) => Promise<Request>;
//#endregion
//#region ../../plugins/acryl-router/src/core/context.d.ts
type HeaderRecord = Record<'Content-Type', BaseMime> | Record<ResponseHeader, string | string[]> | Record<string, string | string[]>;
/**
 * Data type can be a string, ArrayBuffer, Blob, Uint8Array (buffer), or ReadableStream.
 */
type Data = string | ArrayBuffer | Blob | ReadableStream | Uint8Array<ArrayBuffer>;
/**
 * Interface for the execution context in a web worker or similar environment.
 */
interface ExecutionContext {
  /**
   * Extends the lifetime of the event callback until the promise is settled.
   *
   * @param promise - A promise to wait for.
   */
  waitUntil(promise: Promise<unknown>): void;
  /**
   * Allows the event to be passed through to subsequent event listeners.
   */
  passThroughOnException(): void;
  /**
   * For compatibility with Wrangler 4.x.
   */
  props: any;
  /**
   * For compatibility with Wrangler 4.x.
   */
  exports?: any;
}
/**
 * Interface for context variable mapping.
 */
interface ContextVariableMap {}
/**
 * Interface for context renderer.
 */
interface ContextRenderer {}
/**
 * Interface representing a renderer for content.
 *
 * @interface DefaultRenderer
 * @param {string | Promise<string>} content - The content to be rendered, which can be either a string or a Promise resolving to a string.
 * @returns {Response | Promise<Response>} - The response after rendering the content, which can be either a Response or a Promise resolving to a Response.
 */
interface DefaultRenderer {
  (content: string | Promise<string>): Response | Promise<Response>;
}
/**
 * Renderer type which can either be a ContextRenderer or DefaultRenderer.
 */
type Renderer = ContextRenderer extends Function ? ContextRenderer : DefaultRenderer;
/**
 * Extracts the props for the renderer.
 */
type PropsForRenderer = [...Required<Parameters<Renderer>>] extends [unknown, infer Props] ? Props : unknown;
type Layout<T = Record<string, any>> = (props: T) => any;
/**
 * Interface for getting context variables.
 *
 * @template E - Environment type.
 */
interface Get<E extends Env> {
  <Key extends keyof E['Variables']>(key: Key): E['Variables'][Key];
  <Key extends keyof ContextVariableMap>(key: Key): ContextVariableMap[Key];
}
/**
 * Interface for setting context variables.
 *
 * @template E - Environment type.
 */
interface Set<E extends Env> {
  <Key extends keyof E['Variables']>(key: Key, value: E['Variables'][Key]): void;
  <Key extends keyof ContextVariableMap>(key: Key, value: ContextVariableMap[Key]): void;
}
/**
 * Interface for creating a new response.
 */
interface NewResponse {
  (data: Data | null, status?: StatusCode, headers?: HeaderRecord): Response;
  (data: Data | null, init?: ResponseOrInit): Response;
}
/**
 * Interface for responding with a body.
 */
interface BodyRespond {
  <T extends Data, U extends ContentfulStatusCode>(data: T, status?: U, headers?: HeaderRecord): Response & TypedResponse<T, U, 'body'>;
  <T extends Data, U extends ContentfulStatusCode>(data: T, init?: ResponseOrInit<U>): Response & TypedResponse<T, U, 'body'>;
  <T extends null, U extends StatusCode>(data: T, status?: U, headers?: HeaderRecord): Response & TypedResponse<null, U, 'body'>;
  <T extends null, U extends StatusCode>(data: T, init?: ResponseOrInit<U>): Response & TypedResponse<null, U, 'body'>;
}
/**
 * Interface for responding with text.
 *
 * @interface TextRespond
 * @template T - The type of the text content.
 * @template U - The type of the status code.
 *
 * @param {T} text - The text content to be included in the response.
 * @param {U} [status] - An optional status code for the response.
 * @param {HeaderRecord} [headers] - An optional record of headers to include in the response.
 *
 * @returns {Response & TypedResponse<T, U, 'text'>} - The response after rendering the text content, typed with the provided text and status code types.
 */
interface TextRespond {
  <T extends string, U extends ContentfulStatusCode = ContentfulStatusCode>(text: T, status?: U, headers?: HeaderRecord): Response & TypedResponse<T, U, 'text'>;
  <T extends string, U extends ContentfulStatusCode = ContentfulStatusCode>(text: T, init?: ResponseOrInit<U>): Response & TypedResponse<T, U, 'text'>;
}
/**
 * Interface for responding with JSON.
 *
 * @interface JSONRespond
 * @template T - The type of the JSON value or simplified unknown type.
 * @template U - The type of the status code.
 *
 * @param {T} object - The JSON object to be included in the response.
 * @param {U} [status] - An optional status code for the response.
 * @param {HeaderRecord} [headers] - An optional record of headers to include in the response.
 *
 * @returns {JSONRespondReturn<T, U>} - The response after rendering the JSON object, typed with the provided object and status code types.
 */
interface JSONRespond {
  <T extends JSONValue | {} | InvalidJSONValue, U extends ContentfulStatusCode = ContentfulStatusCode>(object: T, status?: U, headers?: HeaderRecord): JSONRespondReturn<T, U>;
  <T extends JSONValue | {} | InvalidJSONValue, U extends ContentfulStatusCode = ContentfulStatusCode>(object: T, init?: ResponseOrInit<U>): JSONRespondReturn<T, U>;
}
/**
 * @template T - The type of the JSON value or simplified unknown type.
 * @template U - The type of the status code.
 *
 * @returns {Response & TypedResponse<JSONParsed<T>, U, 'json'>} - The response after rendering the JSON object, typed with the provided object and status code types.
 */
type JSONRespondReturn<T extends JSONValue | {} | InvalidJSONValue, U extends ContentfulStatusCode> = Response & TypedResponse<JSONParsed<T>, U, 'json'>;
/**
 * Interface representing a function that responds with HTML content.
 *
 * @param html - The HTML content to respond with, which can be a string or a Promise that resolves to a string.
 * @param status - (Optional) The HTTP status code for the response.
 * @param headers - (Optional) A record of headers to include in the response.
 * @param init - (Optional) The response initialization object.
 *
 * @returns A Response object or a Promise that resolves to a Response object.
 */
interface HTMLRespond {
  <T extends string | Promise<string>>(html: T, status?: ContentfulStatusCode, headers?: HeaderRecord): T extends string ? Response : Promise<Response>;
  <T extends string | Promise<string>>(html: T, init?: ResponseOrInit<ContentfulStatusCode>): T extends string ? Response : Promise<Response>;
}
/**
 * Options for configuring the context.
 *
 * @template E - Environment type.
 */
type ContextOptions<E extends Env> = {
  /**
   * Bindings for the environment.
   */
  env: E['Bindings'];
  /**
   * Execution context for the request.
   */
  executionCtx?: FetchEventLike | ExecutionContext | undefined;
  /**
   * Handler for not found responses.
   */
  notFoundHandler?: NotFoundHandler<E>;
  matchResult?: Result<[H, RouterRoute]>;
  path?: string;
};
interface SetHeadersOptions {
  append?: boolean;
}
interface SetHeaders {
  (name: 'Content-Type', value?: BaseMime, options?: SetHeadersOptions): void;
  (name: ResponseHeader, value?: string, options?: SetHeadersOptions): void;
  (name: string, value?: string, options?: SetHeadersOptions): void;
}
type ResponseHeadersInit = [string, string][] | Record<'Content-Type', BaseMime> | Record<ResponseHeader, string> | Record<string, string> | Headers;
interface ResponseInit<T extends StatusCode = StatusCode> {
  headers?: ResponseHeadersInit;
  status?: T;
  statusText?: string;
}
type ResponseOrInit<T extends StatusCode = StatusCode> = ResponseInit<T> | Response;
declare class Context<E extends Env = any, P extends string = any, I extends Input = {}> {
  #private;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env: E['Bindings'];
  finalized: boolean;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error: Error | undefined;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req: Request, options?: ContextOptions<E>);
  /**
   * `.req` is the instance of {@link AcrylRequest}.
   */
  get req(): AcrylRequest<P, I['out']>;
  /**
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event(): FetchEventLike;
  /**
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx(): ExecutionContext;
  /**
   * The Response object for the current request.
   */
  get res(): Response;
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res: Response | undefined);
  /**
   * `.render()` can create a response within a layout.
   *
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render: Renderer;
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout: (layout: Layout<PropsForRenderer & {
    Layout: Layout;
  }>) => Layout<PropsForRenderer & {
    Layout: Layout;
  }>;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout: () => Layout<PropsForRenderer & {
    Layout: Layout;
  }> | undefined;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer: (renderer: Renderer) => void;
  /**
   * `.header()` can set headers.
   *
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   // Append multiple headers using the append option (e.g. Vary)
   *   c.header('Vary', 'Accept-Encoding', { append: true })
   *   c.header('Vary', 'User-Agent', { append: true })
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header: SetHeaders;
  status: (status: StatusCode) => void;
  /**
   * `.set()` can set the value specified by the key.
   *
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Acryl is hot!!')
   *   await next()
   * })
   * ```
   */
  set: Set<IsAny<E> extends true ? {
    Variables: ContextVariableMap & Record<PropertyKey, any>;
  } : E>;
  /**
   * `.get()` can use the value specified by the key.
   *
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get: Get<IsAny<E> extends true ? {
    Variables: ContextVariableMap & Record<PropertyKey, any>;
  } : E>;
  /**
   * `.var` can access the value of a variable.
   *
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  get var(): Readonly<ContextVariableMap & (IsAny<E['Variables']> extends true ? Record<string, any> : E['Variables'])>;
  newResponse: NewResponse;
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body: BodyRespond;
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text: TextRespond;
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json: JSONRespond;
  html: HTMLRespond;
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect: <T extends RedirectStatusCode = 302>(location: string | URL, status?: T) => Response & TypedResponse<undefined, T, "redirect">;
  /**
   * `.notFound()` can return the Not Found Response.
   *
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound: () => ReturnType<NotFoundHandler>;
}
//#endregion
export { Acryl as $, Input as A, NotFoundResponse as B, FetchEventLike as C, Handler as D, HTTPResponseError as E, MergeSchemaPath as F, RemoveQuestion as G, ParamKeyToRecord as H, MiddlewareHandler as I, Schema as J, ResponseFormat as K, MiddlewareHandlerInterface as L, IntersectNonAnyTypes as M, KnownResponseFormat as N, HandlerInterface as O, MergePath as P, Variables as Q, Next as R, ExtractSchemaForStatusCode as S, H as T, ParamKeys as U, OnHandlerInterface as V, ParsedFormValue as W, TypedResponse as X, ToSchema as Y, ValidationTargets as Z, Env as _, ExecutionContext as a, ExtractInput as b, BodyData as c, AddParam as d, AcrylOptions as et, Bindings as f, Endpoint as g, BlankSchema as h, Data as i, InputToDataByTarget as j, HandlerResponse as k, ParseBodyOptions as l, BlankInput as m, ContextRenderer as n, AcrylRequest as o, BlankEnv as p, RouterRoute as q, ContextVariableMap as r, cloneRawRequest as s, Context as t, parseBody as u, ErrorHandler as v, FormValue as w, ExtractSchema as x, ExtractHandlerResponse as y, NotFoundHandler as z };