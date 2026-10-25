import { D as createContext, E as useContext, O as __exportAll, S as shouldDeDupeByKey, b as domRenderers, v as dataPrecedenceAttr, x as isStylesheetLinkWithPrecedence, y as deDupeKeyMap } from "./base-ddiVmiE7.js";
import { o as PERMALINK } from "./constants-BR9jM9BC.js";
import { C as createPortal, T as getNameSpaceContext, _ as useState, a as use, m as useMemo, o as useCallback } from "./hooks-Bq5q9IMl.js";
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
export { useOptimistic as a, useFormStatus as i, jsxDEV as n, useActionState as r, Fragment as t };
