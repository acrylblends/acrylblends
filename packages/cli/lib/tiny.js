import { AcrylBase as Acryl$1 } from "./acryl-base.js";
import { t as PatternRouter } from "./pattern-router-HZxjDGEQ.js";
//#region ../../plugins/acryl-router/src/core/preset/tiny.ts
/**
* @module
* The preset that uses `PatternRouter`.
*/
var Acryl = class extends Acryl$1 {
	constructor(options = {}) {
		super(options);
		this.router = new PatternRouter();
	}
};
//#endregion
export { Acryl };
