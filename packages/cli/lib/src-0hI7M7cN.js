import { t as Acryl } from "./app-BM0rTCp7.js";
//#region ../../plugins/acryl-router/src/core/index.ts
/**
* @module
*
* Acryl - Web Framework built on Web Standards
*
* @example
* ```ts
* import { Acryl } from 'acrylblends'
* const app = new Acryl()
*
* app.get('/', (c) => c.text('Acryl!'))
*
* export default app
* ```
*/
//#endregion
//#region ../../plugins/acryl-router/src/deprecated.ts
/**
* The 0.4 names, kept for one release so code written against them keeps working: `App` is now `Acryl` and `AppRequest` is now `AcrylRequest`,
* the upstream names with the project renamed. Not part of the ported core; both the plugin's root and the public package's root export these.
*/
/** @deprecated Use `Acryl` (`new Acryl()`); `App` is the 0.4 name and goes away in the next release. */
const App = Acryl;
//#endregion
export { App as t };
