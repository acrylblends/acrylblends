import { h as styleObjectForEach, p as isValidAttributeName, t as Fragment } from "../base-ddiVmiE7.js";
import { escapeToBuffer, raw, stringBufferToString } from "../utils/html.js";
import { html } from "../html.js";
import { jsxDEV } from "./jsx-dev-runtime.js";
//#region ../../plugins/acryl-router/src/core/jsx/jsx-runtime.ts
const jsxAttr = (key, v) => {
	if (!isValidAttributeName(key)) return raw("");
	const buffer = [`${key}="`];
	if (key === "style" && typeof v === "object") {
		let styleStr = "";
		styleObjectForEach(v, (property, value) => {
			if (value != null) styleStr += `${styleStr ? ";" : ""}${property}:${value}`;
		});
		escapeToBuffer(styleStr, buffer);
		buffer[0] += "\"";
	} else if (typeof v === "string") {
		escapeToBuffer(v, buffer);
		buffer[0] += "\"";
	} else if (v === null || v === void 0) return raw("");
	else if (typeof v === "number" || v.isEscaped) buffer[0] += `${v}"`;
	else if (v instanceof Promise) buffer.unshift("\"", v);
	else {
		escapeToBuffer(v.toString(), buffer);
		buffer[0] += "\"";
	}
	return buffer.length === 1 ? raw(buffer[0]) : stringBufferToString(buffer, void 0);
};
const jsxEscape = (value) => value;
//#endregion
export { Fragment, jsxDEV as jsx, jsxDEV as jsxs, jsxAttr, jsxEscape, html as jsxTemplate };
