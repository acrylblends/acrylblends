import { J as Schema, a as ExecutionContext } from "./context-DVQBjuns.js";
import { D as UnionToIntersection } from "./types-Lqx5BxQF.js";
import { t as Acryl } from "./app-wFwpg-bt.js";
import { i as ClientRequestOptions, n as Client } from "./types-CQiGmsWW.js";

//#region ../../plugins/acryl-router/src/core/helper/testing/index.d.ts
type ExtractEnv<T> = T extends Acryl<infer E, Schema, string> ? E : never;
declare const testClient: <T extends Acryl<any, Schema, string>>(app: T, Env?: ExtractEnv<T>["Bindings"] | {}, executionCtx?: ExecutionContext, options?: Omit<ClientRequestOptions, "fetch">) => UnionToIntersection<Client<T, "http://localhost">>;
//#endregion
export { testClient };