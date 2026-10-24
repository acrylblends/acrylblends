//#region ../../plugins/acryl-router/src/core/middleware/powered-by/index.ts
/**
* Powered By Middleware for Acryl.
*
* @param options - The options for the Powered By Middleware.
* @returns {MiddlewareHandler} The middleware handler function.
*
* @example
* ```ts
* import { poweredBy } from 'acrylblends/powered-by'
*
* const app = new Acryl()
*
* app.use(poweredBy()) // With options: poweredBy({ serverName: "My Server" })
* ```
*/
const poweredBy = (options) => {
	return async function poweredBy(c, next) {
		await next();
		c.res.headers.set("X-Powered-By", options?.serverName ?? "Acryl");
	};
};
//#endregion
export { poweredBy };
