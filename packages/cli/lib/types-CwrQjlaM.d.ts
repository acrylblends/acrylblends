//#region ../../plugins/acryl-router/src/core/utils/types.d.ts
/**
 * @module
 * Types utility.
 */
type Expect<T extends true> = T;
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
type NotEqual<X, Y> = true extends Equal<X, Y> ? false : true;
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;
type RemoveBlankRecord<T> = T extends Record<infer K, unknown> ? (K extends string ? T : never) : never;
type IfAnyThenEmptyObject<T> = 0 extends 1 & T ? {} : T;
type JSONPrimitive = string | boolean | number | null;
type JSONArray = (JSONPrimitive | JSONObject | JSONArray)[];
type JSONObject = {
  [key: string]: JSONPrimitive | JSONArray | JSONObject | object | InvalidJSONValue;
};
type InvalidJSONValue = undefined | symbol | ((...args: unknown[]) => unknown);
type InvalidToNull<T> = T extends InvalidJSONValue ? null : T;
type IsInvalid<T> = T extends InvalidJSONValue ? true : false;
/**
 * symbol keys are omitted through `JSON.stringify`
 */
type OmitSymbolKeys<T> = { [K in keyof T as K extends symbol ? never : K]: T[K] };
type JSONValue = JSONObject | JSONArray | JSONPrimitive;
/**
 * Convert a type to a JSON-compatible type.
 *
 * Non-JSON values such as `Date` implement `.toJSON()`,
 * so they can be transformed to a value assignable to `JSONObject`
 *
 * `JSON.stringify()` throws a `TypeError` when it encounters a `bigint` value,
 * unless a custom `replacer` function or `.toJSON()` method is provided.
 *
 * This behavior can be controlled by the `TError` generic type parameter,
 * which defaults to `bigint | ReadonlyArray<bigint>`.
 * You can set it to `never` to disable this check.
 */
type JSONParsed<T, TError = bigint | ReadonlyArray<bigint>> = T extends {
  toJSON(): infer J;
} ? (() => J) extends (() => JSONPrimitive) ? J : (() => J) extends (() => {
  toJSON(): unknown;
}) ? {} : JSONParsed<J, TError> : T extends JSONPrimitive ? T : T extends InvalidJSONValue ? never : T extends ReadonlyArray<unknown> ? { [K in keyof T]: JSONParsed<InvalidToNull<T[K]>, TError> } extends infer A ? A extends ReadonlyArray<unknown> ? A : JSONParsed<InvalidToNull<T[number]>, TError>[] : never : T extends Set<unknown> | Map<unknown, unknown> | Record<string, never> ? {} : T extends object ? T[keyof T] extends TError ? never : { [K in keyof OmitSymbolKeys<T> as IsInvalid<T[K]> extends true ? never : K]: boolean extends IsInvalid<T[K]> ? JSONParsed<T[K], TError> | undefined : JSONParsed<T[K], TError> } : T extends unknown ? T extends TError ? never : JSONValue : never;
/**
 * Useful to flatten the type output to improve type hints shown in editors. And also to transform an interface into a type to aide with assignability.
 * @copyright from sindresorhus/type-fest
 */
type Simplify<T> = { [KeyType in keyof T]: T[KeyType] } & {};
/**
 * A simple extension of Simplify that will deeply traverse array elements.
 */
type SimplifyDeepArray<T> = T extends any[] ? { [E in keyof T]: SimplifyDeepArray<T[E]> } : Simplify<T>;
type InterfaceToType<T> = T extends Function ? T : { [K in keyof T]: InterfaceToType<T[K]> };
type RequiredKeysOf<BaseType extends object> = Exclude<{ [Key in keyof BaseType]: BaseType extends Record<Key, BaseType[Key]> ? Key : never }[keyof BaseType], undefined>;
type HasRequiredKeys<BaseType extends object> = RequiredKeysOf<BaseType> extends never ? false : true;
type IsAny<T> = boolean extends (T extends never ? true : false) ? true : false;
/**
 * String literal types with auto-completion
 * @see https://github.com/Microsoft/TypeScript/issues/29729
 */
type StringLiteralUnion<T> = T | (string & Record<never, never>);
/** Bytes a Web Crypto call accepts; declared here so the public types do not need the DOM library. */
type BufferSource = ArrayBufferView<ArrayBuffer> | ArrayBuffer;
/** A Web Crypto key, named from the runtime's own `crypto` so the public types do not need the DOM library. */
type CryptoKey = Awaited<ReturnType<typeof crypto.subtle.importKey>>;
/** How a WebSocket hands binary data to `onmessage`; declared here so the public types do not need the DOM library. */
type BinaryType = 'arraybuffer' | 'blob';
/** The members of a WebSocket `message` event the helpers hand out (the Web `MessageEvent`, whose Node global is not generic); declared here so the public types do not need the DOM library. */
interface MessageEvent<T = unknown> extends Event {
  readonly data: T;
  readonly lastEventId: string;
  readonly origin: string;
}
/** The members of a WebSocket `close` event the helpers hand out (the Web `CloseEvent`, which Node has no global type for); declared here so the public types do not need the DOM library. */
interface CloseEvent extends Event {
  readonly code: number;
  readonly reason: string;
  readonly wasClean: boolean;
}
/** A JSON Web Key (RFC 7517), the same members as the Web Crypto dictionary; declared here so the public types do not need the DOM library. */
interface JsonWebKey {
  alg?: string;
  crv?: string;
  d?: string;
  dp?: string;
  dq?: string;
  e?: string;
  ext?: boolean;
  k?: string;
  key_ops?: string[];
  kty?: string;
  n?: string;
  oth?: {
    d?: string;
    r?: string;
    t?: string;
  }[];
  p?: string;
  q?: string;
  qi?: string;
  use?: string;
  x?: string;
  y?: string;
}
//#endregion
export { SimplifyDeepArray as C, Simplify as S, UnionToIntersection as T, JsonWebKey as _, Equal as a, RemoveBlankRecord as b, IfAnyThenEmptyObject as c, IsAny as d, JSONArray as f, JSONValue as g, JSONPrimitive as h, CryptoKey as i, InterfaceToType as l, JSONParsed as m, BufferSource as n, Expect as o, JSONObject as p, CloseEvent as r, HasRequiredKeys as s, BinaryType as t, InvalidJSONValue as u, MessageEvent as v, StringLiteralUnion as w, RequiredKeysOf as x, NotEqual as y };