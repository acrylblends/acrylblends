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
//#region ../../plugins/acryl-router/src/core/jsx/constants.ts
const DOM_RENDERER = Symbol("RENDERER");
const DOM_ERROR_HANDLER = Symbol("ERROR_HANDLER");
const DOM_STASH = Symbol("STASH");
const DOM_INTERNAL_TAG = Symbol("INTERNAL");
const DOM_MEMO = Symbol("MEMO");
const PERMALINK = Symbol("PERMALINK");
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
const createContext = (defaultValue) => {
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
const readContextValueIn = (store, context) => {
	if (!store) return context.values.at(-1);
	const values = store.get(context);
	return values?.length ? values.at(-1) : context.values[0];
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
const cacheValidName = (cache, max, name) => {
	if (cache.size >= max) cache.clear();
	cache.add(name);
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
const shallowEqual = (a, b) => {
	if (a === b) return true;
	const aKeys = Object.keys(a).sort();
	const bKeys = Object.keys(b).sort();
	if (aKeys.length !== bKeys.length) return false;
	for (let i = 0, len = aKeys.length; i < len; i++) if (aKeys[i] === "children" && bKeys[i] === "children" && !a.children?.length && !b.children?.length) continue;
	else if (a[aKeys[i]] !== b[aKeys[i]]) return false;
	return true;
};
const isValidElement = (element) => {
	return !!(element && typeof element === "object" && "tag" in element && "props" in element);
};
const reactAPICompatVersion = "19.0.0-acryl-jsx";
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/dom/render.ts
const ACRYL_PORTAL_ELEMENT = "_hp";
const eventAliasMap = {
	Change: "Input",
	DoubleClick: "DblClick"
};
const nameSpaceMap = {
	svg: "2000/svg",
	math: "1998/Math/MathML"
};
const buildDataStack = [];
const refCleanupMap = /* @__PURE__ */ new WeakMap();
let nameSpaceContext = void 0;
const getNameSpaceContext = () => nameSpaceContext;
const isNodeString = (node) => "t" in node;
const eventCache = { onClick: ["click", false] };
const getEventSpec = (key) => {
	if (!key.startsWith("on")) return;
	if (eventCache[key]) return eventCache[key];
	const match = key.match(/^on([A-Z][a-zA-Z]+?(?:PointerCapture)?)(Capture)?$/);
	if (match) {
		const [, eventName, capture] = match;
		return eventCache[key] = [(eventAliasMap[eventName] || eventName).toLowerCase(), !!capture];
	}
};
const toAttributeName = (element, key) => nameSpaceContext && element instanceof SVGElement && /[A-Z]/.test(key) && (key in element.style || key.match(/^(?:o|pai|str|u|ve)/)) ? key.replace(/([A-Z])/g, "-$1").toLowerCase() : key;
const normalizeFormValue = (value) => value === null || value === void 0 || value === false ? null : value;
const applySelectValue = (select, props) => {
	if (!("value" in props)) return;
	select.value = normalizeFormValue(props["value"]);
	if (!select.multiple && select.selectedIndex === -1) select.selectedIndex = 0;
};
const isIgnorableAttributeError = (error) => error instanceof DOMException && error.name === "InvalidCharacterError";
const applyProps = (container, attributes, oldAttributes) => {
	attributes ||= {};
	for (let key in attributes) {
		const value = attributes[key];
		if (key !== "children" && (!oldAttributes || oldAttributes[key] !== value)) {
			key = normalizeIntrinsicElementKey(key);
			const eventSpec = getEventSpec(key);
			if (eventSpec) {
				if (oldAttributes?.[key] !== value) {
					if (oldAttributes) container.removeEventListener(eventSpec[0], oldAttributes[key], eventSpec[1]);
					if (value != null) {
						if (typeof value !== "function") throw new Error(`Event handler for "${key}" is not a function`);
						container.addEventListener(eventSpec[0], value, eventSpec[1]);
					}
				}
			} else if (key === "dangerouslySetInnerHTML" && value) container.innerHTML = value.__html;
			else if (key === "ref") {
				refCleanupMap.get(container)?.();
				let cleanup;
				if (typeof value === "function") cleanup = value(container) || (() => value(null));
				else if (value && "current" in value) {
					value.current = container;
					cleanup = () => value.current = null;
				}
				refCleanupMap.set(container, cleanup);
			} else if (key === "style") {
				const style = container.style;
				if (typeof value === "string") style.cssText = value;
				else {
					style.cssText = "";
					if (value != null) styleObjectForEach(value, style.setProperty.bind(style));
				}
			} else {
				if (key === "value") {
					const nodeName = container.nodeName;
					if (nodeName === "SELECT") continue;
					else if (nodeName === "INPUT" || nodeName === "TEXTAREA") {
						container.value = normalizeFormValue(value);
						if (nodeName === "TEXTAREA") {
							container.textContent = value;
							continue;
						}
					}
				} else if (key === "checked" && container.nodeName === "INPUT" || key === "selected" && container.nodeName === "OPTION") container[key] = value;
				const k = toAttributeName(container, key);
				try {
					if (value === null || value === void 0 || value === false) container.removeAttribute(k);
					else if (value === true) container.setAttribute(k, "");
					else if (typeof value === "string" || typeof value === "number") container.setAttribute(k, value);
					else container.setAttribute(k, value.toString());
				} catch (e) {
					if (!isIgnorableAttributeError(e)) throw e;
				}
			}
		}
	}
	if (oldAttributes) for (let key in oldAttributes) {
		const value = oldAttributes[key];
		if (key !== "children" && !(key in attributes)) {
			key = normalizeIntrinsicElementKey(key);
			const eventSpec = getEventSpec(key);
			if (eventSpec) container.removeEventListener(eventSpec[0], value, eventSpec[1]);
			else if (key === "ref") {
				refCleanupMap.get(container)?.();
				refCleanupMap.delete(container);
			} else try {
				container.removeAttribute(toAttributeName(container, key));
			} catch (e) {
				if (!isIgnorableAttributeError(e)) throw e;
			}
		}
	}
};
const invokeTag = (context, node) => {
	node[DOM_STASH][0] = 0;
	buildDataStack.push([context, node]);
	const func = node.tag[DOM_RENDERER] || node.tag;
	const props = func.defaultProps ? {
		...func.defaultProps,
		...node.props
	} : node.props;
	try {
		return [func.call(null, props)];
	} finally {
		buildDataStack.pop();
	}
};
const getNextChildren = (node, container, nextChildren, childrenToRemove, callbacks) => {
	if (node.vR?.length) {
		childrenToRemove.push(...node.vR);
		delete node.vR;
	}
	if (typeof node.tag === "function") node[DOM_STASH][1][1]?.forEach((data) => callbacks.push(data));
	node.vC.forEach((child) => {
		if (isNodeString(child)) nextChildren.push(child);
		else if (typeof child.tag === "function" || child.tag === "") {
			child.c = container;
			const currentNextChildrenIndex = nextChildren.length;
			getNextChildren(child, container, nextChildren, childrenToRemove, callbacks);
			if (child.s) {
				for (let i = currentNextChildrenIndex; i < nextChildren.length; i++) nextChildren[i].s = true;
				child.s = false;
			}
		} else {
			nextChildren.push(child);
			if (child.vR?.length) {
				childrenToRemove.push(...child.vR);
				delete child.vR;
			}
		}
	});
};
const findInsertBefore = (node) => {
	while (node && (node.tag === ACRYL_PORTAL_ELEMENT || !node.e)) node = node.tag === ACRYL_PORTAL_ELEMENT || !node.vC?.[0] ? node.nN : node.vC[0];
	return node?.e;
};
const removeNode = (node) => {
	if (!isNodeString(node)) {
		node[DOM_STASH]?.[1][1]?.forEach((data) => data[2]?.());
		refCleanupMap.get(node.e)?.();
		if (node.p === 2) node.vC?.forEach((n) => n.p = 2);
		node.vC?.forEach(removeNode);
	}
	if (!node.p) {
		node.e?.remove();
		delete node.e;
	}
	if (typeof node.tag === "function") {
		updateMap.delete(node);
		fallbackUpdateFnArrayMap.delete(node);
		delete node[DOM_STASH][3];
		node.a = true;
	}
};
const apply = (node, container, isNew) => {
	node.c = container;
	applyNodeObject(node, container, isNew);
};
const findChildNodeIndex = (childNodes, child) => {
	if (!child) return;
	for (let i = 0, len = childNodes.length; i < len; i++) if (childNodes[i] === child) return i;
};
const cancelBuild = Symbol();
const applyNodeObject = (node, container, isNew) => {
	const next = [];
	const remove = [];
	const callbacks = [];
	getNextChildren(node, container, next, remove, callbacks);
	remove.forEach(removeNode);
	const childNodes = isNew ? void 0 : container.childNodes;
	let offset;
	let insertBeforeNode = null;
	if (isNew) offset = -1;
	else if (!childNodes.length) offset = 0;
	else {
		const offsetByNextNode = findChildNodeIndex(childNodes, findInsertBefore(node.nN));
		if (offsetByNextNode !== void 0) {
			insertBeforeNode = childNodes[offsetByNextNode];
			offset = offsetByNextNode;
		} else offset = findChildNodeIndex(childNodes, next.find((n) => n.tag !== ACRYL_PORTAL_ELEMENT && n.e)?.e) ?? -1;
		if (offset === -1) isNew = true;
	}
	for (let i = 0, len = next.length; i < len; i++, offset++) {
		const child = next[i];
		let el;
		if (child.s && child.e) {
			el = child.e;
			child.s = false;
		} else {
			const isNewLocal = isNew || !child.e;
			if (isNodeString(child)) {
				if (child.e && child.d) child.e.textContent = child.t;
				child.d = false;
				el = child.e ||= document.createTextNode(child.t);
			} else {
				el = child.e ||= child.n ? document.createElementNS(child.n, child.tag) : document.createElement(child.tag);
				applyProps(el, child.props, child.pP);
				applyNodeObject(child, el, isNewLocal);
				if (child.tag === "select") applySelectValue(el, child.props);
			}
		}
		if (child.tag === ACRYL_PORTAL_ELEMENT) offset--;
		else if (isNew) {
			if (!el.parentNode) container.appendChild(el);
		} else if (childNodes[offset] !== el && childNodes[offset - 1] !== el) if (childNodes[offset + 1] === el) container.appendChild(childNodes[offset]);
		else container.insertBefore(el, insertBeforeNode || childNodes[offset] || null);
	}
	if (node.pP) node.pP = void 0;
	if (callbacks.length) {
		const useLayoutEffectCbs = [];
		const useEffectCbs = [];
		callbacks.forEach(([, useLayoutEffectCb, , useEffectCb, useInsertionEffectCb]) => {
			if (useLayoutEffectCb) useLayoutEffectCbs.push(useLayoutEffectCb);
			if (useEffectCb) useEffectCbs.push(useEffectCb);
			useInsertionEffectCb?.();
		});
		useLayoutEffectCbs.forEach((cb) => cb());
		if (useEffectCbs.length) requestAnimationFrame(() => {
			useEffectCbs.forEach((cb) => cb());
		});
	}
};
const isSameContext = (oldContexts, newContexts) => !!(oldContexts && oldContexts.length === newContexts.length && oldContexts.every((ctx, i) => ctx[1] === newContexts[i][1]));
const indexChildrenByKey = (children) => {
	const index = /* @__PURE__ */ new Map();
	for (const child of children) {
		const key = child.key;
		if (index.has(key)) return;
		index.set(key, child);
	}
	return index;
};
const fallbackUpdateFnArrayMap = /* @__PURE__ */ new WeakMap();
const build = (context, node, children) => {
	const buildWithPreviousChildren = !children && node.pC;
	if (children) node.pC ||= node.vC;
	let foundErrorHandler;
	try {
		children ||= typeof node.tag == "function" ? invokeTag(context, node) : toArray(node.props.children);
		if (children[0]?.tag === "" && children[0][DOM_ERROR_HANDLER]) {
			foundErrorHandler = children[0][DOM_ERROR_HANDLER];
			context[5].push([
				context,
				foundErrorHandler,
				node
			]);
		}
		let oldVChildren = buildWithPreviousChildren ? [...node.pC] : node.vC ? [...node.vC] : void 0;
		const vChildren = [];
		let prevNode;
		let scanBudget = (oldVChildren?.length || 0) * 2;
		let oldChildrenByKey;
		for (let i = 0; i < children.length; i++) {
			if (Array.isArray(children[i])) {
				children.splice(i, 1, ...children[i].flat(Infinity));
				i--;
				continue;
			}
			let child = buildNode(children[i]);
			if (child) {
				if (typeof child.tag === "function" && !child.tag[DOM_INTERNAL_TAG]) {
					if (globalContexts.length > 0) child[DOM_STASH][2] = globalContexts.map((c) => [c, c.values.at(-1)]);
					if (context[5]?.length) child[DOM_STASH][3] = context[5].at(-1);
				}
				let oldChild;
				if (oldChildrenByKey && child.key === void 0 && !isNodeString(child)) {
					oldVChildren = [...oldChildrenByKey.values()];
					oldChildrenByKey = void 0;
				}
				if (oldChildrenByKey) {
					const key = child.key;
					const candidate = oldChildrenByKey.get(key);
					if (candidate && (isNodeString(child) ? isNodeString(candidate) : candidate.tag === child.tag && candidate.key === key)) {
						oldChild = candidate;
						oldChildrenByKey.delete(key);
					}
				} else if (oldVChildren && oldVChildren.length) {
					const first = oldVChildren[0];
					if (isNodeString(child) ? isNodeString(first) : !isNodeString(first) && (child.key !== void 0 ? first.key === child.key && first.tag === child.tag : first.tag === child.tag)) oldChild = oldVChildren.shift();
					else {
						const i = oldVChildren.findIndex(isNodeString(child) ? (c) => isNodeString(c) : child.key !== void 0 ? (c) => c.key === child.key && c.tag === child.tag : (c) => c.tag === child.tag);
						scanBudget -= i === -1 ? oldVChildren.length : i;
						if (i !== -1) {
							oldChild = oldVChildren[i];
							oldVChildren.splice(i, 1);
						}
						if (scanBudget < 0) {
							scanBudget = Infinity;
							oldChildrenByKey = indexChildrenByKey(oldVChildren);
						}
					}
				}
				if (oldChild) if (isNodeString(child)) {
					if (oldChild.t !== child.t) {
						oldChild.t = child.t;
						oldChild.d = true;
					}
					child = oldChild;
				} else {
					const pP = oldChild.pP = oldChild.props;
					oldChild.props = child.props;
					oldChild.f ||= child.f || node.f;
					if (typeof child.tag === "function") {
						const oldContexts = oldChild[DOM_STASH][2];
						oldChild[DOM_STASH][2] = child[DOM_STASH][2] || [];
						oldChild[DOM_STASH][3] = child[DOM_STASH][3];
						if (!oldChild.f && ((oldChild.o || oldChild) === child.o || oldChild.tag[DOM_MEMO]?.(pP, oldChild.props)) && isSameContext(oldContexts, oldChild[DOM_STASH][2])) oldChild.s = true;
					}
					child = oldChild;
				}
				else if (!isNodeString(child) && nameSpaceContext) {
					const ns = useContext(nameSpaceContext);
					if (ns) child.n = ns;
				}
				if (!isNodeString(child) && !child.s) {
					build(context, child);
					delete child.f;
				}
				vChildren.push(child);
				if (prevNode && !prevNode.s && !child.s) for (let p = prevNode; p && !isNodeString(p); p = p.vC?.at(-1)) p.nN = child;
				prevNode = child;
			}
		}
		oldVChildren = oldChildrenByKey ? [...oldChildrenByKey.values()] : oldVChildren;
		node.vR = buildWithPreviousChildren ? [...node.vC, ...oldVChildren || []] : oldVChildren || [];
		node.vC = vChildren;
		if (buildWithPreviousChildren) delete node.pC;
	} catch (e) {
		node.f = true;
		if (e === cancelBuild) if (foundErrorHandler) return;
		else throw e;
		const [errorHandlerContext, errorHandler, errorHandlerNode] = node[DOM_STASH]?.[3] || [];
		if (errorHandler) {
			const fallbackUpdateFn = () => update([
				0,
				false,
				context[2]
			], errorHandlerNode);
			const fallbackUpdateFnArray = fallbackUpdateFnArrayMap.get(errorHandlerNode) || [];
			fallbackUpdateFnArray.push(fallbackUpdateFn);
			fallbackUpdateFnArrayMap.set(errorHandlerNode, fallbackUpdateFnArray);
			const fallback = errorHandler(e, () => {
				const fnArray = fallbackUpdateFnArrayMap.get(errorHandlerNode);
				if (fnArray) {
					const i = fnArray.indexOf(fallbackUpdateFn);
					if (i !== -1) {
						fnArray.splice(i, 1);
						return fallbackUpdateFn();
					}
				}
			});
			if (fallback) {
				if (context[0] === 1) context[1] = true;
				else {
					build(context, errorHandlerNode, [fallback]);
					if ((errorHandler.length === 1 || context !== errorHandlerContext) && errorHandlerNode.c) {
						apply(errorHandlerNode, errorHandlerNode.c, false);
						return;
					}
				}
				throw cancelBuild;
			}
		}
		throw e;
	} finally {
		if (foundErrorHandler) context[5].pop();
	}
};
const buildNode = (node) => {
	if (node === void 0 || node === null || typeof node === "boolean") return;
	else if (typeof node === "string" || typeof node === "number") return {
		t: node.toString(),
		d: true
	};
	else {
		if ("vR" in node) node = {
			tag: node.tag,
			props: node.props,
			key: node.key,
			f: node.f,
			type: node.tag,
			ref: node.props.ref,
			o: node.o || node
		};
		if (typeof node.tag === "function") node[DOM_STASH] = [0, []];
		else {
			const ns = nameSpaceMap[node.tag];
			if (ns) {
				nameSpaceContext ||= createContext("");
				node.props.children = [{
					tag: nameSpaceContext,
					props: {
						value: node.n = `http://www.w3.org/${ns}`,
						children: node.props.children
					}
				}];
			}
		}
		return node;
	}
};
const replaceContainer = (node, from, to) => {
	if (node.c === from) {
		node.c = to;
		node.vC.forEach((child) => replaceContainer(child, from, to));
	}
};
const updateSync = (context, node) => {
	node[DOM_STASH][2]?.forEach(([c, v]) => {
		c.values.push(v);
	});
	try {
		build(context, node, void 0);
	} catch {
		return;
	}
	if (node.a) {
		delete node.a;
		return;
	}
	node[DOM_STASH][2]?.forEach(([c]) => {
		c.values.pop();
	});
	if (context[0] !== 1 || !context[1]) apply(node, node.c, false);
};
const updateMap = /* @__PURE__ */ new WeakMap();
const currentUpdateSets = [];
const update = async (context, node) => {
	context[5] ||= [];
	const existing = updateMap.get(node);
	if (existing) existing[0](void 0);
	let resolve;
	const promise = new Promise((r) => resolve = r);
	updateMap.set(node, [resolve, () => {
		if (context[2]) context[2](context, node, (context) => {
			updateSync(context, node);
		}).then(() => resolve(node));
		else {
			updateSync(context, node);
			resolve(node);
		}
	}]);
	if (currentUpdateSets.length) currentUpdateSets.at(-1).add(node);
	else {
		await Promise.resolve();
		const latest = updateMap.get(node);
		if (latest) {
			updateMap.delete(node);
			latest[1]();
		}
	}
	return promise;
};
const renderNode = (node, container) => {
	const context = [];
	context[5] = [];
	context[4] = true;
	build(context, node, void 0);
	context[4] = false;
	const fragment = document.createDocumentFragment();
	apply(node, fragment, true);
	replaceContainer(node, fragment, container);
	container.replaceChildren(fragment);
};
const render = (jsxNode, container) => {
	renderNode(buildNode({
		tag: "",
		props: { children: jsxNode }
	}), container);
};
const flushSync = (callback) => {
	const set = /* @__PURE__ */ new Set();
	currentUpdateSets.push(set);
	callback();
	set.forEach((node) => {
		const latest = updateMap.get(node);
		if (latest) {
			updateMap.delete(node);
			latest[1]();
		}
	});
	currentUpdateSets.pop();
};
const createPortal = (children, container, key) => ({
	tag: ACRYL_PORTAL_ELEMENT,
	props: { children },
	key,
	e: container,
	p: 1
});
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/hooks/index.ts
const STASH_SATE = 0;
const STASH_CALLBACK = 2;
const STASH_MEMO = 3;
const STASH_REF = 4;
const resolvedPromiseValueMap = /* @__PURE__ */ new WeakMap();
const isDepsChanged = (prevDeps, deps) => !prevDeps || !deps || prevDeps.length !== deps.length || deps.some((dep, i) => dep !== prevDeps[i]);
let viewTransitionState = void 0;
const documentStartViewTransition = (cb) => {
	if (document?.startViewTransition) return document.startViewTransition(cb);
	else {
		cb();
		return { finished: Promise.resolve() };
	}
};
let updateHook = void 0;
const viewTransitionHook = (context, node, cb) => {
	const state = [true, false];
	let lastVC = node.vC;
	return documentStartViewTransition(() => {
		if (lastVC === node.vC) {
			viewTransitionState = state;
			cb(context);
			viewTransitionState = void 0;
			lastVC = node.vC;
		}
	}).finished.then(() => {
		if (state[1] && lastVC === node.vC) {
			state[0] = false;
			viewTransitionState = state;
			cb(context);
			viewTransitionState = void 0;
		}
	});
};
const startViewTransition = (callback) => {
	updateHook = viewTransitionHook;
	try {
		callback();
	} finally {
		updateHook = void 0;
	}
};
const useViewTransition = () => {
	if (!buildDataStack.at(-1)) return [false, () => {}];
	if (viewTransitionState) viewTransitionState[1] = true;
	return [!!viewTransitionState?.[0], startViewTransition];
};
const pendingStack = [];
const runCallback = (type, callback) => {
	let resolve;
	const promise = new Promise((r) => resolve = r);
	pendingStack.push([type, promise]);
	try {
		const res = callback();
		if (res instanceof Promise) res.then(resolve, resolve);
		else resolve();
	} finally {
		pendingStack.pop();
	}
};
const startTransition = (callback) => {
	runCallback(1, callback);
};
const startTransitionHook = (callback) => {
	runCallback(2, callback);
};
const useTransition = () => {
	const buildData = buildDataStack.at(-1);
	if (!buildData) return [false, () => {}];
	const [error, setError] = useState();
	const [state, updateState] = useState();
	if (error) throw error[0];
	const startTransitionLocalHook = useCallback((callback) => {
		startTransitionHook(() => {
			updateState((state) => !state);
			let res = callback();
			if (res instanceof Promise) res = res.catch((e) => {
				setError([e]);
			});
			return res;
		});
	}, [state]);
	const [context] = buildData;
	return [context[0] === 2, startTransitionLocalHook];
};
const useDeferredValue = (value, ...rest) => {
	const [values, setValues] = useState(rest.length ? [rest[0], rest[0]] : [value, value]);
	if (Object.is(values[1], value)) return values[1];
	pendingStack.push([3, Promise.resolve()]);
	updateHook = async (context, _, cb) => {
		cb(context);
		values[0] = value;
	};
	setValues([values[0], value]);
	updateHook = void 0;
	pendingStack.pop();
	return values[0];
};
const useState = (initialState) => {
	const resolveInitialState = () => typeof initialState === "function" ? initialState() : initialState;
	const buildData = buildDataStack.at(-1);
	if (!buildData) return [resolveInitialState(), () => {}];
	const [, node] = buildData;
	const stateArray = node[DOM_STASH][1][STASH_SATE] ||= [];
	const hookIndex = node[DOM_STASH][0]++;
	return stateArray[hookIndex] ||= [resolveInitialState(), (newState) => {
		const localUpdateHook = updateHook;
		const stateData = stateArray[hookIndex];
		if (typeof newState === "function") newState = newState(stateData[0]);
		if (!Object.is(newState, stateData[0])) {
			stateData[0] = newState;
			if (pendingStack.length) {
				const [pendingType, pendingPromise] = pendingStack.at(-1);
				Promise.all([pendingType === 3 ? node : update([
					pendingType,
					false,
					localUpdateHook
				], node), pendingPromise]).then(([node]) => {
					if (!node || !(pendingType === 2 || pendingType === 3)) return;
					const lastVC = node.vC;
					const addUpdateTask = () => {
						setTimeout(() => {
							if (lastVC !== node.vC) return;
							update([
								pendingType === 3 ? 1 : 0,
								false,
								localUpdateHook
							], node);
						});
					};
					requestAnimationFrame(addUpdateTask);
				});
			} else update([
				0,
				false,
				localUpdateHook
			], node);
		}
	}];
};
const useReducer = (reducer, initialArg, init) => {
	const handler = useCallback((action) => {
		setState((state) => reducer(state, action));
	}, [reducer]);
	const [state, setState] = useState(() => init ? init(initialArg) : initialArg);
	return [state, handler];
};
const useEffectCommon = (index, effect, deps) => {
	const buildData = buildDataStack.at(-1);
	if (!buildData) return;
	const [, node] = buildData;
	const effectDepsArray = node[DOM_STASH][1][1] ||= [];
	const hookIndex = node[DOM_STASH][0]++;
	const [prevDeps, , prevCleanup] = effectDepsArray[hookIndex] ||= [];
	if (isDepsChanged(prevDeps, deps)) {
		if (prevCleanup) prevCleanup();
		const runner = () => {
			data[index] = void 0;
			data[2] = effect();
		};
		const data = [
			deps,
			void 0,
			void 0,
			void 0,
			void 0
		];
		data[index] = runner;
		effectDepsArray[hookIndex] = data;
	}
};
const useEffect = (effect, deps) => useEffectCommon(3, effect, deps);
const useLayoutEffect = (effect, deps) => useEffectCommon(1, effect, deps);
const useInsertionEffect = (effect, deps) => useEffectCommon(4, effect, deps);
const useCallback = (callback, deps) => {
	const buildData = buildDataStack.at(-1);
	if (!buildData) return callback;
	const [, node] = buildData;
	const callbackArray = node[DOM_STASH][1][STASH_CALLBACK] ||= [];
	const hookIndex = node[DOM_STASH][0]++;
	const prevDeps = callbackArray[hookIndex];
	if (isDepsChanged(prevDeps?.[1], deps)) callbackArray[hookIndex] = [callback, deps];
	else callback = callbackArray[hookIndex][0];
	return callback;
};
function useRef(initialValue) {
	const buildData = buildDataStack.at(-1);
	if (!buildData) return { current: initialValue };
	const [, node] = buildData;
	const refArray = node[DOM_STASH][1][STASH_REF] ||= [];
	const hookIndex = node[DOM_STASH][0]++;
	return refArray[hookIndex] ||= { current: initialValue };
}
const use = (promise) => {
	const cachedRes = resolvedPromiseValueMap.get(promise);
	if (cachedRes) {
		if (cachedRes.length === 2) throw cachedRes[1];
		return cachedRes[0];
	}
	promise.then((res) => resolvedPromiseValueMap.set(promise, [res]), (e) => resolvedPromiseValueMap.set(promise, [void 0, e]));
	throw promise;
};
const useMemo = (factory, deps) => {
	const buildData = buildDataStack.at(-1);
	if (!buildData) return factory();
	const [, node] = buildData;
	const memoArray = node[DOM_STASH][1][STASH_MEMO] ||= [];
	const hookIndex = node[DOM_STASH][0]++;
	const prevDeps = memoArray[hookIndex];
	if (isDepsChanged(prevDeps?.[1], deps)) memoArray[hookIndex] = [factory(), deps];
	return memoArray[hookIndex][0];
};
let idCounter = 0;
const useId = () => useMemo(() => `:r${(idCounter++).toString(32)}:`, []);
const useDebugValue = (_value, _formatter) => {};
const createRef = () => {
	return { current: null };
};
const forwardRef = (Component) => {
	return (props) => {
		const { ref, ...rest } = props;
		return Component(rest, ref);
	};
};
const useImperativeHandle = (ref, createHandle, deps) => {
	useEffect(() => {
		ref.current = createHandle();
		return () => {
			ref.current = null;
		};
	}, deps);
};
const useSyncExternalStore = (subscribe, getSnapshot, getServerSnapshot) => {
	const buildData = buildDataStack.at(-1);
	if (!buildData) {
		if (!getServerSnapshot) throw new Error("getServerSnapshot is required for server side rendering");
		return getServerSnapshot();
	}
	const snapshot = buildData[0][4] && getServerSnapshot ? getServerSnapshot() : getSnapshot();
	const [, setVersion] = useState(0);
	const latestSnapshot = useRef([snapshot, getSnapshot]);
	latestSnapshot.current = [snapshot, getSnapshot];
	const unsubscribeRef = useRef(null);
	useEffect(() => {
		const update = () => setVersion((version) => version + 1);
		unsubscribeRef.current?.();
		unsubscribeRef.current = subscribe(update);
		const [snapshot, getSnapshot] = latestSnapshot.current;
		if (!Object.is(snapshot, getSnapshot())) update();
	}, [subscribe]);
	useEffect(() => () => unsubscribeRef.current?.(), []);
	return snapshot;
};
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/dom/hooks/index.ts
/**
* Provide hooks used only in jsx/dom
*/
const FormContext = createContext({
	pending: false,
	data: null,
	method: null,
	action: null
});
const actions = /* @__PURE__ */ new Set();
const registerAction = (action) => {
	actions.add(action);
	action.finally(() => actions.delete(action));
};
/**
* This hook returns the current form status
* @returns FormStatus
*/
const useFormStatus = () => {
	return useContext(FormContext);
};
/**
* This hook returns the current state and a function to update the state optimistically
* The current state is updated optimistically and then reverted to the original state when all actions are resolved
* @param state
* @param updateState
* @returns [T, (action: N) => void]
*/
const useOptimistic = (state, updateState) => {
	const [optimisticState, setOptimisticState] = useState(state);
	if (actions.size > 0) Promise.all(actions).finally(() => {
		setOptimisticState(state);
	});
	else setOptimisticState(state);
	return [optimisticState, useCallback((newData) => {
		setOptimisticState((currentState) => updateState(currentState, newData));
	}, [])];
};
/**
* This hook returns the current state and a function to update the state by form action
* @param fn
* @param initialState
* @param permalink
* @returns [T, (data: FormData) => void]
*/
const useActionState = (fn, initialState, permalink) => {
	const [state, setState] = useState(initialState);
	const actionState = async (data) => {
		setState(await fn(state, data));
	};
	actionState[PERMALINK] = permalink;
	return [state, actionState];
};
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/dom/intrinsic-element/components.ts
var components_exports = /* @__PURE__ */ __exportAll({
	button: () => button,
	clearCache: () => clearCache,
	composeRef: () => composeRef,
	form: () => form,
	input: () => input,
	link: () => link,
	meta: () => meta,
	script: () => script,
	style: () => style,
	title: () => title
});
const clearCache = () => {
	blockingPromiseMap = Object.create(null);
	createdElements = Object.create(null);
};
const composeRef = (ref, cb) => {
	return useMemo(() => (e) => {
		let refCleanup;
		if (ref) {
			if (typeof ref === "function") refCleanup = ref(e) || (() => {
				ref(null);
			});
			else if (ref && "current" in ref) {
				ref.current = e;
				refCleanup = () => {
					ref.current = null;
				};
			}
		}
		const cbCleanup = cb(e);
		return () => {
			cbCleanup?.();
			refCleanup?.();
		};
	}, [ref]);
};
let blockingPromiseMap = Object.create(null);
let createdElements = Object.create(null);
const documentMetadataTag = (tag, props, preserveNodeType, supportSort, supportBlocking) => {
	if (props?.itemProp) return {
		tag,
		props,
		type: tag,
		ref: props.ref
	};
	const head = document.head;
	let { onLoad, onError, precedence, blocking, ...restProps } = props;
	let element = null;
	let created = false;
	const deDupeKeys = deDupeKeyMap[tag];
	const deDupeByKey = shouldDeDupeByKey(tag, supportSort);
	const isDeDupeCandidateLink = (e) => e.getAttribute("rel") === "stylesheet" && e.getAttribute("data-precedence") !== null;
	let existingElements = void 0;
	if (deDupeByKey) {
		const tags = head.querySelectorAll(tag);
		LOOP: for (const e of tags) {
			if (tag === "link" && !isDeDupeCandidateLink(e)) continue;
			for (const key of deDupeKeys) if (e.getAttribute(key) === props[key]) {
				element = e;
				break LOOP;
			}
		}
		if (!element) {
			const cacheKey = deDupeKeys.reduce((acc, key) => props[key] === void 0 ? acc : `${acc}-${key}-${props[key]}`, tag);
			created = !createdElements[cacheKey];
			element = createdElements[cacheKey] ||= (() => {
				const e = document.createElement(tag);
				for (const key of deDupeKeys) if (props[key] !== void 0) e.setAttribute(key, props[key]);
				if (props.rel) e.setAttribute("rel", props.rel);
				return e;
			})();
		}
	} else existingElements = head.querySelectorAll(tag);
	precedence = supportSort ? precedence ?? "" : void 0;
	if (supportSort) restProps[dataPrecedenceAttr] = precedence;
	const insert = useCallback((e) => {
		if (deDupeByKey) {
			if (tag === "link" && precedence !== void 0) {
				let found = false;
				for (const existingElement of head.querySelectorAll(tag)) {
					const existingPrecedence = existingElement.getAttribute(dataPrecedenceAttr);
					if (existingPrecedence === null) {
						head.insertBefore(e, existingElement);
						return;
					}
					if (found && existingPrecedence !== precedence) {
						head.insertBefore(e, existingElement);
						return;
					}
					if (existingPrecedence === precedence) found = true;
				}
				head.appendChild(e);
				return;
			}
			let found = false;
			for (const existingElement of head.querySelectorAll(tag)) {
				if (found && existingElement.getAttribute("data-precedence") !== precedence) {
					head.insertBefore(e, existingElement);
					return;
				}
				if (existingElement.getAttribute("data-precedence") === precedence) found = true;
			}
			head.appendChild(e);
		} else if (tag === "link") {
			if (!head.contains(e)) head.appendChild(e);
		} else if (existingElements) {
			let found = false;
			for (const existingElement of existingElements) if (existingElement === e) {
				found = true;
				break;
			}
			if (!found) head.insertBefore(e, head.contains(existingElements[0]) ? existingElements[0] : head.querySelector(tag));
			existingElements = void 0;
		}
	}, [
		deDupeByKey,
		precedence,
		tag
	]);
	const ref = composeRef(props.ref, (e) => {
		const key = deDupeKeys[0];
		if (preserveNodeType === 2) e.innerHTML = "";
		if (created || existingElements) insert(e);
		if (!onError && !onLoad) return;
		if (!key) return;
		let promise = blockingPromiseMap[e.getAttribute(key)] ||= new Promise((resolve, reject) => {
			e.addEventListener("load", resolve);
			e.addEventListener("error", reject);
		});
		if (onLoad) promise = promise.then(onLoad);
		if (onError) promise = promise.catch(onError);
		promise.catch(() => {});
	});
	if (supportBlocking && blocking === "render") {
		const key = deDupeKeyMap[tag][0];
		if (key && props[key]) {
			const value = props[key];
			use(blockingPromiseMap[value] ||= new Promise((resolve, reject) => {
				insert(element);
				element.addEventListener("load", resolve);
				element.addEventListener("error", reject);
			}));
		}
	}
	const jsxNode = {
		tag,
		type: tag,
		props: {
			...restProps,
			ref
		},
		ref
	};
	jsxNode.p = preserveNodeType;
	if (element) jsxNode.e = element;
	return createPortal(jsxNode, head);
};
const title = (props) => {
	const nameSpaceContext = getNameSpaceContext();
	if ((nameSpaceContext && useContext(nameSpaceContext))?.endsWith("svg")) return {
		tag: "title",
		props,
		type: "title",
		ref: props.ref
	};
	return documentMetadataTag("title", props, void 0, false, false);
};
const script = (props) => {
	if (!props || ["src", "async"].some((k) => !props[k])) return {
		tag: "script",
		props,
		type: "script",
		ref: props.ref
	};
	return documentMetadataTag("script", props, 1, false, true);
};
const style = (props) => {
	if (!props || !["href", "precedence"].every((k) => k in props)) return {
		tag: "style",
		props,
		type: "style",
		ref: props.ref
	};
	props["data-href"] = props.href;
	delete props.href;
	return documentMetadataTag("style", props, 2, true, true);
};
const link = (props) => {
	if (!props || ["onLoad", "onError"].some((k) => k in props) || props.rel === "stylesheet" && (!("precedence" in props) || "disabled" in props)) return {
		tag: "link",
		props,
		type: "link",
		ref: props.ref
	};
	return documentMetadataTag("link", props, 1, isStylesheetLinkWithPrecedence(props), true);
};
const meta = (props) => {
	return documentMetadataTag("meta", props, void 0, false, false);
};
const customEventFormAction = Symbol();
const form = (props) => {
	const { action, ...restProps } = props;
	if (typeof action !== "function") restProps.action = action;
	const [state, setState] = useState([null, false]);
	const onSubmit = useCallback(async (ev) => {
		const currentAction = ev.isTrusted ? action : ev.detail[customEventFormAction];
		if (typeof currentAction !== "function") return;
		ev.preventDefault();
		const formData = new FormData(ev.target);
		setState([formData, true]);
		const actionRes = currentAction(formData);
		if (actionRes instanceof Promise) {
			registerAction(actionRes);
			await actionRes;
		}
		setState([null, true]);
	}, []);
	const ref = composeRef(props.ref, (el) => {
		el.addEventListener("submit", onSubmit);
		return () => {
			el.removeEventListener("submit", onSubmit);
		};
	});
	const [data, isDirty] = state;
	state[1] = false;
	return {
		tag: FormContext,
		props: {
			value: {
				pending: data !== null,
				data,
				method: data ? "post" : null,
				action: data ? action : null
			},
			children: {
				tag: "form",
				props: {
					...restProps,
					ref
				},
				type: "form",
				ref
			}
		},
		f: isDirty
	};
};
const formActionableElement = (tag, { formAction, ...props }) => {
	if (typeof formAction === "function") {
		const onClick = useCallback((ev) => {
			ev.preventDefault();
			ev.currentTarget.form.dispatchEvent(new CustomEvent("submit", { detail: { [customEventFormAction]: formAction } }));
		}, []);
		props.ref = composeRef(props.ref, (el) => {
			el.addEventListener("click", onClick);
			return () => {
				el.removeEventListener("click", onClick);
			};
		});
	}
	return {
		tag,
		props,
		type: tag,
		ref: props.ref
	};
};
const input = (props) => formActionableElement("input", props);
const button = (props) => formActionableElement("button", props);
Object.assign(domRenderers, {
	title,
	script,
	style,
	link,
	meta,
	form,
	input,
	button
});
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/dom/jsx-dev-runtime.ts
const jsxDEV = (tag, props, key) => {
	if (typeof tag === "string" && components_exports[tag]) tag = components_exports[tag];
	return {
		tag,
		type: tag,
		props,
		key,
		ref: props.ref
	};
};
const Fragment = (props) => jsxDEV("", props, void 0);
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/dom/components.ts
const ErrorBoundary = (({ children, fallback, fallbackRender, onError }) => {
	const res = Fragment({ children });
	res[DOM_ERROR_HANDLER] = (err) => {
		if (err instanceof Promise) throw err;
		onError?.(err);
		return fallbackRender?.(err) || fallback;
	};
	return res;
});
const Suspense = (({ children, fallback }) => {
	const res = Fragment({ children });
	res[DOM_ERROR_HANDLER] = (err, retry) => {
		if (!(err instanceof Promise)) throw err;
		err.finally(retry);
		return fallback;
	};
	return res;
});
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/dom/index.ts
/**
* @module
* This module provides APIs for `acryl-router/jsx/dom`.
*/
const createElement = (tag, props, ...children) => {
	const jsxProps = props ? { ...props } : {};
	if (children.length) jsxProps.children = children.length === 1 ? children[0] : children;
	let key = void 0;
	if ("key" in jsxProps) {
		key = jsxProps.key;
		delete jsxProps.key;
	}
	return jsxDEV(tag, jsxProps, key);
};
const cloneElement = (element, props, ...children) => {
	return jsxDEV(element.tag, {
		...element.props,
		...props,
		children: children.length ? children : element.props.children
	}, element.key);
};
const memo = (component, propsAreEqual = shallowEqual) => {
	const wrapper = ((props) => component(props));
	wrapper[DOM_MEMO] = propsAreEqual;
	return wrapper;
};
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/dom/client.ts
/**
* Create a root object for rendering
* @param element Render target
* @param options Options for createRoot (not supported yet)
* @returns Root object has `render` and `unmount` methods
*/
const createRoot = (element, options = {}) => {
	let setJsxNode = void 0;
	if (Object.keys(options).length > 0) console.warn("createRoot options are not supported yet");
	return {
		render(jsxNode) {
			if (setJsxNode === null) throw new Error("Cannot update an unmounted root");
			if (setJsxNode) setJsxNode(jsxNode);
			else renderNode(buildNode({
				tag: () => {
					const [_jsxNode, _setJsxNode] = useState(jsxNode);
					setJsxNode = _setJsxNode;
					return _jsxNode;
				},
				props: {}
			}), element);
		},
		unmount() {
			setJsxNode?.(null);
			setJsxNode = null;
		}
	};
};
/**
* Create a root object and hydrate app to the target element.
* In acryl-router/jsx/dom, hydrate is equivalent to render.
* @param element Render target
* @param reactNode A JSXNode to render
* @param options Options for createRoot (not supported yet)
* @returns Root object has `render` and `unmount` methods
*/
const hydrateRoot = (element, reactNode, options = {}) => {
	const root = createRoot(element, options);
	root.render(reactNode);
	return root;
};
//#endregion
export { Children, ErrorBoundary, Fragment, Fragment as StrictMode, Suspense, cloneElement, createContext, createElement, createPortal, createRef, createRoot, flushSync, forwardRef, hydrateRoot, isValidElement, jsxDEV as jsx, jsxDEV, jsxDEV as jsxs, memo, render, startTransition, startViewTransition, use, useActionState, useCallback, useContext, useDebugValue, useDeferredValue, useEffect, useFormStatus, useId, useImperativeHandle, useInsertionEffect, useLayoutEffect, useMemo, useOptimistic, useReducer, useRef, useState, useSyncExternalStore, useTransition, useViewTransition, reactAPICompatVersion as version };
