import { L as MiddlewareHandler, Y as Schema, t as Context, v as Env } from "./context-DS3fYyG-.js";
import { t as Acryl } from "./app-D8riatvv.js";

//#region ../../plugins/acryl-router/src/core/helper/ssg/ssg.d.ts
declare const DEFAULT_OUTPUT_DIR = "./static";
/**
 * @experimental
 * `FileSystemModule` is an experimental feature.
 * The API might be changed.
 */
interface FileSystemModule {
  writeFile(path: string, data: string | Uint8Array): Promise<void>;
  mkdir(path: string, options: {
    recursive: boolean;
  }): Promise<void | string>;
}
/**
 * @experimental
 * `ToSSGResult` is an experimental feature.
 * The API might be changed.
 */
interface ToSSGResult {
  success: boolean;
  files: string[];
  error?: Error;
}
declare const defaultExtensionMap: Record<string, string>;
type BeforeRequestHook = (req: Request) => Request | false | Promise<Request | false>;
type AfterResponseHook = (res: Response) => Response | false | Promise<Response | false>;
type AfterGenerateHook = (result: ToSSGResult, fsModule: FileSystemModule, options?: ToSSGOptions) => void | Promise<void>;
declare const combineBeforeRequestHooks: (hooks: BeforeRequestHook | BeforeRequestHook[]) => BeforeRequestHook;
declare const combineAfterResponseHooks: (hooks: AfterResponseHook | AfterResponseHook[]) => AfterResponseHook;
declare const combineAfterGenerateHooks: (hooks: AfterGenerateHook | AfterGenerateHook[], fsModule: FileSystemModule, options?: ToSSGOptions) => AfterGenerateHook;
interface SSGPlugin {
  beforeRequestHook?: BeforeRequestHook | BeforeRequestHook[];
  afterResponseHook?: AfterResponseHook | AfterResponseHook[];
  afterGenerateHook?: AfterGenerateHook | AfterGenerateHook[];
}
interface ToSSGOptions {
  dir?: string;
  /**
   * @deprecated Use plugins[].beforeRequestHook instead.
   */
  beforeRequestHook?: BeforeRequestHook | BeforeRequestHook[];
  /**
   * @deprecated Use plugins[].afterResponseHook instead.
   */
  afterResponseHook?: AfterResponseHook | AfterResponseHook[];
  /**
   * @deprecated Use plugins[].afterGenerateHook instead.
   */
  afterGenerateHook?: AfterGenerateHook | AfterGenerateHook[];
  concurrency?: number;
  extensionMap?: Record<string, string>;
  plugins?: SSGPlugin[];
}
/**
 * @experimental
 * `fetchRoutesContent` is an experimental feature.
 * The API might be changed.
 */
declare const fetchRoutesContent: <E extends Env = Env, S extends Schema = {}, BasePath extends string = "/">(app: Acryl<E, S, BasePath>, beforeRequestHook?: BeforeRequestHook, afterResponseHook?: AfterResponseHook, concurrency?: number) => Generator<Promise<Generator<Promise<{
  routePath: string;
  mimeType: string;
  content: string | ArrayBuffer;
} | undefined>> | undefined>>;
declare const saveContentToFile: (data: Promise<{
  routePath: string;
  content: string | ArrayBuffer;
  mimeType: string;
} | undefined>, fsModule: FileSystemModule, outDir: string, extensionMap?: Record<string, string>) => Promise<string | undefined>;
/**
 * @experimental
 * `ToSSGInterface` is an experimental feature.
 * The API might be changed.
 */
interface ToSSGInterface {
  (app: Acryl<any, any, any>, fsModule: FileSystemModule, options?: ToSSGOptions): Promise<ToSSGResult>;
}
/**
 * @experimental
 * `ToSSGAdaptorInterface` is an experimental feature.
 * The API might be changed.
 */
interface ToSSGAdaptorInterface<E extends Env = Env, S extends Schema = {}, BasePath extends string = '/'> {
  (app: Acryl<E, S, BasePath>, options?: ToSSGOptions): Promise<ToSSGResult>;
}
/**
 * @experimental
 * `toSSG` is an experimental feature.
 * The API might be changed.
 */
declare const toSSG: ToSSGInterface;
//#endregion
//#region ../../plugins/acryl-router/src/core/helper/ssg/middleware.d.ts
declare const X_ACRYL_DISABLE_SSG_HEADER_KEY = "x-acryl-disable-ssg";
interface SSGParam {
  [key: string]: string;
}
type SSGParams = SSGParam[];
interface SSGParamsMiddleware {
  <E extends Env = Env>(generateParams: (c: Context<E>) => SSGParams | Promise<SSGParams>): MiddlewareHandler<E>;
  <E extends Env = Env>(params: SSGParams): MiddlewareHandler<E>;
}
/**
 * Define SSG Route
 */
declare const ssgParams: SSGParamsMiddleware;
/**
 * @experimental
 * `isSSGContext` is an experimental feature.
 * The API might be changed.
 */
declare const isSSGContext: (c: Context) => boolean;
/**
 * @experimental
 * `disableSSG` is an experimental feature.
 * The API might be changed.
 */
declare const disableSSG: () => MiddlewareHandler;
/**
 * @experimental
 * `onlySSG` is an experimental feature.
 * The API might be changed.
 */
declare const onlySSG: () => MiddlewareHandler;
//#endregion
//#region ../../plugins/acryl-router/src/core/helper/ssg/plugins.d.ts
/**
 * The default plugin that defines the recommended behavior.
 *
 * @experimental
 * `defaultPlugin` is an experimental feature.
 * The API might be changed.
 */
declare const defaultPlugin: () => SSGPlugin;
/**
 * The redirect plugin that generates HTML redirect pages for HTTP redirect responses for status codes 301, 302, 303, 307 and 308.
 *
 * When used with `defaultPlugin`, place `redirectPlugin` before it, because `defaultPlugin` skips non-200 responses.
 *
 * ```ts
 * // ✅ Will work as expected
 * toSSG(app, fs, { plugins: [redirectPlugin(), defaultPlugin()] })
 *
 * // ❌ Will not work as expected
 * toSSG(app, fs, { plugins: [defaultPlugin(), redirectPlugin()] })
 * ```
 *
 * @experimental
 * `redirectPlugin` is an experimental feature.
 * The API might be changed.
 */
declare const redirectPlugin: () => SSGPlugin;
//#endregion
export { AfterGenerateHook, AfterResponseHook, BeforeRequestHook, DEFAULT_OUTPUT_DIR, FileSystemModule, SSGPlugin, ToSSGAdaptorInterface, ToSSGInterface, ToSSGOptions, ToSSGResult, X_ACRYL_DISABLE_SSG_HEADER_KEY, combineAfterGenerateHooks, combineAfterResponseHooks, combineBeforeRequestHooks, defaultExtensionMap, defaultPlugin, disableSSG, fetchRoutesContent, isSSGContext, onlySSG, redirectPlugin, saveContentToFile, ssgParams, toSSG };