import { AsyncLocalStorage } from "node:async_hooks";
//#region ../../plugins/acryl-router/src/core/middleware/context-storage/index.ts
/**
* @module
* Context Storage Middleware for Acryl.
*/
const asyncLocalStorage = new AsyncLocalStorage();
/**
* Context Storage Middleware for Acryl.
*
*
* @returns {MiddlewareHandler} The middleware handler function.
*
* @example
* ```ts
* type Env = {
*   Variables: {
*     message: string
*   }
* }
*
* const app = new Acryl<Env>()
*
* app.use(contextStorage())
*
* app.use(async (c, next) => {
*   c.set('message', 'Acryl is hot!!')
*   await next()
* })
*
* app.get('/', async (c) => c.text(getMessage()))
*
* const getMessage = () => {
*   return getContext<Env>().var.message
* }
* ```
*/
const contextStorage = () => {
	return async function contextStorage(c, next) {
		await asyncLocalStorage.run(c, next);
	};
};
const tryGetContext = () => {
	return asyncLocalStorage.getStore();
};
const getContext = () => {
	const context = tryGetContext();
	if (!context) throw new Error("Context is not available");
	return context;
};
//#endregion
export { contextStorage, getContext, tryGetContext };
