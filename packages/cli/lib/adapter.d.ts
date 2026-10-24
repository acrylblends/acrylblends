import { t as Context } from "./context-Bm7rI-oK.js";

//#region ../../plugins/acryl-router/src/core/helper/adapter/index.d.ts
type Runtime = 'node' | 'deno' | 'bun' | 'workerd' | 'fastly' | 'edge-light' | 'other';
declare const env: <T extends Record<string, unknown>, C extends Context = Context<{
  Bindings: T;
}>>(c: T extends Record<string, unknown> ? Context : C, runtime?: Runtime) => T & C["env"];
declare const knownUserAgents: Partial<Record<Runtime, string>>;
declare const getRuntimeKey: () => Runtime;
declare const checkUserAgentEquals: (platform: string) => boolean;
//#endregion
export { Runtime, checkUserAgentEquals, env, getRuntimeKey, knownUserAgents };