import { AcrylBase as Acryl$1 } from "./acryl-base.js";
import { t as SmartRouter } from "./smart-router-C5CZ5XSM.js";
import { t as TrieRouter } from "./trie-router-CfFbapzL.js";
import { t as LinearRouter } from "./linear-router-C3FPib6h.js";
//#region ../../plugins/acryl-router/src/core/preset/quick.ts
/**
* @module
* The preset that uses `LinearRouter`.
*/
var Acryl = class extends Acryl$1 {
	constructor(options = {}) {
		super(options);
		this.router = new SmartRouter({ routers: [new LinearRouter(), new TrieRouter()] });
	}
};
//#endregion
export { Acryl };
