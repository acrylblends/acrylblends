import { Y as Schema, et as Acryl$1, g as BlankSchema, m as BlankEnv, tt as AcrylOptions, v as Env } from "./context-DS3fYyG-.js";

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