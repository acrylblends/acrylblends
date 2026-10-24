import { AcrylBase as Acryl$1 } from "./acryl-base.js";
import { i as RegExpRouter } from "./reg-exp-router-DC1R3qoY.js";
import { t as SmartRouter } from "./smart-router-C5CZ5XSM.js";
import { t as TrieRouter } from "./trie-router-CfFbapzL.js";
//#region ../../plugins/acryl-router/src/core/app.ts
/**
* The Acryl class extends the functionality of the AcrylBase class.
* It sets up routing and allows for custom options to be passed.
*
* @template E - The environment type.
* @template S - The schema type.
* @template BasePath - The base path type.
*/
var Acryl = class extends Acryl$1 {
	/**
	* Creates an instance of the Acryl class.
	*
	* @param options - Optional configuration options for the Acryl instance.
	*/
	constructor(options = {}) {
		super(options);
		this.router = options.router ?? new SmartRouter({ routers: [new RegExpRouter(), new TrieRouter()] });
	}
};
//#endregion
export { Acryl as t };
