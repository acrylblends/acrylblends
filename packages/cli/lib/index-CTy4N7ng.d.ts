import { Y as Schema, g as BlankSchema, j as Input, m as BlankEnv, s as AcrylRequest, v as Env } from "./context-DS3fYyG-.js";
import { t as Acryl } from "./app-D8riatvv.js";

//#region ../../plugins/acryl-router/src/deprecated.d.ts
/** @deprecated Use `Acryl` (`new Acryl()`); `App` is the 0.4 name and goes away in the next release. */
declare const App: typeof Acryl;
/** @deprecated Use `Acryl`; `App` is the 0.4 name and goes away in the next release. */
type App<E extends Env = BlankEnv, S extends Schema = BlankSchema, BasePath extends string = '/'> = Acryl<E, S, BasePath>;
/** @deprecated Use `AcrylRequest`; `AppRequest` is the 0.4 name and goes away in the next release. */
type AppRequest<P extends string = '/', I extends Input['out'] = {}> = AcrylRequest<P, I>;
//#endregion
export { AppRequest as n, App as t };