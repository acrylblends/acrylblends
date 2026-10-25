import { escapeToBuffer, raw, resolveCallbackSync, stringBufferToString } from "./utils/html.js";
import { i as DOM_RENDERER, n as DOM_INTERNAL_TAG, o as PERMALINK, r as DOM_MEMO, t as DOM_ERROR_HANDLER } from "./constants-BR9jM9BC.js";
//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/dom/utils.ts
const setInternalTagFlag = (fn) => {
	fn[DOM_INTERNAL_TAG] = true;
	return fn;
};
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/dom/context.ts
const createContextProviderFunction = (values) => ({ value, children }) => {
	if (!children) return;
	const props = { children: [{
		tag: setInternalTagFlag(() => {
			values.push(value);
		}),
		props: {}
	}] };
	if (Array.isArray(children)) props.children.push(...children.flat());
	else props.children.push(children);
	props.children.push({
		tag: setInternalTagFlag(() => {
			values.pop();
		}),
		props: {}
	});
	const res = {
		tag: "",
		props,
		type: ""
	};
	res[DOM_ERROR_HANDLER] = (err) => {
		values.pop();
		throw err;
	};
	return res;
};
const createContext$1 = (defaultValue) => {
	const values = [defaultValue];
	const context = createContextProviderFunction(values);
	context.values = values;
	context.Provider = context;
	globalContexts.push(context);
	return context;
};
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/context.ts
const globalContexts = [];
let alsProbed = false;
let asyncLocalStorage;
let fallbackStore;
let fallbackRendersInFlight = 0;
let warnedFallbackDefault = false;
const loadAsyncLocalStorage = () => {
	if (alsProbed) return asyncLocalStorage;
	alsProbed = true;
	const global = globalThis;
	let AsyncLocalStorage;
	for (const probe of [() => global.process?.getBuiltinModule?.("node:async_hooks")?.AsyncLocalStorage, () => global.process?.mainModule?.require?.("node:async_hooks")?.AsyncLocalStorage]) {
		try {
			AsyncLocalStorage = probe();
		} catch {}
		if (AsyncLocalStorage) break;
	}
	if (AsyncLocalStorage) asyncLocalStorage = new AsyncLocalStorage();
	return asyncLocalStorage;
};
const getCurrentStore = () => {
	return loadAsyncLocalStorage()?.getStore() || fallbackStore;
};
const warnIfStorelessAccess = () => {
	if (fallbackRendersInFlight > 0 && !warnedFallbackDefault) {
		warnedFallbackDefault = true;
		console.warn("acryl-router/jsx: AsyncLocalStorage is unavailable in this runtime, so useContext() after an await in an async component falls back to the context default value during server-side rendering. To get provided values across await boundaries, use a runtime with AsyncLocalStorage (Node.js >= 20.16, Deno, Bun, or Cloudflare Workers with the nodejs_compat flag).");
	}
};
const getContextValuesIn = (store, context) => {
	if (!store) {
		warnIfStorelessAccess();
		return context.values;
	}
	let values = store.get(context);
	if (!values) {
		values = [context.values[0]];
		store.set(context, values);
	}
	return values;
};
const readContextValueIn = (store, context) => {
	if (!store) {
		warnIfStorelessAccess();
		return context.values.at(-1);
	}
	const values = store.get(context);
	return values?.length ? values.at(-1) : context.values[0];
};
const captureContextValues = (store) => (store ? globalContexts.filter((c) => store.has(c)) : globalContexts).map((c) => [c, readContextValueIn(store, c)]);
const resumeWithContextValues = (callback, store, contexts) => runWithRenderContext(() => {
	const currentStore = getCurrentStore();
	const valuesPerContext = contexts.map(([context, value]) => {
		const values = getContextValuesIn(currentStore, context);
		values.push(value);
		return values;
	});
	const popContextValues = () => {
		valuesPerContext.forEach((values) => {
			values.pop();
		});
	};
	try {
		const result = callback();
		if (result instanceof Promise) return result.finally(popContextValues);
		popContextValues();
		return result;
	} catch (e) {
		popContextValues();
		throw e;
	}
}, store);
/**
* Establish the request-scoped context store for a render.
*
* `resumeStore` continues a suspended subtree in the same store on the fallback
* path (ignored when `AsyncLocalStorage` is available, where isolation is
* automatic).
*
* Without `AsyncLocalStorage` a render can't be followed across `await`, so the
* store lives in `fallbackStore` only during synchronous work (mirroring
* React's request storage). Reading context after `await` then finds no store
* and falls back to the default value — never another request's value.
*/
const runWithRenderContext = (callback, resumeStore) => {
	if (getCurrentStore()) return callback();
	const store = resumeStore ?? /* @__PURE__ */ new WeakMap();
	const storage = loadAsyncLocalStorage();
	if (storage) return storage.run(store, callback);
	fallbackStore = store;
	let result;
	try {
		result = callback();
	} finally {
		fallbackStore = void 0;
	}
	if (!warnedFallbackDefault && result instanceof Promise) {
		fallbackRendersInFlight++;
		result = result.finally(() => {
			fallbackRendersInFlight--;
		});
	}
	return result;
};
/**
* Capture the current render store and return a resumer that re-establishes it
* around a deferred continuation (e.g. a re-render after a suspended promise
* settles). Shared by every suspension point so none reimplements it.
*/
const captureRenderContext = () => {
	const store = getCurrentStore();
	const contexts = captureContextValues(store);
	return (callback) => resumeWithContextValues(callback, store, contexts);
};
/**
* Create a context whose value can be provided with `<Context.Provider>` and
* read with {@link useContext}.
*
* Server-side renders are isolated per request, so a provided value never leaks
* into a concurrent request — even across `await` in an async component, when
* `AsyncLocalStorage` is available (Node.js >= 20.16, Deno, Bun, Cloudflare
* Workers with `nodejs_compat`). Without it, reading context after `await`
* returns the default value; synchronous components and `use()`-based
* suspension are unaffected.
*/
const createContext = (defaultValue) => {
	const values = [defaultValue];
	const context = ((props) => {
		const contextValues = getContextValuesIn(getCurrentStore(), context);
		contextValues.push(props.value);
		let rendered;
		try {
			rendered = typeof props.children === "string" ? renderChildren([props.children]) : isUntrustedObject(props.children) ? renderUntrustedObject(props.children) : props.children ? (Array.isArray(props.children) ? new JSXFragmentNode("", {}, props.children) : props.children).toString() : raw("");
		} catch (e) {
			contextValues.pop();
			throw e;
		}
		if (rendered instanceof Promise) return rendered.finally(() => contextValues.pop()).then((resString) => raw(resString, resString.callbacks));
		else {
			contextValues.pop();
			return raw(rendered);
		}
	});
	context.values = values;
	context.Provider = context;
	context[DOM_RENDERER] = createContextProviderFunction(values);
	globalContexts.push(context);
	return context;
};
/**
* Read the current value of a context created with {@link createContext}.
*
* Safe to call from async components after `await`. See {@link createContext}
* for the per-runtime isolation guarantees.
*/
const useContext = (context) => {
	return readContextValueIn(getCurrentStore(), context);
};
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/intrinsic-element/common.ts
const deDupeKeyMap = {
	title: [],
	script: ["src"],
	style: ["data-href"],
	link: ["href"],
	meta: [
		"name",
		"httpEquiv",
		"charset",
		"itemProp"
	]
};
const domRenderers = {};
const dataPrecedenceAttr = "data-precedence";
const isStylesheetLinkWithPrecedence = (props) => props.rel === "stylesheet" && "precedence" in props;
const shouldDeDupeByKey = (tagName, supportSort) => {
	if (tagName === "link") return supportSort;
	return deDupeKeyMap[tagName].length > 0;
};
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/children.ts
const toArray = (children) => Array.isArray(children) ? children : [children];
const Children = {
	map: (children, fn) => toArray(children).map(fn),
	forEach: (children, fn) => {
		toArray(children).forEach(fn);
	},
	count: (children) => toArray(children).length,
	only: (_children) => {
		const children = toArray(_children);
		if (children.length !== 1) throw new Error("Children.only() expects only one child");
		return children[0];
	},
	toArray
};
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/intrinsic-element/components.ts
var components_exports = /* @__PURE__ */ __exportAll({
	button: () => button,
	form: () => form,
	input: () => input,
	link: () => link,
	meta: () => meta,
	script: () => script,
	style: () => style,
	title: () => title
});
const metaTagMap = /* @__PURE__ */ new WeakMap();
const insertIntoHead = (tagName, tag, props, precedence) => ({ buffer, context }) => {
	if (!buffer) return;
	const map = metaTagMap.get(context) || {};
	metaTagMap.set(context, map);
	const tags = map[tagName] ||= [];
	let duped = false;
	const deDupeKeys = deDupeKeyMap[tagName];
	const deDupeByKey = shouldDeDupeByKey(tagName, precedence !== void 0);
	if (deDupeByKey) LOOP: for (const [, tagProps] of tags) {
		if (tagName === "link" && !(tagProps.rel === "stylesheet" && tagProps["data-precedence"] !== void 0)) continue;
		for (const key of deDupeKeys) if ((tagProps?.[key] ?? null) === props?.[key]) {
			duped = true;
			break LOOP;
		}
	}
	if (duped) buffer[0] = buffer[0].replaceAll(tag, "");
	else if (deDupeByKey || tagName === "link") tags.push([
		tag,
		props,
		precedence
	]);
	else tags.unshift([
		tag,
		props,
		precedence
	]);
	if (buffer[0].indexOf("</head>") !== -1) {
		let insertTags;
		if (tagName === "link" || precedence !== void 0) {
			const precedences = [];
			insertTags = tags.map(([tag, , tagPrecedence], index) => {
				if (tagPrecedence === void 0) return [
					tag,
					Number.MAX_SAFE_INTEGER,
					index
				];
				let order = precedences.indexOf(tagPrecedence);
				if (order === -1) {
					precedences.push(tagPrecedence);
					order = precedences.length - 1;
				}
				return [
					tag,
					order,
					index
				];
			}).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(([tag]) => tag);
		} else insertTags = tags.map(([tag]) => tag);
		insertTags.forEach((tag) => {
			buffer[0] = buffer[0].replaceAll(tag, "");
		});
		buffer[0] = buffer[0].replace(/(?=<\/head>)/, () => insertTags.join(""));
	}
};
const returnWithoutSpecialBehavior = (tag, children, props) => renderChildren([new JSXNode(tag, props, toArray(children ?? []))]);
const documentMetadataTag = (tag, children, props, sort) => {
	if ("itemProp" in props) return returnWithoutSpecialBehavior(tag, children, props);
	let { precedence, blocking, ...restProps } = props;
	precedence = sort ? precedence ?? "" : void 0;
	if (sort) restProps[dataPrecedenceAttr] = precedence;
	const string = new JSXNode(tag, restProps, toArray(children || [])).toString();
	if (string instanceof Promise) return string.then((resString) => raw(resString, [...resString.callbacks || [], insertIntoHead(tag, resString, restProps, precedence)]));
	else return raw(string, [insertIntoHead(tag, string, restProps, precedence)]);
};
const title = ({ children, ...props }) => {
	const nameSpaceContext = getNameSpaceContext();
	if (nameSpaceContext) {
		const context = useContext(nameSpaceContext);
		if (context === "svg" || context === "head") return new JSXNode("title", props, toArray(children ?? []));
	}
	return documentMetadataTag("title", children, props, false);
};
const script = ({ children, ...props }) => {
	const nameSpaceContext = getNameSpaceContext();
	if (["src", "async"].some((k) => !props[k]) || nameSpaceContext && useContext(nameSpaceContext) === "head") return returnWithoutSpecialBehavior("script", children, props);
	return documentMetadataTag("script", children, props, false);
};
const style = ({ children, ...props }) => {
	if (!["href", "precedence"].every((k) => k in props)) return returnWithoutSpecialBehavior("style", children, props);
	props["data-href"] = props.href;
	delete props.href;
	return documentMetadataTag("style", children, props, true);
};
const link = ({ children, ...props }) => {
	if (["onLoad", "onError"].some((k) => k in props) || props.rel === "stylesheet" && (!("precedence" in props) || "disabled" in props)) return returnWithoutSpecialBehavior("link", children, props);
	return documentMetadataTag("link", children, props, isStylesheetLinkWithPrecedence(props));
};
const meta = ({ children, ...props }) => {
	const nameSpaceContext = getNameSpaceContext();
	if (nameSpaceContext && useContext(nameSpaceContext) === "head") return returnWithoutSpecialBehavior("meta", children, props);
	return documentMetadataTag("meta", children, props, false);
};
const newJSXNode = (tag, { children, ...props }) => new JSXNode(tag, props, toArray(children ?? []));
const form = (props) => {
	if (typeof props.action === "function") props.action = PERMALINK in props.action ? props.action[PERMALINK] : void 0;
	return newJSXNode("form", props);
};
const formActionableElement = (tag, props) => {
	if (typeof props.formAction === "function") props.formAction = PERMALINK in props.formAction ? props.formAction[PERMALINK] : void 0;
	return newJSXNode(tag, props);
};
const input = (props) => formActionableElement("input", props);
const button = (props) => formActionableElement("button", props);
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/utils.ts
const normalizeElementKeyMap = /* @__PURE__ */ new Map([
	["className", "class"],
	["htmlFor", "for"],
	["crossOrigin", "crossorigin"],
	["httpEquiv", "http-equiv"],
	["itemProp", "itemprop"],
	["fetchPriority", "fetchpriority"],
	["noModule", "nomodule"],
	["formAction", "formaction"]
]);
const normalizeIntrinsicElementKey = (key) => normalizeElementKeyMap.get(key) || key;
const invalidAttributeNameCharRe = /[\s"'<>/=`\\\x00-\x1f\x7f-\x9f]/;
const validAttributeNameCache = /* @__PURE__ */ new Set();
const validAttributeNameCacheMax = 1024;
const invalidTagNameCharRe = /^[!?]|[\s"'<>/=`\\\x00-\x1f\x7f-\x9f]/;
const validTagNameCache = /* @__PURE__ */ new Set();
const validTagNameCacheMax = 256;
const cacheValidName = (cache, max, name) => {
	if (cache.size >= max) cache.clear();
	cache.add(name);
};
const isValidTagName = (name) => {
	if (validTagNameCache.has(name)) return true;
	if (typeof name !== "string") return false;
	if (name.length === 0) return true;
	if (invalidTagNameCharRe.test(name)) return false;
	cacheValidName(validTagNameCache, validTagNameCacheMax, name);
	return true;
};
const isValidAttributeName = (name) => {
	if (validAttributeNameCache.has(name)) return true;
	const len = name.length;
	if (len === 0) return false;
	for (let i = 0; i < len; i++) {
		const c = name.charCodeAt(i);
		if (!(c >= 97 && c <= 122 || c >= 65 && c <= 90 || c >= 48 && c <= 57 || c === 45 || c === 95 || c === 46 || c === 58)) if (!invalidAttributeNameCharRe.test(name)) {
			cacheValidName(validAttributeNameCache, validAttributeNameCacheMax, name);
			return true;
		} else return false;
	}
	cacheValidName(validAttributeNameCache, validAttributeNameCacheMax, name);
	return true;
};
const invalidStylePropertyNameCharRe = /[\s"'():;\\/\[\]{}\x00-\x1f\x7f-\x9f]/;
const validStylePropertyNameCache = /* @__PURE__ */ new Set();
const validStylePropertyNameCacheMax = 1024;
const isValidStylePropertyName = (name) => {
	if (validStylePropertyNameCache.has(name)) return true;
	const len = name.length;
	if (len === 0) return false;
	for (let i = 0; i < len; i++) {
		const c = name.charCodeAt(i);
		if (!(c >= 97 && c <= 122 || c >= 65 && c <= 90 || c >= 48 && c <= 57 || c === 45 || c === 95)) if (!invalidStylePropertyNameCharRe.test(name)) {
			cacheValidName(validStylePropertyNameCache, validStylePropertyNameCacheMax, name);
			return true;
		} else return false;
	}
	cacheValidName(validStylePropertyNameCache, validStylePropertyNameCacheMax, name);
	return true;
};
const unsafeStyleValueCharRe = /[;"'\\/\[\](){}]/;
const hasUnsafeStyleValue = (value) => {
	if (!unsafeStyleValueCharRe.test(value)) return false;
	let quote = 0;
	const blockStack = [];
	for (let i = 0, len = value.length; i < len; i++) {
		const c = value.charCodeAt(i);
		if (c === 92) {
			if (i === len - 1) return true;
			i++;
		} else if (quote !== 0) {
			if (c === 10 || c === 12 || c === 13) return true;
			if (c === quote) quote = 0;
		} else if (c === 47 && value.charCodeAt(i + 1) === 42) {
			const end = value.indexOf("*/", i + 2);
			if (end === -1) return true;
			i = end + 1;
		} else if (c === 34 || c === 39) quote = c;
		else if (c === 40) blockStack.push(41);
		else if (c === 91) blockStack.push(93);
		else if (c === 123 || c === 125) return true;
		else if (c === 41 || c === 93) {
			if (blockStack[blockStack.length - 1] !== c) return true;
			blockStack.pop();
		} else if (c === 59 && blockStack.length === 0) return true;
	}
	return quote !== 0 || blockStack.length !== 0;
};
const styleObjectForEach = (style, fn) => {
	for (const [k, v] of Object.entries(style)) {
		const key = k[0] === "-" || !/[A-Z]/.test(k) ? k : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
		if (!isValidStylePropertyName(key)) continue;
		if (v == null) {
			fn(key, null);
			continue;
		}
		let value;
		if (typeof v === "number") value = !key.match(/^(?:a|border-im|column(?:-c|s)|flex(?:$|-[^b])|grid-(?!.*gap)(?:ar|[^a])|font-w|li|or|sca|st|ta|wido|z)|ty$/) ? `${v}px` : `${v}`;
		else if (typeof v === "string") {
			if (hasUnsafeStyleValue(v)) continue;
			value = v;
		} else continue;
		fn(key, value);
	}
};
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/base.ts
let nameSpaceContext = void 0;
const getNameSpaceContext = () => nameSpaceContext;
const toSVGAttributeName = (key) => /[A-Z]/.test(key) && key.match(/^(?:al|basel|clip(?:Path|Rule)$|co|do|fill|fl|fo|gl|let|lig|i|marker[EMS]|o|pai|pointe|sh|st[or]|text[^L]|tr|u|ve|w)/) ? key.replace(/([A-Z])/g, "-$1").toLowerCase() : key;
const emptyTags = [
	"area",
	"base",
	"br",
	"col",
	"embed",
	"hr",
	"img",
	"input",
	"keygen",
	"link",
	"meta",
	"param",
	"source",
	"track",
	"wbr"
];
const booleanAttributes = [
	"allowfullscreen",
	"async",
	"autofocus",
	"autoplay",
	"checked",
	"controls",
	"default",
	"defer",
	"disabled",
	"download",
	"formnovalidate",
	"hidden",
	"inert",
	"ismap",
	"itemscope",
	"loop",
	"multiple",
	"muted",
	"nomodule",
	"novalidate",
	"open",
	"playsinline",
	"readonly",
	"required",
	"reversed",
	"selected"
];
const resolveFunctionComponentResult = (result, suspendedContext) => result.then((resolved) => {
	if (typeof resolved !== "string" && !Array.isArray(resolved) && !(resolved instanceof JSXNode)) return resolved;
	const children = Array.isArray(resolved) ? resolved : [resolved];
	const render = () => {
		const buffer = [""];
		childrenToStringToBuffer(children, buffer);
		return buffer.length === 1 ? raw(buffer[0], buffer.callbacks) : stringBufferToString(buffer, buffer.callbacks);
	};
	return suspendedContext ? suspendedContext(render) : runWithRenderContext(render);
});
const childrenToStringToBuffer = (children, buffer) => {
	for (let i = 0, len = children.length; i < len; i++) {
		const child = children[i];
		if (typeof child === "string") escapeToBuffer(child, buffer);
		else if (typeof child === "boolean" || child === null || child === void 0) continue;
		else if (child instanceof JSXNode) child.toStringToBuffer(buffer);
		else if (typeof child === "number") buffer[0] += child;
		else if (child.isEscaped) {
			buffer[0] += child;
			const callbacks = child.callbacks;
			if (callbacks) {
				buffer.callbacks ||= [];
				buffer.callbacks.push(...callbacks);
			}
		} else if (child instanceof Promise) buffer.unshift("", child);
		else childrenToStringToBuffer(child, buffer);
	}
};
const renderChildren = (children) => runWithRenderContext(() => {
	const buffer = [""];
	childrenToStringToBuffer(children, buffer);
	return buffer.length === 1 ? raw(buffer[0], buffer.callbacks) : stringBufferToString(buffer, buffer.callbacks);
});
const isUntrustedObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof JSXNode) && !(value instanceof Promise) && !value.isEscaped && typeof value.toString === "function";
const renderUntrustedObject = (value) => {
	const stringified = value.toString();
	const escape = (result) => renderChildren([String(result)]);
	return stringified instanceof Promise ? stringified.then(escape) : escape(stringified);
};
var JSXNode = class {
	tag;
	props;
	key;
	children;
	isEscaped = true;
	constructor(tag, props, children) {
		if (typeof tag !== "function" && !isValidTagName(tag)) throw new Error(`Invalid JSX tag name: ${tag}`);
		this.tag = tag;
		this.props = props;
		this.children = children;
	}
	get type() {
		return this.tag;
	}
	get ref() {
		return this.props.ref || null;
	}
	toString() {
		const render = () => {
			const buffer = [""];
			this.toStringToBuffer(buffer);
			return buffer.length === 1 ? "callbacks" in buffer ? resolveCallbackSync(raw(buffer[0], buffer.callbacks)).toString() : buffer[0] : stringBufferToString(buffer, buffer.callbacks);
		};
		return runWithRenderContext(render);
	}
	toStringToBuffer(buffer) {
		const tag = this.tag;
		const props = this.props;
		let { children } = this;
		buffer[0] += `<${tag}`;
		const normalizeKey = tag === "svg" || nameSpaceContext && useContext(nameSpaceContext) === "svg" ? (key) => toSVGAttributeName(normalizeIntrinsicElementKey(key)) : (key) => normalizeIntrinsicElementKey(key);
		for (let [key, v] of Object.entries(props)) {
			key = normalizeKey(key);
			if (!isValidAttributeName(key)) continue;
			if (key === "children") {} else if (key === "style" && typeof v === "object") {
				let styleStr = "";
				styleObjectForEach(v, (property, value) => {
					if (value != null) styleStr += `${styleStr ? ";" : ""}${property}:${value}`;
				});
				buffer[0] += " style=\"";
				escapeToBuffer(styleStr, buffer);
				buffer[0] += "\"";
			} else if (typeof v === "string") {
				buffer[0] += ` ${key}="`;
				escapeToBuffer(v, buffer);
				buffer[0] += "\"";
			} else if (v === null || v === void 0) {} else if (typeof v === "number" || v.isEscaped) buffer[0] += ` ${key}="${v}"`;
			else if (typeof v === "boolean" && booleanAttributes.includes(key)) {
				if (v) buffer[0] += ` ${key}=""`;
			} else if (key === "dangerouslySetInnerHTML") {
				if (children.length > 0) throw new Error("Can only set one of `children` or `props.dangerouslySetInnerHTML`.");
				children = [raw(v.__html)];
			} else if (v instanceof Promise) {
				buffer[0] += ` ${key}="`;
				buffer.unshift("\"", v);
			} else if (typeof v === "function") {
				if (!key.startsWith("on") && key !== "ref") throw new Error(`Invalid prop '${key}' of type 'function' supplied to '${tag}'.`);
			} else {
				buffer[0] += ` ${key}="`;
				escapeToBuffer(v.toString(), buffer);
				buffer[0] += "\"";
			}
		}
		if (emptyTags.includes(tag) && children.length === 0) {
			buffer[0] += "/>";
			return;
		}
		buffer[0] += ">";
		childrenToStringToBuffer(children, buffer);
		buffer[0] += `</${tag}>`;
	}
};
var JSXFunctionNode = class extends JSXNode {
	toStringToBuffer(buffer) {
		const { children } = this;
		const props = { ...this.props };
		if (children.length) props.children = children.length === 1 ? children[0] : children;
		const res = this.tag.call(null, props);
		if (typeof res === "boolean" || res == null) return;
		else if (res instanceof Promise) if (globalContexts.length === 0) buffer.unshift("", resolveFunctionComponentResult(res));
		else buffer.unshift("", resolveFunctionComponentResult(res, captureRenderContext()));
		else if (res instanceof JSXNode) res.toStringToBuffer(buffer);
		else if (Array.isArray(res)) childrenToStringToBuffer(res, buffer);
		else if (typeof res === "number" || res.isEscaped) {
			buffer[0] += res;
			if (res.callbacks) {
				buffer.callbacks ||= [];
				buffer.callbacks.push(...res.callbacks);
			}
		} else escapeToBuffer(res, buffer);
	}
};
var JSXFragmentNode = class extends JSXNode {
	toStringToBuffer(buffer) {
		childrenToStringToBuffer(this.children, buffer);
	}
};
const jsx = (tag, props, ...children) => {
	props ??= {};
	if (children.length) props.children = children.length === 1 ? children[0] : children;
	const key = props.key;
	delete props["key"];
	const node = jsxFn(tag, props, children);
	node.key = key;
	return node;
};
let initDomRenderer = false;
const jsxFn = (tag, props, children) => {
	if (!initDomRenderer) {
		for (const k in domRenderers) components_exports[k][DOM_RENDERER] = domRenderers[k];
		initDomRenderer = true;
	}
	if (typeof tag === "function") return new JSXFunctionNode(tag, props, children);
	else if (components_exports[tag]) return new JSXFunctionNode(components_exports[tag], props, children);
	else if (tag === "svg" || tag === "head") {
		nameSpaceContext ||= createContext("");
		return new JSXNode(tag, props, [new JSXFunctionNode(nameSpaceContext, { value: tag }, children)]);
	} else return new JSXNode(tag, props, children);
};
const shallowEqual = (a, b) => {
	if (a === b) return true;
	const aKeys = Object.keys(a).sort();
	const bKeys = Object.keys(b).sort();
	if (aKeys.length !== bKeys.length) return false;
	for (let i = 0, len = aKeys.length; i < len; i++) if (aKeys[i] === "children" && bKeys[i] === "children" && !a.children?.length && !b.children?.length) continue;
	else if (a[aKeys[i]] !== b[aKeys[i]]) return false;
	return true;
};
const memo = (component, propsAreEqual = shallowEqual) => {
	const wrapper = ((props) => component(props));
	wrapper[DOM_MEMO] = propsAreEqual;
	wrapper[DOM_RENDERER] = component;
	return wrapper;
};
const Fragment = ({ children }) => {
	return new JSXFragmentNode("", { children }, Array.isArray(children) ? children : children ? [children] : []);
};
const isValidElement = (element) => {
	return !!(element && typeof element === "object" && "tag" in element && "props" in element);
};
const cloneElement = (element, props, ...children) => {
	let childrenToClone;
	if (children.length > 0) childrenToClone = children;
	else {
		const c = element.props.children;
		childrenToClone = c !== void 0 ? Array.isArray(c) ? c : [c] : [];
	}
	return jsx(element.tag, {
		...element.props,
		...props
	}, ...childrenToClone);
};
const reactAPICompatVersion = "19.0.0-acryl-jsx";
//#endregion
export { captureRenderContext as C, createContext$1 as D, useContext as E, __exportAll as O, shouldDeDupeByKey as S, globalContexts as T, toArray as _, isValidElement as a, domRenderers as b, memo as c, renderUntrustedObject as d, shallowEqual as f, Children as g, styleObjectForEach as h, isUntrustedObject as i, reactAPICompatVersion as l, normalizeIntrinsicElementKey as m, JSXNode as n, jsx as o, isValidAttributeName as p, cloneElement as r, jsxFn as s, Fragment as t, renderChildren as u, dataPrecedenceAttr as v, createContext as w, isStylesheetLinkWithPrecedence as x, deDupeKeyMap as y };
