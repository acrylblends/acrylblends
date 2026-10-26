import { HTTPException } from "./http-exception.js";
import { t as Context } from "./context-DDO0cfuP.js";
//#region ../../plugins/acryl-router/src/core/adapter/cloudflare-pages/handler.ts
const handle = (app) => (eventContext) => {
	return app.fetch(eventContext.request, {
		...eventContext.env,
		eventContext
	}, {
		waitUntil: eventContext.waitUntil,
		passThroughOnException: eventContext.passThroughOnException,
		props: {}
	});
};
function handleMiddleware(middleware) {
	return async (executionCtx) => {
		const context = new Context(executionCtx.request, {
			env: {
				...executionCtx.env,
				eventContext: executionCtx
			},
			executionCtx
		});
		let response = void 0;
		try {
			response = await middleware(context, async () => {
				try {
					context.res = await executionCtx.next();
				} catch (error) {
					if (error instanceof Error) context.error = error;
					else throw error;
				}
			});
		} catch (error) {
			if (error instanceof Error) context.error = error;
			else throw error;
		}
		if (response) return response;
		if (context.error instanceof HTTPException) return context.error.getResponse();
		if (context.error) throw context.error;
		return context.res;
	};
}
/**
*
* @description `serveStatic()` is for advanced mode:
* https://developers.cloudflare.com/pages/platform/functions/advanced-mode/#set-up-a-function
*/
const serveStatic = () => {
	return async (c) => {
		const res = await c.env.ASSETS.fetch(c.req.raw);
		if (res.status === 404) return c.notFound();
		return res;
	};
};
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/cloudflare-pages/conninfo.ts
/**
* Get connection information from Cloudflare Pages
* @param c - Context
* @returns Connection information including remote address
* @example
* ```ts
* import { Acryl } from 'acrylblends'
* import { handle, getConnInfo } from 'acrylblends/cloudflare-pages'
*
* const app = new Acryl()
*
* app.get('/', (c) => {
*   const info = getConnInfo(c)
*   return c.text(`Your IP: ${info.remote.address}`)
* })
*
* export const onRequest = handle(app)
* ```
*/
const getConnInfo = (c) => ({ remote: { address: c.req.header("cf-connecting-ip") } });
//#endregion
export { getConnInfo, handle, handleMiddleware, serveStatic };
