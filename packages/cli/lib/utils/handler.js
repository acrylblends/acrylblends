import { COMPOSED_HANDLER } from "./constants.js";
//#region ../../plugins/acryl-router/src/core/utils/handler.ts
/**
* @module
* Handler utility.
*/
const isMiddleware = (handler) => handler.length > 1;
const findTargetHandler = (handler) => {
	return handler["__COMPOSED_HANDLER"] ? findTargetHandler(handler[COMPOSED_HANDLER]) : handler;
};
//#endregion
export { findTargetHandler, isMiddleware };
