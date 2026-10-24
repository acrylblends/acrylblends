import { t as hc } from "./client-BHTr318g.js";
//#region ../../plugins/acryl-router/src/core/helper/testing/index.ts
/**
* @module
* Testing Helper for Acryl.
*/
const testClient = (app, Env, executionCtx, options) => {
	const customFetch = (input, init) => {
		return app.request(input, init, Env, executionCtx);
	};
	return hc("http://localhost", {
		...options,
		fetch: customFetch
	});
};
//#endregion
export { testClient };
