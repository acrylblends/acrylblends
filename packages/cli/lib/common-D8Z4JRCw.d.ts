//#region ../../plugins/acryl-router/src/core/helper/css/common.d.ts
declare const SELECTOR: unique symbol;
declare const CLASS_NAME: unique symbol;
declare const STYLE_STRING: unique symbol;
declare const SELECTORS: unique symbol;
declare const EXTERNAL_CLASS_NAMES: unique symbol;
declare const CSS_ESCAPED: unique symbol;
interface CssClassName {
  [SELECTOR]: string;
  [CLASS_NAME]: string;
  [STYLE_STRING]: string;
  [SELECTORS]: CssClassName[];
  [EXTERNAL_CLASS_NAMES]: string[];
}
interface CssEscapedString {
  [CSS_ESCAPED]: string;
}
/**
 * @experimental
 * `rawCssString` is an experimental feature.
 * The API might be changed.
 */
declare const rawCssString: (value: string) => CssEscapedString;
type CssVariableBasicType = CssClassName | CssEscapedString | string | number | boolean | null | undefined;
type CssVariableAsyncType = Promise<CssVariableBasicType>;
type CssVariableArrayType = (CssVariableBasicType | CssVariableAsyncType)[];
type CssVariableType = CssVariableBasicType | CssVariableAsyncType | CssVariableArrayType;
/**
 * A function that customizes generated CSS class names.
 *
 * @param hash - The default hash-based class name (e.g. `css-1234567890`)
 * @param label - The comment label extracted from the CSS template, may be empty.
 *   Whitespace is trimmed and inner spaces are replaced with hyphens.
 * @param styleString - The minified CSS style string
 * @returns The custom class name to use. Must be a safe CSS identifier;
 *   otherwise, the default hash is used as a fallback.
 */
type ClassNameSlug = (hash: string, label: string, styleString: string) => string;
/**
 * A callback function called when an invalid slug is returned from ClassNameSlug.
 *
 * @param slug - The invalid slug
 */
type OnInvalidSlug = (slug: string) => void;
//#endregion
export { rawCssString as a, OnInvalidSlug as i, CssClassName as n, CssVariableType as r, ClassNameSlug as t };