import { L as MiddlewareHandler, j as Input, o as PropsForRenderer, t as Context, v as Env } from "./context-DS3fYyG-.js";
import { C as PropsWithChildren, t as Context$1 } from "./context-DxFdY_un.js";
import { r as FC } from "./base-BpQy2Rk7.js";

//#region ../../plugins/acryl-router/src/core/middleware/jsx-renderer/index.d.ts
declare const RequestContext: Context$1<Context<any, any, {}> | null>;
type RendererOptions = {
  docType?: boolean | string;
  stream?: boolean | Record<string, string>;
};
type ComponentResult = Exclude<ReturnType<FC>, null>;
type ComponentWithChildren = (props: PropsWithChildren<PropsForRenderer & {
  Layout: FC;
}>, c: Context) => ComponentResult;
/**
 * JSX Renderer Middleware for acryl.
 *
 *
 * @param {ComponentWithChildren} [component] - The component to render, which can accept children and props.
 * @param {RendererOptions} [options] - The options for the JSX renderer middleware.
 * @param {boolean | string} [options.docType=true] - The DOCTYPE to be added at the beginning of the HTML. If set to false, no DOCTYPE will be added.
 * @param {boolean | Record<string, string>} [options.stream=false] - If set to true, enables streaming response with default headers. If a record is provided, custom headers will be used.
 * @returns {MiddlewareHandler} The middleware handler function.
 *
 * @example
 * ```ts
 * const app = new Acryl()
 *
 * app.get(
 *   '/page/*',
 *   jsxRenderer(({ children }) => {
 *     return (
 *       <html>
 *         <body>
 *           <header>Menu</header>
 *           <div>{children}</div>
 *         </body>
 *       </html>
 *     )
 *   })
 * )
 *
 * app.get('/page/about', (c) => {
 *   return c.render(<h1>About me!</h1>)
 * })
 * ```
 */
declare const jsxRenderer: <E extends Env = Env>(component?: ComponentWithChildren, options?: RendererOptions | ((c: Context<E>) => RendererOptions)) => MiddlewareHandler;
/**
 * useRequestContext for Acryl.
 *
 * @template E - The environment type.
 * @template P - The parameter type.
 * @template I - The input type.
 * @returns {Context<E, P, I>} An instance of Context.
 *
 * @example
 * ```ts
 * const RequestUrlBadge: FC = () => {
 *   const c = useRequestContext()
 *   return <b>{c.req.url}</b>
 * }
 *
 * app.get('/page/info', (c) => {
 *   return c.render(
 *     <div>
 *       You are accessing: <RequestUrlBadge />
 *     </div>
 *   )
 * })
 * ```
 */
declare const useRequestContext: <E extends Env = any, P extends string = any, I extends Input = {}>() => Context<E, P, I>;
//#endregion
export { RequestContext, jsxRenderer, useRequestContext };