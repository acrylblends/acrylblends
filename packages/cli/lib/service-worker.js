//#region ../../plugins/acryl-router/src/core/adapter/service-worker/handler.ts
/**
* Adapter for Service Worker
*/
const handle = (app, opts = { fetch: globalThis.fetch.bind(globalThis) }) => {
	return (evt) => {
		evt.respondWith((async () => {
			const res = await app.fetch(evt.request, {}, evt);
			if (opts.fetch && res.status === 404) return await opts.fetch(evt.request);
			return res;
		})());
	};
};
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/service-worker/index.ts
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
const fire = (app, options) => {
	addEventListener("fetch", handle(app, options));
};
//#endregion
export { fire, handle };
