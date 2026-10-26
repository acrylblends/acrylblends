//#region ../../plugins/acryl-kv/src/kv.d.ts
/** `T`, except a promise: the callback of `update` is synchronous, and an async one is a type error. */
type NotPromise<T> = T extends PromiseLike<unknown> ? never : T;
/** Anything JSON can hold. */
type JsonValue = null | boolean | number | string | JsonValue[] | {
  [key: string]: JsonValue;
};
/**
 * Named JSON documents. Every call returns a promise, so a file, SQLite and Postgres answer alike.
 *
 * Keys are non-empty strings. Values are JSON: `undefined`, functions, symbols, bigints and non-finite numbers are refused with a
 * `TypeError` before anything is written, and a value read back is a copy.
 *
 * There is no `close`: the code that opened a store closes it (see {@link KvOpened}), so a plugin cannot close the store another uses.
 */
interface Kv {
  /** The value stored under the key, or `undefined`. */
  get<T = JsonValue>(key: string): Promise<T | undefined>;
  /** Store a value under the key, replacing any. Resolves once it is durable. */
  set<T = JsonValue>(key: string, value: T): Promise<void>;
  /**
   * Replace the value under the key by `change(current)`, atomically: `current` is `undefined` when the key is missing, `change` is
   * synchronous (an `async` function is a type error, and a returned promise is rejected at run time: read what you need first, then update), and no other write to the key happens between reading it and writing the result. Resolves the new value. A `change` that
   * throws, or returns something that is not JSON, leaves the value as it was and rejects with its error.
   */
  update<T = JsonValue>(key: string, change: (current: T | undefined) => NotPromise<T>): Promise<T>;
  /** Remove the key. A missing key is not an error. */
  delete(key: string): Promise<void>;
  /** The keys that start with the prefix (all of them without one), sorted by code point (the order of their UTF-8 bytes, not of UTF-16 units). */
  list(prefix?: string): Promise<string[]>;
}
/** An open store and the one function that closes it. */
interface KvOpened {
  readonly kv: Kv;
  /** Waits for the writes in flight, then releases the storage. Calling it again does nothing; calls on `kv` after it reject. */
  close(): Promise<void>;
}
//#endregion
//#region ../../plugins/acryl-kv/src/check.d.ts
/**
 * What every `kv` provider checks the same way, so a bad call fails alike on a file and on SQL: the key, the value, and the order of keys.
 */
/** A key is a non-empty string. */
declare function checkKey(key: unknown): asserts key is string;
/**
 * The JSON text of a value. `undefined`, functions, symbols, bigints, circular structures and non-finite numbers (which JSON would turn
 * into `null`) are refused with a `TypeError`; nothing is stored for them.
 */
declare function encodeValue(value: unknown): string;
/** The value of stored JSON text: a new copy each time, so changing what `get` returned changes nothing stored. */
declare function decodeValue<T>(text: string): T;
/** Order two keys by code point (the order of UTF-8 bytes, which SQLite's binary collation and Postgres' "C" collation give too). */
declare function compareKeys(a: string, b: string): number;
/** The number of code points in a string (what SQL's `substr` counts). */
declare function codePoints(text: string): number;
/**
 * Call an `update` callback and check what it returns: the callback is synchronous, so a promise (an `async` function the types should have
 * refused) is rejected with a message that says what to do, instead of being stored as `{}`.
 */
declare function runChange<T>(change: (current: T | undefined) => T, current: T | undefined): T;
//#endregion
//#region ../../plugins/acryl-kv/src/copy.d.ts
interface CopyKvOptions {
  /** Replace keys the target already has. Without it, a shared key stops the copy before anything is written. */
  readonly overwrite?: boolean;
  /** Copy only the keys that start with this. */
  readonly prefix?: string;
}
interface CopyKvResult {
  /** Keys written to the target. */
  readonly copied: number;
  /** Of those, keys the target already had. */
  readonly overwritten: number;
}
/**
 * Copy every key of one store into another: the import when an app moves from a JSON file to SQL (the file opened with
 * `acryl-kv-json` is the source, `kvOnDb` the target). The source is not changed.
 * @throws when the target has a key the source has and `overwrite` is not set; nothing is written then.
 */
declare function copyKv(source: Kv, target: Kv, options?: CopyKvOptions): Promise<CopyKvResult>;
//#endregion
//#region ../../plugins/acryl-kv/src/index.d.ts
/**
 * The `kv` port: named JSON documents for an app too small for SQL, whichever provider serves it (`acryl-kv-json` for one file,
 * `acryl-kv-db` over the `db` port). Plain code opens a store with a provider's `openKv`; a Cordis plugin declares `inject: ['kv']`, imports
 * `acryl-kv/cordis` for the `ctx.kv` type, and never imports a provider.
 *
 * This entry imports nothing from Cordis, at runtime or in its types.
 */
/** The service name every `kv` provider registers. */
declare const KV_SERVICE = "kv";
//#endregion
export { type CopyKvOptions, type CopyKvResult, type JsonValue, KV_SERVICE, type Kv, type KvOpened, type NotPromise, checkKey, codePoints, compareKeys, copyKv, decodeValue, encodeValue, runChange };