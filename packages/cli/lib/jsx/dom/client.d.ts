import { t as Child } from "../../base-BpQy2Rk7.js";

//#region ../../plugins/acryl-router/src/core/jsx/dom/client.d.ts
interface Root {
  render(children: Child): void;
  unmount(): void;
}
type RootOptions = Record<string, unknown>;
/**
 * Create a root object for rendering
 * @param element Render target
 * @param options Options for createRoot (not supported yet)
 * @returns Root object has `render` and `unmount` methods
 */
declare const createRoot: (element: HTMLElement | DocumentFragment, options?: RootOptions) => Root;
/**
 * Create a root object and hydrate app to the target element.
 * In acryl-router/jsx/dom, hydrate is equivalent to render.
 * @param element Render target
 * @param reactNode A JSXNode to render
 * @param options Options for createRoot (not supported yet)
 * @returns Root object has `render` and `unmount` methods
 */
declare const hydrateRoot: (element: HTMLElement | DocumentFragment, reactNode: Child, options?: RootOptions) => Root;
declare const _default: {
  createRoot: (element: HTMLElement | DocumentFragment, options?: RootOptions) => Root;
  hydrateRoot: (element: HTMLElement | DocumentFragment, reactNode: Child, options?: RootOptions) => Root;
};
//#endregion
export { Root, RootOptions, createRoot, _default as default, hydrateRoot };