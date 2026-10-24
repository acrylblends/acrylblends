//#region ../../plugins/acryl-router/src/core/utils/concurrent.d.ts
/**
 * @module
 * Concurrent utility.
 */
interface Pool {
  run<T>(fn: () => T): Promise<T>;
}
declare const createPool: ({
  concurrency,
  interval
}?: {
  concurrency?: number;
  interval?: number;
}) => Pool;
//#endregion
export { Pool, createPool };