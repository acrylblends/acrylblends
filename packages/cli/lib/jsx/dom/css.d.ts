import { a as rawCssString, i as OnInvalidSlug, n as CssClassName, r as CssVariableType, t as ClassNameSlug } from "../../common-D8Z4JRCw.js";
import { C as PropsWithChildren } from "../../context-DxFdY_un.js";
import { r as FC } from "../../base-BpQy2Rk7.js";

//#region ../../plugins/acryl-router/src/core/jsx/dom/css.d.ts
interface CreateCssJsxDomObjectsType {
  (args: {
    id: Readonly<string>;
  }): readonly [{
    toString(this: CssClassName): string;
  }, FC<PropsWithChildren<void>>];
}
declare const createCssJsxDomObjects: CreateCssJsxDomObjectsType;
interface CssType {
  (strings: TemplateStringsArray, ...values: CssVariableType[]): string;
}
interface CxType {
  (...args: (string | boolean | null | undefined)[]): string;
}
interface KeyframesType {
  (strings: TemplateStringsArray, ...values: CssVariableType[]): CssClassName;
}
interface ViewTransitionType {
  (strings: TemplateStringsArray, ...values: CssVariableType[]): string;
  (content: string): string;
  (): string;
}
interface DefaultContextType {
  css: CssType;
  cx: CxType;
  keyframes: KeyframesType;
  viewTransition: ViewTransitionType;
  Style: FC<PropsWithChildren<void>>;
}
/**
 * @experimental
 * `createCssContext` is an experimental feature.
 * The API might be changed.
 *
 * @param options.id - The ID for the style element
 * @param options.classNameSlug - Optional function to customize generated CSS class names
 * @param options.onInvalidSlug - Optional callback function called when an invalid slug is returned from ClassNameSlug
 */
declare const createCssContext: ({
  id,
  classNameSlug,
  onInvalidSlug
}: {
  id: Readonly<string>;
  classNameSlug?: ClassNameSlug;
  onInvalidSlug?: OnInvalidSlug;
}) => DefaultContextType;
/**
 * @experimental
 * `css` is an experimental feature.
 * The API might be changed.
 */
declare const css: CssType;
/**
 * @experimental
 * `cx` is an experimental feature.
 * The API might be changed.
 */
declare const cx: CxType;
/**
 * @experimental
 * `keyframes` is an experimental feature.
 * The API might be changed.
 */
declare const keyframes: KeyframesType;
/**
 * @experimental
 * `viewTransition` is an experimental feature.
 * The API might be changed.
 */
declare const viewTransition: ViewTransitionType;
/**
 * @experimental
 * `Style` is an experimental feature.
 * The API might be changed.
 */
declare const Style: FC<PropsWithChildren<void>>;
//#endregion
export { Style, createCssContext, createCssJsxDomObjects, css, cx, keyframes, rawCssString, viewTransition };