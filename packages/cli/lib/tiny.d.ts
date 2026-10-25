import { Y as Schema, et as Acryl$1, g as BlankSchema, m as BlankEnv, tt as AcrylOptions, v as Env } from "./context-DS3fYyG-.js";

//#region ../../plugins/acryl-router/src/core/preset/tiny.d.ts
declare class Acryl<E extends Env = BlankEnv, S extends Schema = BlankSchema, BasePath extends string = '/'> extends Acryl$1<E, S, BasePath> {
  constructor(options?: AcrylOptions<E>);
}
//#endregion
export { Acryl };