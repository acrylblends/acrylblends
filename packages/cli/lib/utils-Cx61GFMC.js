//#region ../../plugins/acryl-router/src/core/client/fetch-result-please.ts
/**
* @description This file is a modified version of `fetch-result-please` (`ofetch`), minimalized and adapted to Acryl's custom needs.
*
* @link https://www.npmjs.com/package/fetch-result-please
*/
const nullBodyResponses = /* @__PURE__ */ new Set([
	101,
	204,
	205,
	304
]);
/**
* Smartly parses and return the consumable result from a fetch `Response`.
*
* Throwing a structured error if the response is not `ok`. ({@link DetailedError})
*/
async function fetchRP(fetchRes) {
	const _fetchRes = await fetchRes;
	if ((_fetchRes.body || _fetchRes._bodyInit) && !nullBodyResponses.has(_fetchRes.status)) _fetchRes._data = await _fetchRes[detectResponseType(_fetchRes)]();
	if (!_fetchRes.ok) throw new DetailedError(`${_fetchRes.status} ${_fetchRes.statusText}`, {
		statusCode: _fetchRes?.status,
		detail: {
			data: _fetchRes?._data,
			statusText: _fetchRes?.statusText
		}
	});
	return _fetchRes._data;
}
var DetailedError = class extends Error {
	/**
	* Additional `message` that will be logged AND returned to client
	*/
	detail;
	/**
	* Additional `code` that will be logged AND returned to client
	*/
	code;
	/**
	* Additional value that will be logged AND NOT returned to client
	*/
	log;
	/**
	* Optionally set the status code to return, in a web server context
	*/
	statusCode;
	constructor(message, options = {}) {
		super(message);
		this.name = "DetailedError";
		this.log = options.log;
		this.detail = options.detail;
		this.code = options.code;
		this.statusCode = options.statusCode;
	}
};
const jsonRegex = /^application\/(?:[\w!#$%&*.^`~-]*\+)?json(?:;.+)?$/i;
function detectResponseType(response) {
	const _contentType = response.headers.get("content-type");
	if (!_contentType) return "text";
	const contentType = _contentType.split(";").shift();
	if (jsonRegex.test(contentType)) return "json";
	return "text";
}
//#endregion
//#region ../../plugins/acryl-router/src/core/client/utils.ts
const mergePath = (base, path) => {
	base = base.replace(/\/+$/, "");
	base = base + "/";
	path = path.replace(/^\/+/, "");
	return base + path;
};
const replaceUrlParam = (urlString, params) => {
	for (const [k, v] of Object.entries(params)) {
		const reg = new RegExp("/:" + k + "(?:{[^/]+})?\\??(?=/|$)");
		urlString = urlString.replace(reg, () => v ? `/${v}` : "");
	}
	return urlString;
};
const buildSearchParams = (query) => {
	const searchParams = new URLSearchParams();
	for (const [k, v] of Object.entries(query)) {
		if (v === void 0) continue;
		if (Array.isArray(v)) for (const v2 of v) {
			if (v2 === void 0) continue;
			searchParams.append(k, v2);
		}
		else searchParams.set(k, v);
	}
	return searchParams;
};
const replaceUrlProtocol = (urlString, protocol) => {
	switch (protocol) {
		case "ws": return urlString.replace(/^http/, "ws");
		case "http": return urlString.replace(/^ws/, "http");
	}
};
const removeIndexString = (urlString) => {
	if (/^https?:\/\/[^\/]+?\/index(?=\?|$)/.test(urlString)) return urlString.replace(/\/index(?=\?|$)/, "/");
	return urlString.replace(/\/index(?=\?|$)/, "");
};
function isObject(item) {
	return typeof item === "object" && item !== null && !Array.isArray(item);
}
function deepMerge(target, source) {
	if (!isObject(target) && !isObject(source)) return source;
	const merged = { ...target };
	for (const key in source) {
		const value = source[key];
		if (isObject(merged[key]) && isObject(value)) merged[key] = deepMerge(merged[key], value);
		else merged[key] = value;
	}
	return merged;
}
/**
* Shortcut to get a consumable response from `hc`'s fetch calls (Response), with types inference.
*
* Smartly parse the response data, throwing a structured error if the response is not `ok`. ({@link DetailedError})
*
* @example const result = await parseResponse(client.posts.$get())
*/
async function parseResponse(fetchRes) {
	return fetchRP(fetchRes);
}
//#endregion
export { removeIndexString as a, DetailedError as c, parseResponse as i, deepMerge as n, replaceUrlParam as o, mergePath as r, replaceUrlProtocol as s, buildSearchParams as t };
