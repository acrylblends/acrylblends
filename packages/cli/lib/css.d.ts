import { i as HtmlEscapedString } from "./html-SllAe0YT.js";
import { a as rawCssString, i as OnInvalidSlug, n as CssClassName$1, r as CssVariableType, t as ClassNameSlug } from "./common-D8Z4JRCw.js";

//#region ../../plugins/acryl-router/src/core/helper/css/index.d.ts
type CssClassName = HtmlEscapedString & CssClassName$1;
interface CssType {
  (strings: TemplateStringsArray, ...values: CssVariableType[]): Promise<string>;
}
interface CxType {
  (...args: (CssClassName | Promise<string> | string | boolean | null | undefined)[]): Promise<string>;
}
interface KeyframesType {
  (strings: TemplateStringsArray, ...values: CssVariableType[]): CssClassName$1;
}
interface ViewTransitionType {
  (strings: TemplateStringsArray, ...values: CssVariableType[]): Promise<string>;
  (content: Promise<string>): Promise<string>;
  (): Promise<string>;
}
interface StyleType {
  (args?: {
    children?: Promise<string>;
    nonce?: string;
  }): HtmlEscapedString;
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
interface DefaultContextType {
  css: CssType;
  cx: CxType;
  keyframes: KeyframesType;
  viewTransition: ViewTransitionType;
  Style: StyleType;
}
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
declare const Style: StyleType;
//#endregion
export { type ClassNameSlug, type OnInvalidSlug, Style, createCssContext, css, cx, keyframes, rawCssString, viewTransition };