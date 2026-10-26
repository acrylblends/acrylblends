//#region ../../plugins/acryl-router/src/core/adapter/vercel/handler.ts
const handle = (app) => (req) => {
	return app.fetch(req);
};
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/vercel/conninfo.ts
const getConnInfo = (c) => ({ remote: { address: c.req.header("x-real-ip") } });
//#endregion
export { getConnInfo, handle };
