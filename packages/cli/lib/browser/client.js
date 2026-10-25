//#region ../../plugins/acryl-router/src/core/utils/cookie.ts
const validCookieNameRegEx = /^[\w!#$%&'*.^`|~+-]+$/;
const _serialize = (name, value, opt = {}) => {
	if (!validCookieNameRegEx.test(name)) throw new Error("Invalid cookie name");
	let cookie = `${name}=${value}`;
	if (name.startsWith("__Secure-") && !opt.secure) throw new Error("__Secure- Cookie must have Secure attributes");
	if (name.startsWith("__Host-")) {
		if (!opt.secure) throw new Error("__Host- Cookie must have Secure attributes");
		if (opt.path !== "/") throw new Error("__Host- Cookie must have Path attributes with \"/\"");
		if (opt.domain) throw new Error("__Host- Cookie must not have Domain attributes");
	}
	for (const key of [
		"domain",
		"path",
		"sameSite",
		"priority"
	]) if (opt[key] && /[;\r\n]/.test(opt[key])) throw new Error(`${key} must not contain ";", "\\r", or "\\n"`);
	if (opt && typeof opt.maxAge === "number" && opt.maxAge >= 0) {
		if (opt.maxAge > 3456e4) throw new Error("Cookies Max-Age SHOULD NOT be greater than 400 days (34560000 seconds) in duration.");
		cookie += `; Max-Age=${opt.maxAge | 0}`;
	}
	if (opt.domain && opt.prefix !== "host") cookie += `; Domain=${opt.domain}`;
	if (opt.path) cookie += `; Path=${opt.path}`;
	if (opt.expires) {
		if (opt.expires.getTime() - Date.now() > 3456e7) throw new Error("Cookies Expires SHOULD NOT be greater than 400 days (34560000 seconds) in the future.");
		cookie += `; Expires=${opt.expires.toUTCString()}`;
	}
	if (opt.httpOnly) cookie += "; HttpOnly";
	if (opt.secure) cookie += "; Secure";
	if (opt.sameSite) cookie += `; SameSite=${opt.sameSite.charAt(0).toUpperCase() + opt.sameSite.slice(1)}`;
	if (opt.priority) cookie += `; Priority=${opt.priority.charAt(0).toUpperCase() + opt.priority.slice(1)}`;
	if (opt.partitioned) {
		if (!opt.secure) throw new Error("Partitioned Cookie must have Secure attributes");
		cookie += "; Partitioned";
	}
	return cookie;
};
const serialize = (name, value, opt) => {
	value = encodeURIComponent(value);
	return _serialize(name, value, opt);
};
//#endregion
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
//#region ../../plugins/acryl-router/src/core/client/client.ts
const createProxy = (callback, path) => {
	return new Proxy(() => {}, {
		get(_obj, key) {
			if (typeof key !== "string" || key === "then") return;
			return createProxy(callback, [...path, key]);
		},
		apply(_1, _2, args) {
			return callback({
				path,
				args
			});
		}
	});
};
const appendQueryParams = (url, searchParams) => {
	const queryString = searchParams.toString();
	return queryString ? `${url}?${queryString}` : url;
};
var ClientRequestImpl = class {
	url;
	method;
	buildSearchParams;
	queryParams = void 0;
	pathParams = {};
	rBody;
	cType = void 0;
	constructor(url, method, options) {
		this.url = url;
		this.method = method;
		this.buildSearchParams = options.buildSearchParams;
	}
	fetch = async (args, opt) => {
		if (args) {
			if (args.query) this.queryParams = this.buildSearchParams(args.query);
			if (args.form) {
				const form = new FormData();
				for (const [k, v] of Object.entries(args.form)) {
					if (v === void 0) continue;
					if (Array.isArray(v)) for (const v2 of v) {
						if (v2 === void 0) continue;
						form.append(k, v2);
					}
					else form.append(k, v);
				}
				this.rBody = form;
			}
			if (args.json !== void 0) {
				this.rBody = JSON.stringify(args.json);
				this.cType = "application/json";
			}
			if (args.param) this.pathParams = args.param;
		}
		let methodUpperCase = this.method.toUpperCase();
		const headerValues = {
			...args?.header,
			...typeof opt?.headers === "function" ? await opt.headers() : opt?.headers
		};
		if (args?.cookie) {
			const cookies = [];
			for (const [key, value] of Object.entries(args.cookie)) {
				if (value === void 0) continue;
				cookies.push(serialize(key, value));
			}
			if (cookies.length > 0) headerValues["Cookie"] = cookies.join("; ");
		}
		if (this.cType) headerValues["Content-Type"] = this.cType;
		const headers = new Headers();
		for (const [key, value] of Object.entries(headerValues)) if (value !== void 0) headers.set(key, value);
		let url = this.url;
		url = removeIndexString(url);
		url = replaceUrlParam(url, this.pathParams);
		if (this.queryParams) url = appendQueryParams(url, this.queryParams);
		methodUpperCase = this.method.toUpperCase();
		const setBody = !(methodUpperCase === "GET" || methodUpperCase === "HEAD");
		return (opt?.fetch || fetch)(url, {
			body: setBody ? this.rBody : void 0,
			method: methodUpperCase,
			headers,
			...opt?.init
		});
	};
};
const hc = (baseUrl, options) => createProxy(function proxyCallback(opts) {
	const buildSearchParamsOption = options?.buildSearchParams ?? buildSearchParams;
	const parts = [...opts.path];
	const lastParts = parts.slice(-3).reverse();
	if (lastParts[0] === "toString") {
		if (lastParts[1] === "name") return lastParts[2] || "";
		return proxyCallback.toString();
	}
	if (lastParts[0] === "valueOf") {
		if (lastParts[1] === "name") return lastParts[2] || "";
		return proxyCallback;
	}
	let method = "";
	if (/^\$/.test(lastParts[0])) {
		const last = parts.pop();
		if (last) method = last.replace(/^\$/, "");
	}
	const url = mergePath(baseUrl, parts.join("/"));
	if (method === "url" || method === "path") {
		let result = removeIndexString(url);
		if (opts.args[0]) {
			if (opts.args[0].param) result = replaceUrlParam(result, opts.args[0].param);
			if (opts.args[0].query) result = appendQueryParams(result, buildSearchParamsOption(opts.args[0].query));
		}
		if (method === "url") return new URL(result);
		return result.slice(baseUrl.replace(/\/+$/, "").length).replace(/^\/?/, "/");
	}
	if (method === "ws") {
		const normalizedUrl = removeIndexString(url);
		const webSocketUrl = replaceUrlProtocol(opts.args[0]?.param ? replaceUrlParam(normalizedUrl, opts.args[0].param) : normalizedUrl, "ws");
		const targetUrl = new URL(webSocketUrl);
		const queryParams = opts.args[0]?.query;
		if (queryParams) buildSearchParamsOption(queryParams).forEach((value, key) => {
			targetUrl.searchParams.append(key, value);
		});
		const establishWebSocket = (...args) => {
			if (options?.webSocket !== void 0 && typeof options.webSocket === "function") return options.webSocket(...args);
			return new WebSocket(...args);
		};
		return establishWebSocket(targetUrl.toString());
	}
	const req = new ClientRequestImpl(url, method, { buildSearchParams: buildSearchParamsOption });
	if (method) {
		options ??= {};
		const reqOptions = { ...opts.args[1] };
		const baseHeaders = options.headers;
		const reqHeaders = reqOptions.headers;
		if (baseHeaders && reqHeaders) reqOptions.headers = async () => ({
			...typeof baseHeaders === "function" ? await baseHeaders() : baseHeaders,
			...typeof reqHeaders === "function" ? await reqHeaders() : reqHeaders
		});
		const args = deepMerge(options, reqOptions);
		return req.fetch(opts.args[0], args);
	}
	return req;
}, []);
//#endregion
export { DetailedError, hc, parseResponse };
