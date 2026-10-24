import { checkOptionalParameter } from "./utils/url.js";
import { MESSAGE_MATCHER_IS_ALREADY_BUILT, UnsupportedPathError } from "./router.js";
import { t as createNullObject } from "./utils-dw8lxqjL.js";
//#region ../../plugins/acryl-router/src/core/router/reg-exp-router/matcher.ts
const emptyParam = [];
function match(method, path) {
	const matchers = this.buildAllMatchers();
	const match = ((method, path) => {
		const matcher = matchers[method] || matchers["ALL"];
		const staticMatch = matcher[2][path];
		if (staticMatch) return staticMatch;
		const match = path.match(matcher[0]);
		if (!match) return [[], emptyParam];
		const index = match.indexOf("", 1);
		return [matcher[1][index], match];
	});
	this.match = match;
	return match(method, path);
}
//#endregion
//#region ../../plugins/acryl-router/src/core/router/reg-exp-router/node.ts
const LABEL_REG_EXP_STR = "[^/]+";
const TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
const PATH_ERROR = Symbol();
const regExpMetaChars = /* @__PURE__ */ new Set(".\\+*[^]$()");
/**
* Sort order:
* 1. literal
* 2. special pattern (e.g. :label{[0-9]+})
* 3. common label pattern (e.g. :label)
* 4. wildcard
*/
function compareKey(a, b) {
	if (a.length === 1) return b.length === 1 ? a < b ? -1 : 1 : -1;
	if (b.length === 1) return 1;
	if (a === ".*" || a === "(?:|/.*)") return b === "(?:|/.*)" ? -1 : 1;
	else if (b === ".*" || b === "(?:|/.*)") return -1;
	if (a === "[^/]+") return 1;
	else if (b === "[^/]+") return -1;
	return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class Node {
	#index;
	#varIndex;
	#children = createNullObject();
	insert(tokens, index, paramMap, context, isStatic) {
		let node = this;
		for (let i = 0, len = tokens.length; i < len; i++) {
			const token = tokens[i];
			const pattern = token.length === 1 ? token === "*" ? i === len - 1 ? [
				"",
				"",
				".*"
			] : [
				"",
				"",
				LABEL_REG_EXP_STR
			] : null : token === "/*" ? [
				"",
				"",
				TAIL_WILDCARD_REG_EXP_STR
			] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
			let nextNode;
			if (pattern) {
				const name = pattern[1];
				let regexpStr = pattern[2] || "[^/]+";
				if (name && pattern[2]) {
					if (regexpStr === ".*") throw PATH_ERROR;
					regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
					if (/\((?!\?:)/.test(regexpStr)) throw PATH_ERROR;
					if (regexpStr.length === 1 && regExpMetaChars.has(regexpStr)) throw PATH_ERROR;
				}
				nextNode = node.#children[regexpStr];
				if (!nextNode) {
					if (regexpStr !== ".*" && regexpStr !== "(?:|/.*)") {
						for (const k in node.#children) if ((regexpStr.length > 1 || k.length > 1) && k !== ".*" && k !== "(?:|/.*)") throw PATH_ERROR;
					}
					nextNode = node.#children[regexpStr] = new Node();
				}
				if (name !== "") {
					nextNode.#varIndex ??= context.varIndex++;
					paramMap.push([name, nextNode.#varIndex]);
				}
			} else {
				nextNode = node.#children[token];
				if (!nextNode) {
					for (const k in node.#children) if (k.length > 1 && k !== ".*" && k !== "(?:|/.*)") throw PATH_ERROR;
					nextNode = node.#children[token] = new Node();
				}
			}
			node = nextNode;
		}
		if (node.#index !== void 0) throw PATH_ERROR;
		node.#index = isStatic ? -1 : index;
	}
	buildRegExpStr() {
		const strList = Object.keys(this.#children).sort(compareKey).map((k) => {
			const c = this.#children[k];
			const childStr = c.buildRegExpStr();
			return childStr === "" ? "" : (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + childStr;
		}).filter(Boolean);
		if (typeof this.#index === "number" && this.#index !== -1) strList.unshift(`#${this.#index}`);
		if (strList.length === 0) return "";
		if (strList.length === 1) return strList[0];
		return "(?:" + strList.join("|") + ")";
	}
};
//#endregion
//#region ../../plugins/acryl-router/src/core/router/reg-exp-router/trie.ts
var Trie = class {
	#context = { varIndex: 0 };
	#root = new Node();
	#index = 0;
	paths = createNullObject();
	insert(path, isStatic) {
		if (isStatic) {
			this.#root.insert(path.split(""), 0, [], this.#context, true);
			return;
		}
		const paramAssoc = [];
		const groups = [];
		let markedPath = path;
		for (let i = 0;;) {
			let replaced = false;
			markedPath = markedPath.replace(/\{[^}]+\}/g, (m) => {
				const mark = `@\\${i}`;
				groups[i] = [mark, m];
				i++;
				replaced = true;
				return mark;
			});
			if (!replaced) break;
		}
		/**
		*  - pattern (:label, :label{0-9]+}, ...)
		*  - /* wildcard
		*  - character
		*/
		const tokens = markedPath.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
		for (let i = groups.length - 1; i >= 0; i--) {
			const [mark] = groups[i];
			for (let j = tokens.length - 1; j >= 0; j--) if (tokens[j].indexOf(mark) !== -1) {
				tokens[j] = tokens[j].replace(mark, groups[i][1]);
				break;
			}
		}
		this.#root.insert(tokens, this.#index, paramAssoc, this.#context, false);
		this.paths[path] = [this.#index++, paramAssoc];
	}
	buildRegExp() {
		let regexp = this.#root.buildRegExpStr();
		if (regexp === "") return [
			/^$/,
			[],
			[]
		];
		let captureIndex = 0;
		const indexReplacementMap = [];
		const paramReplacementMap = [];
		regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
			if (handlerIndex !== void 0) {
				indexReplacementMap[++captureIndex] = Number(handlerIndex);
				return "$()";
			}
			if (paramIndex !== void 0) {
				paramReplacementMap[Number(paramIndex)] = ++captureIndex;
				return "";
			}
			return "";
		});
		return [
			new RegExp(`^${regexp}`),
			indexReplacementMap,
			paramReplacementMap
		];
	}
};
//#endregion
//#region ../../plugins/acryl-router/src/core/router/reg-exp-router/router.ts
let wildcardRegExpCache = createNullObject();
function buildWildcardRegExp(path) {
	return wildcardRegExpCache[path] ??= new RegExp(`^${path.replace(/\/:[^/{}]+(?:\{\[\^\/]\+})?(?=[/{]|$)|\/?\*$|([.\\+*[^\]$()?{}|])/g, (match, metaChar) => metaChar ? `\\${metaChar}` : match === "/*" ? TAIL_WILDCARD_REG_EXP_STR : match === "*" ? ".*" : `/:${LABEL_REG_EXP_STR}`)}$`);
}
function findMiddleware(middleware, path) {
	for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) if (buildWildcardRegExp(k).test(path)) return [...middleware[k]];
}
var RegExpRouter = class {
	name = "RegExpRouter";
	#middleware;
	#routes;
	#tries;
	constructor() {
		this.#middleware = { ["ALL"]: createNullObject() };
		this.#routes = { ["ALL"]: createNullObject() };
		this.#tries = { ["ALL"]: new Trie() };
	}
	#insertPath(method, path) {
		try {
			this.#tries[method].insert(path, !/\*|\/:/.test(path));
		} catch (e) {
			throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
		}
	}
	add(method, path, handler) {
		const middleware = this.#middleware;
		const routes = this.#routes;
		if (!middleware) throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
		if (!middleware[method]) {
			this.#tries[method] = new Trie();
			for (const handlerMap of [middleware, routes]) {
				handlerMap[method] = createNullObject();
				for (const p in handlerMap["ALL"]) {
					handlerMap[method][p] = [...handlerMap["ALL"][p]];
					this.#insertPath(method, p);
				}
			}
		}
		if (path === "/*") path = "*";
		const methods = method === "ALL" ? Object.keys(middleware) : [method];
		if (/\*$/.test(path)) {
			const re = buildWildcardRegExp(path);
			for (const m of methods) if (!middleware[m][path]) {
				this.#insertPath(m, path);
				middleware[m][path] = findMiddleware(middleware[m], path) || findMiddleware(middleware["ALL"], path) || [];
			}
			for (const handlerMap of [middleware, routes]) for (const m of methods) for (const p in handlerMap[m]) re.test(p) && handlerMap[m][p].push([handler, path]);
			return;
		}
		const paths = checkOptionalParameter(path) || [path];
		for (const path of paths) for (const m of methods) {
			if (!routes[m][path]) {
				this.#insertPath(m, path);
				routes[m][path] = findMiddleware(middleware[m], path) || findMiddleware(middleware["ALL"], path) || [];
			}
			routes[m][path].push([handler, path]);
		}
	}
	match = match;
	buildAllMatchers() {
		const matchers = createNullObject();
		for (const method of Object.keys(this.#routes)) matchers[method] = this.#buildMatcher(method);
		this.#middleware = this.#routes = this.#tries = void 0;
		wildcardRegExpCache = createNullObject();
		return matchers;
	}
	#buildMatcher(method) {
		const middleware = this.#middleware[method];
		const routes = this.#routes[method];
		const trie = this.#tries[method];
		const staticMap = createNullObject();
		const handlerData = [];
		const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
		for (const r of [middleware, routes]) for (const path in r) {
			const handlers = r[path];
			const pathData = trie.paths[path];
			if (!pathData) {
				staticMap[path] = [handlers.map(([h]) => [h, createNullObject()]), emptyParam];
				continue;
			}
			handlerData[pathData[0]] = handlers.map(([h, handlerPath]) => [h, trie.paths[handlerPath][1].reduceRight((map, [key], i) => {
				map[key] = paramReplacementMap[pathData[1][i][1]];
				return map;
			}, createNullObject())]);
		}
		return [
			regexp,
			indexReplacementMap.map((i) => handlerData[i]),
			staticMap
		];
	}
};
//#endregion
//#region ../../plugins/acryl-router/src/core/router/reg-exp-router/prepared-router.ts
var PreparedRegExpRouter = class {
	name = "PreparedRegExpRouter";
	#matchers;
	#relocateMap;
	constructor(matchers, relocateMap) {
		this.#matchers = matchers;
		this.#relocateMap = relocateMap;
	}
	#addWildcard(method, handlerData) {
		const matcher = this.#matchers[method];
		matcher[1].forEach((list) => list && list.push(handlerData));
		Object.values(matcher[2]).forEach((list) => list[0].push(handlerData));
	}
	#addPath(method, path, handler, indexes, map) {
		const matcher = this.#matchers[method];
		if (!map) matcher[2][path][0].push([handler, {}]);
		else indexes.forEach((index) => {
			if (typeof index === "number") matcher[1][index].push([handler, map]);
			else matcher[2][index || path][0].push([handler, map]);
		});
	}
	add(method, path, handler) {
		if (!this.#matchers[method]) {
			const all = this.#matchers["ALL"];
			const staticMap = {};
			for (const key in all[2]) staticMap[key] = [all[2][key][0].slice(), emptyParam];
			this.#matchers[method] = [
				all[0],
				all[1].map((list) => Array.isArray(list) ? list.slice() : 0),
				staticMap
			];
		}
		if (path === "/*" || path === "*") {
			const handlerData = [handler, {}];
			if (method === "ALL") for (const m in this.#matchers) this.#addWildcard(m, handlerData);
			else this.#addWildcard(method, handlerData);
			return;
		}
		const data = this.#relocateMap[path];
		if (!data) throw new Error(`Path ${path} is not registered`);
		for (const [indexes, map] of data) if (method === "ALL") for (const m in this.#matchers) this.#addPath(m, path, handler, indexes, map);
		else this.#addPath(method, path, handler, indexes, map);
	}
	buildAllMatchers() {
		return this.#matchers;
	}
	match = match;
};
const buildInitParams = ({ paths }) => {
	const RegExpRouterWithMatcherExport = class extends RegExpRouter {
		buildAndExportAllMatchers() {
			return this.buildAllMatchers();
		}
	};
	const router = new RegExpRouterWithMatcherExport();
	for (const path of paths) router.add("ALL", path, path);
	const matchers = router.buildAndExportAllMatchers();
	const all = matchers["ALL"];
	const relocateMap = {};
	for (const path of paths) {
		if (path === "/*" || path === "*") continue;
		all[1].forEach((list, i) => {
			list.forEach(([p, map]) => {
				if (p === path) {
					if (relocateMap[path]) relocateMap[path][0][1] = {
						...relocateMap[path][0][1],
						...map
					};
					else relocateMap[path] = [[[], map]];
					if (relocateMap[path][0][0].findIndex((j) => j === i) === -1) relocateMap[path][0][0].push(i);
				}
			});
		});
		for (const path2 in all[2]) all[2][path2][0].forEach(([p]) => {
			if (p === path) {
				relocateMap[path] ||= [[[]]];
				const value = path2 === path ? "" : path2;
				if (relocateMap[path][0][0].findIndex((v) => v === value) === -1) relocateMap[path][0][0].push(value);
			}
		});
	}
	for (let i = 0, len = all[1].length; i < len; i++) all[1][i] = all[1][i] ? [] : 0;
	for (const path in all[2]) all[2][path][0] = [];
	return [matchers, relocateMap];
};
const serializeInitParams = ([matchers, relocateMap]) => {
	return `[${JSON.stringify(matchers, (_, value) => value instanceof RegExp ? `##${value.toString()}##` : value).replace(/"##(.+?)##"/g, (_, str) => str.replace(/\\\\/g, "\\"))},${JSON.stringify(relocateMap)}]`;
};
//#endregion
export { RegExpRouter as i, buildInitParams as n, serializeInitParams as r, PreparedRegExpRouter as t };
