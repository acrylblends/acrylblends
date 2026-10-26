//#region ../../plugins/acryl-router/src/core/adapter/netlify/handler.ts
const handle = (app) => {
	return (req, context) => {
		return app.fetch(req, { context });
	};
};
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/netlify/conninfo.ts
/**
* Get connection information from Netlify
* @param c - Context
* @returns Connection information including remote address
* @example
* ```ts
* import { Acryl } from 'acrylblends'
* import { handle, getConnInfo } from 'acrylblends/netlify'
*
* const app = new Acryl()
*
* app.get('/', (c) => {
*   const info = getConnInfo(c)
*   return c.text(`Your IP: ${info.remote.address}`)
* })
*
* export default handle(app)
* ```
*/
const getConnInfo = (c) => ({ remote: { address: c.env.context?.ip } });
//#endregion
export { getConnInfo, handle };
