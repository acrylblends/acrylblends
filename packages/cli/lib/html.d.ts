import { HtmlEscapedString, raw } from "./utils/html.js";

//#region ../../plugins/acryl-router/src/core/helper/html/index.d.ts
declare const html: (strings: TemplateStringsArray, ...values: unknown[]) => HtmlEscapedString | Promise<HtmlEscapedString>;
//#endregion
export { html, raw };