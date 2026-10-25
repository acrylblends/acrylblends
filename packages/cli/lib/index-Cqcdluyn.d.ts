import { A as Input, J as Schema, _ as Env, h as BlankSchema, o as AcrylRequest, p as BlankEnv } from "./context-DVQBjuns.js";
import { t as Acryl } from "./app-wFwpg-bt.js";

//#region ../../plugins/acryl-router/src/deprecated.d.ts
/** @deprecated Use `Acryl` (`new Acryl()`); `App` is the 0.4 name and goes away in the next release. */
declare const App: typeof Acryl;
/** @deprecated Use `Acryl`; `App` is the 0.4 name and goes away in the next release. */
type App<E extends Env = BlankEnv, S extends Schema = BlankSchema, BasePath extends string = '/'> = Acryl<E, S, BasePath>;
/** @deprecated Use `AcrylRequest`; `AppRequest` is the 0.4 name and goes away in the next release. */
type AppRequest<P extends string = '/', I extends Input['out'] = {}> = AcrylRequest<P, I>;
//#endregion
export { AppRequest as n, App as t };