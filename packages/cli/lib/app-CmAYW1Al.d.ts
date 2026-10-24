import { $ as Acryl$1, J as Schema, _ as Env, et as AcrylOptions, h as BlankSchema, p as BlankEnv } from "./context-Bm7rI-oK.js";

//#region ../../plugins/acryl-router/src/core/app.d.ts
/**
 * The Acryl class extends the functionality of the AcrylBase class.
 * It sets up routing and allows for custom options to be passed.
 *
 * @template E - The environment type.
 * @template S - The schema type.
 * @template BasePath - The base path type.
 */
declare class Acryl<E extends Env = BlankEnv, S extends Schema = BlankSchema, BasePath extends string = '/'> extends Acryl$1<E, S, BasePath> {
  /**
   * Creates an instance of the Acryl class.
   *
   * @param options - Optional configuration options for the Acryl instance.
   */
  constructor(options?: AcrylOptions<E>);
}
//#endregion
export { Acryl as t };