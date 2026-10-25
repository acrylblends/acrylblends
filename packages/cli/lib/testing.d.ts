import { J as Schema, a as ExecutionContext } from "./context-B5Y1lLha.js";
import { E as UnionToIntersection } from "./types-D9DEXMjE.js";
import { t as Acryl } from "./app-BdrVHBlJ.js";
import { i as ClientRequestOptions, n as Client } from "./types-Bd29gh2o.js";

//#region ../../plugins/acryl-router/src/core/helper/testing/index.d.ts
type ExtractEnv<T> = T extends Acryl<infer E, Schema, string> ? E : never;
declare const testClient: <T extends Acryl<any, Schema, string>>(app: T, Env?: ExtractEnv<T>["Bindings"] | {}, executionCtx?: ExecutionContext, options?: Omit<ClientRequestOptions, "fetch">) => UnionToIntersection<Client<T, "http://localhost">>;
//#endregion
export { testClient };