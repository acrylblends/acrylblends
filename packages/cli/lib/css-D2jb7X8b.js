//#region ../../plugins/acryl-router/src/core/helper/css/common.ts
const PSEUDO_GLOBAL_SELECTOR = ":-acryl-global";
const isPseudoGlobalSelectorRe = new RegExp(`^${PSEUDO_GLOBAL_SELECTOR}{(.*)}$`);
const DEFAULT_STYLE_ID = "acryl-css";
const SELECTOR = Symbol();
const CLASS_NAME = Symbol();
const STYLE_STRING = Symbol();
const SELECTORS = Symbol();
const EXTERNAL_CLASS_NAMES = Symbol();
const CSS_ESCAPED = Symbol();
/**
* @experimental
* `rawCssString` is an experimental feature.
* The API might be changed.
*/
const rawCssString = (value) => {
	return { [CSS_ESCAPED]: value };
};
/**
* Used the goober'code as a reference:
* https://github.com/cristianbote/goober/blob/master/src/core/to-hash.js
* MIT License, Copyright (c) 2019 Cristian Bote
*/
const toHash = (str) => {
	let i = 0, out = 11;
	while (i < str.length) out = 101 * out + str.charCodeAt(i++) >>> 0;
	return "css-" + out;
};
const normalizeLabel = (label) => {
	return label.trim().replace(/\s+/g, "-");
};
const isValidClassName = (name) => /^-?[_a-zA-Z][_a-zA-Z0-9-]*$/.test(name);
const hasUnsafeSelectorChar = (name) => /[<{}]/.test(name);
const RESERVED_KEYFRAME_NAMES = /* @__PURE__ */ new Set([
	"default",
	"inherit",
	"initial",
	"none",
	"revert",
	"revert-layer",
	"unset"
]);
const isValidKeyframeName = (name) => isValidClassName(name) && !RESERVED_KEYFRAME_NAMES.has(name.toLowerCase());
const defaultOnInvalidSlug = (slug) => {
	console.warn(`Invalid slug: ${slug}`);
};
const cssStringReStr = [
	"\"(?:(?:\\\\[\\s\\S]|[^\"\\\\])*)\"",
	"'(?:(?:\\\\[\\s\\S]|[^'\\\\])*)'",
	"url\\(\\s*[^)\"'\\s]*\\s*\\)"
].join("|");
const minifyCssRe = new RegExp([
	"(" + cssStringReStr + ")",
	"(?:" + [
		"^\\s+",
		"\\/\\*.*?\\*\\/\\s*",
		"\\/\\/.*\\n\\s*",
		"\\s+$"
	].join("|") + ")",
	"\\s*;\\s*(}|$)\\s*",
	"\\s*([{};,])\\s*",
	"(:)\\s*",
	"(\\s)\\s+"
].join("|"), "g");
const minify = (css) => {
	return css.replace(minifyCssRe, (_, $1, $2, $3, $4, $5) => $1 || $2 || $3 || $4 || $5 || "");
};
const buildStyleString = (strings, values) => {
	const selectors = [];
	const externalClassNames = [];
	const label = strings[0].match(/^\s*\/\*(.*?)\*\//)?.[1] || "";
	let styleString = "";
	for (let i = 0, len = strings.length; i < len; i++) {
		styleString += strings[i];
		let vArray = values[i];
		if (typeof vArray === "boolean" || vArray === null || vArray === void 0) continue;
		if (!Array.isArray(vArray)) vArray = [vArray];
		for (let j = 0, len = vArray.length; j < len; j++) {
			let value = vArray[j];
			if (typeof value === "boolean" || value === null || value === void 0) continue;
			if (typeof value === "string") if (/([\\"'\/])/.test(value)) styleString += value.replace(/([\\"']|(?<=<)\/)/g, "\\$1");
			else styleString += value;
			else if (typeof value === "number") styleString += value;
			else if (value[CSS_ESCAPED]) styleString += value[CSS_ESCAPED];
			else if (value[CLASS_NAME].startsWith("@keyframes ")) {
				selectors.push(value);
				styleString += ` ${value[CLASS_NAME].substring(11)} `;
			} else {
				if (strings[i + 1]?.match(/^\s*{/)) {
					selectors.push(value);
					value = `.${value[CLASS_NAME]}`;
				} else {
					selectors.push(...value[SELECTORS]);
					externalClassNames.push(...value[EXTERNAL_CLASS_NAMES]);
					value = value[STYLE_STRING];
					const valueLen = value.length;
					if (valueLen > 0) {
						const lastChar = value[valueLen - 1];
						if (lastChar !== ";" && lastChar !== "}") value += ";";
					}
				}
				styleString += `${value || ""}`;
			}
		}
	}
	return [
		label,
		minify(styleString),
		selectors,
		externalClassNames
	];
};
const cssCommon = (strings, values, classNameSlug, onInvalidSlug) => {
	let [label, thisStyleString, selectors, externalClassNames] = buildStyleString(strings, values);
	const isPseudoGlobal = isPseudoGlobalSelectorRe.exec(thisStyleString);
	if (isPseudoGlobal) thisStyleString = isPseudoGlobal[1];
	const hash = toHash(label + thisStyleString);
	let customSlug;
	if (classNameSlug) {
		const slug = classNameSlug(hash, normalizeLabel(label), thisStyleString);
		if (slug) if (isValidClassName(slug)) customSlug = slug;
		else (onInvalidSlug || defaultOnInvalidSlug)(slug);
	}
	const selector = (isPseudoGlobal ? PSEUDO_GLOBAL_SELECTOR : "") + (customSlug || hash);
	const className = (isPseudoGlobal ? selectors.map((s) => s[CLASS_NAME]) : [selector, ...externalClassNames]).join(" ");
	return {
		[SELECTOR]: selector,
		[CLASS_NAME]: className,
		[STYLE_STRING]: thisStyleString,
		[SELECTORS]: selectors,
		[EXTERNAL_CLASS_NAMES]: externalClassNames
	};
};
const cxCommon = (args) => {
	for (let i = 0, len = args.length; i < len; i++) {
		const arg = args[i];
		if (typeof arg === "string") args[i] = {
			[SELECTOR]: "",
			[CLASS_NAME]: "",
			[STYLE_STRING]: "",
			[SELECTORS]: [],
			[EXTERNAL_CLASS_NAMES]: hasUnsafeSelectorChar(arg) ? [] : [arg]
		};
	}
	return args;
};
const keyframesCommon = (strings, values, classNameSlug, onInvalidSlug) => {
	const [label, styleString] = buildStyleString(strings, values);
	const hash = toHash(label + styleString);
	let customSlug;
	if (classNameSlug) {
		const slug = classNameSlug(hash, normalizeLabel(label), styleString);
		if (slug) if (isValidKeyframeName(slug)) customSlug = slug;
		else (onInvalidSlug || defaultOnInvalidSlug)(slug);
	}
	return {
		[SELECTOR]: "",
		[CLASS_NAME]: `@keyframes ${customSlug || hash}`,
		[STYLE_STRING]: styleString,
		[SELECTORS]: [],
		[EXTERNAL_CLASS_NAMES]: []
	};
};
let viewTransitionNameIndex = 0;
const viewTransitionCommon = ((strings, values, classNameSlug, onInvalidSlug) => {
	if (!strings) strings = [`/* h-v-t ${viewTransitionNameIndex++} */`];
	const content = Array.isArray(strings) ? cssCommon(strings, values, classNameSlug, onInvalidSlug) : strings;
	const transitionName = content[CLASS_NAME];
	const res = cssCommon(["view-transition-name:", ""], [transitionName], classNameSlug, onInvalidSlug);
	content[CLASS_NAME] = PSEUDO_GLOBAL_SELECTOR + content[CLASS_NAME];
	content[STYLE_STRING] = content[STYLE_STRING].replace(/(?<=::view-transition(?:[a-z-]*)\()(?=\))/g, transitionName);
	res[CLASS_NAME] = res[SELECTOR] = transitionName;
	res[SELECTORS] = [...content[SELECTORS], content];
	return res;
});
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/dom/css.ts
const splitRule = (rule) => {
	const result = [];
	let startPos = 0;
	let depth = 0;
	for (let i = 0, len = rule.length; i < len; i++) {
		const char = rule[i];
		if (char === "'" || char === "\"") {
			const quote = char;
			i++;
			for (; i < len; i++) {
				if (rule[i] === "\\") {
					i++;
					continue;
				}
				if (rule[i] === quote) break;
			}
			continue;
		}
		if (char === "{") {
			depth++;
			continue;
		}
		if (char === "}") {
			depth--;
			if (depth === 0) {
				result.push(rule.slice(startPos, i + 1));
				startPos = i + 1;
			}
			continue;
		}
	}
	return result;
};
const createCssJsxDomObjects = ({ id }) => {
	let styleSheet = void 0;
	const findStyleSheet = () => {
		if (!styleSheet) {
			styleSheet = document.querySelector(`style#${id}`)?.sheet;
			if (styleSheet) styleSheet.addedStyles = /* @__PURE__ */ new Set();
		}
		return styleSheet ? [styleSheet, styleSheet.addedStyles] : [];
	};
	const insertRule = (className, styleString) => {
		const [sheet, addedStyles] = findStyleSheet();
		if (!sheet || !addedStyles) {
			Promise.resolve().then(() => {
				if (!findStyleSheet()[0]) throw new Error("style sheet not found");
				insertRule(className, styleString);
			});
			return;
		}
		if (!addedStyles.has(className)) {
			addedStyles.add(className);
			(className.startsWith(":-acryl-global") ? splitRule(styleString) : [`${className[0] === "@" ? "" : "."}${className}{${styleString}}`]).forEach((rule) => {
				sheet.insertRule(rule, sheet.cssRules.length);
			});
		}
	};
	const cssObject = { toString() {
		const selector = this[SELECTOR];
		insertRule(selector, this[STYLE_STRING]);
		this[SELECTORS].forEach(({ [CLASS_NAME]: className, [STYLE_STRING]: styleString }) => {
			insertRule(className, styleString);
		});
		return this[CLASS_NAME];
	} };
	const Style = ({ children, nonce }) => ({
		tag: "style",
		props: {
			id,
			nonce,
			children: children && (Array.isArray(children) ? children : [children]).map((c) => c[STYLE_STRING])
		}
	});
	return [cssObject, Style];
};
/**
* @experimental
* `createCssContext` is an experimental feature.
* The API might be changed.
*
* @param options.id - The ID for the style element
* @param options.classNameSlug - Optional function to customize generated CSS class names
* @param options.onInvalidSlug - Optional callback function called when an invalid slug is returned from ClassNameSlug
*/
const createCssContext = ({ id, classNameSlug, onInvalidSlug }) => {
	const [cssObject, Style] = createCssJsxDomObjects({ id });
	const newCssClassNameObject = (cssClassName) => {
		cssClassName.toString = cssObject.toString;
		return cssClassName;
	};
	const css = (strings, ...values) => {
		return newCssClassNameObject(cssCommon(strings, values, classNameSlug, onInvalidSlug));
	};
	const cx = (...args) => {
		args = cxCommon(args);
		return css(Array(args.length).fill(""), ...args);
	};
	const keyframes = (strings, ...values) => keyframesCommon(strings, values, classNameSlug, onInvalidSlug);
	const viewTransition = ((strings, ...values) => {
		return newCssClassNameObject(viewTransitionCommon(strings, values, classNameSlug, onInvalidSlug));
	});
	return {
		css,
		cx,
		keyframes,
		viewTransition,
		Style
	};
};
const defaultContext = createCssContext({ id: DEFAULT_STYLE_ID });
/**
* @experimental
* `css` is an experimental feature.
* The API might be changed.
*/
const css = defaultContext.css;
/**
* @experimental
* `cx` is an experimental feature.
* The API might be changed.
*/
const cx = defaultContext.cx;
/**
* @experimental
* `keyframes` is an experimental feature.
* The API might be changed.
*/
const keyframes = defaultContext.keyframes;
/**
* @experimental
* `viewTransition` is an experimental feature.
* The API might be changed.
*/
const viewTransition = defaultContext.viewTransition;
/**
* @experimental
* `Style` is an experimental feature.
* The API might be changed.
*/
const Style = defaultContext.Style;
//#endregion
export { rawCssString as _, cx as a, CLASS_NAME as c, SELECTOR as d, SELECTORS as f, keyframesCommon as g, cxCommon as h, css as i, DEFAULT_STYLE_ID as l, cssCommon as m, createCssContext as n, keyframes as o, STYLE_STRING as p, createCssJsxDomObjects as r, viewTransition as s, Style as t, PSEUDO_GLOBAL_SELECTOR as u, viewTransitionCommon as v };
