//#region ../../plugins/acryl-router/src/core/utils/html.d.ts
/**
 * @module
 * HTML utility.
 */
declare const HtmlEscapedCallbackPhase: {
  readonly Stringify: 1;
  readonly BeforeStream: 2;
  readonly Stream: 3;
};
type HtmlEscapedCallbackOpts = {
  buffer?: [string];
  phase: (typeof HtmlEscapedCallbackPhase)[keyof typeof HtmlEscapedCallbackPhase];
  context: Readonly<object>;
};
type HtmlEscapedCallback = (opts: HtmlEscapedCallbackOpts) => Promise<string> | undefined;
type HtmlEscaped = {
  isEscaped: true;
  callbacks?: HtmlEscapedCallback[];
};
type HtmlEscapedString = string & HtmlEscaped;
/**
 * StringBuffer contains string and Promise<string> alternately
 * The length of the array will be odd, the odd numbered element will be a string,
 * and the even numbered element will be a Promise<string>.
 * When concatenating into a single string, it must be processed from the tail.
 * @example
 * [
 *   'framework.',
 *   Promise.resolve('ultra fast'),
 *   'a ',
 *   Promise.resolve('is '),
 *   'Acryl',
 * ]
 */
type StringBuffer = (string | Promise<string>)[];
type StringBufferWithCallbacks = StringBuffer & {
  callbacks: HtmlEscapedCallback[];
};
declare const raw: (value: unknown, callbacks?: HtmlEscapedCallback[]) => HtmlEscapedString;
declare const stringBufferToString: (buffer: StringBuffer, callbacks: HtmlEscapedCallback[] | undefined) => Promise<HtmlEscapedString>;
declare const escapeToBuffer: (str: string, buffer: StringBuffer) => void;
declare const resolveCallbackSync: (str: string | HtmlEscapedString) => string;
declare const resolveCallback: (str: string | HtmlEscapedString | Promise<string>, phase: (typeof HtmlEscapedCallbackPhase)[keyof typeof HtmlEscapedCallbackPhase], preserveCallbacks: boolean, context: object, buffer?: [string]) => Promise<string>;
//#endregion
export { StringBuffer as a, raw as c, stringBufferToString as d, HtmlEscapedString as i, resolveCallback as l, HtmlEscapedCallback as n, StringBufferWithCallbacks as o, HtmlEscapedCallbackPhase as r, escapeToBuffer as s, HtmlEscaped as t, resolveCallbackSync as u };