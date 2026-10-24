//#region ../../plugins/acryl-router/src/core/utils/handler.d.ts
/**
 * @module
 * Handler utility.
 */
declare const isMiddleware: (handler: Function) => boolean;
declare const findTargetHandler: (handler: Function) => Function;
//#endregion
export { findTargetHandler, isMiddleware };