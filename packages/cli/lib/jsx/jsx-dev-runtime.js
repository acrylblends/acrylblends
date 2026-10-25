import { s as jsxFn, t as Fragment } from "../base-NSN_SNv-.js";
//#region ../../plugins/acryl-router/src/core/jsx/jsx-dev-runtime.ts
function jsxDEV(tag, props, key) {
	let node;
	if (!props || !("children" in props)) node = jsxFn(tag, props, []);
	else {
		const children = props.children;
		node = Array.isArray(children) ? jsxFn(tag, props, children) : jsxFn(tag, props, [children]);
	}
	node.key = key;
	return node;
}
//#endregion
export { Fragment, jsxDEV };
