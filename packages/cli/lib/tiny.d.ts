import { $ as Acryl$1, J as Schema, _ as Env, et as AcrylOptions, h as BlankSchema, p as BlankEnv } from "./context-DVQBjuns.js";

//#region ../../plugins/acryl-router/src/core/preset/tiny.d.ts
declare class Acryl<E extends Env = BlankEnv, S extends Schema = BlankSchema, BasePath extends string = '/'> extends Acryl$1<E, S, BasePath> {
  constructor(options?: AcrylOptions<E>);
}
//#endregion
export { Acryl };