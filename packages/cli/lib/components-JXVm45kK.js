import { t as DOM_ERROR_HANDLER } from "./constants-BR9jM9BC.js";
import { t as Fragment } from "./jsx-dev-runtime-CWLRA2F3.js";
import "./jsx/dom/jsx-runtime.js";
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
export { Suspense as n, ErrorBoundary as t };
