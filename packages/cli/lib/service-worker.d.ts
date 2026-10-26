import { Y as Schema, v as Env } from "./context-DS3fYyG-.js";
import { t as Acryl } from "./app-D8riatvv.js";

//#region ../../plugins/acryl-router/src/core/adapter/service-worker/types.d.ts
interface ExtendableEvent extends Event {
  waitUntil(f: Promise<any>): void;
}
interface FetchEvent extends ExtendableEvent {
  readonly clientId: string;
  readonly handled: Promise<void>;
  readonly preloadResponse: Promise<any>;
  readonly request: Request;
  readonly resultingClientId: string;
  respondWith(r: Response | PromiseLike<Response>): void;
}
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/service-worker/handler.d.ts
type Handler = (evt: FetchEvent) => void;
type HandleOptions = {
  fetch?: typeof fetch;
};
/**
 * Adapter for Service Worker
 */
declare const handle: <E extends Env, S extends Schema, BasePath extends string>(app: Acryl<E, S, BasePath>, opts?: HandleOptions) => Handler;
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/service-worker/index.d.ts
/**
 * Registers a Acryl app to handle fetch events in a service worker.
 * This sets up `addEventListener('fetch', handle(app, options))` for the provided app.
 *
 * @param app - The Acryl application instance
 * @param options - Options for handling requests (fetch defaults to undefined)
 * @example
 * ```ts
 * import { Acryl } from 'acrylblends'
 * import { fire } from 'acrylblends/service-worker'
 *
 * const app = new Acryl()
 *
 * app.get('/', (c) => c.text('Hi'))
 *
 * fire(app)
 * ```
 */
declare const fire: <E extends Env, S extends Schema, BasePath extends string>(app: Acryl<E, S, BasePath>, options?: HandleOptions) => void;
//#endregion
export { fire, handle };