import { J as Schema, a as ExecutionContext } from "./context-Bm7rI-oK.js";
import { T as UnionToIntersection } from "./types-CwrQjlaM.js";
import { t as Acryl } from "./app-CmAYW1Al.js";
import { i as ClientRequestOptions, n as Client } from "./types-CHesD1KG.js";

//#region ../../plugins/acryl-router/src/core/helper/testing/index.d.ts
type ExtractEnv<T> = T extends Acryl<infer E, Schema, string> ? E : never;
declare const testClient: <T extends Acryl<any, Schema, string>>(app: T, Env?: ExtractEnv<T>["Bindings"] | {}, executionCtx?: ExecutionContext, options?: Omit<ClientRequestOptions, "fetch">) => UnionToIntersection<Client<T, "http://localhost">>;
//#endregion
export { testClient };