import { D as createContext, E as useContext, a as isValidElement, f as shallowEqual, g as Children, l as reactAPICompatVersion } from "../base-NSN_SNv-.js";
import { r as DOM_MEMO } from "../constants-BR9jM9BC.js";
import { C as createPortal, E as render, _ as useState, a as use, b as useViewTransition, c as useDeferredValue, d as useImperativeHandle, f as useInsertionEffect, g as useRef, h as useReducer, i as startViewTransition, l as useEffect, m as useMemo, n as forwardRef, o as useCallback, p as useLayoutEffect, r as startTransition, s as useDebugValue, t as createRef, u as useId, v as useSyncExternalStore, w as flushSync, y as useTransition } from "../hooks-w72iLeFR.js";
import { a as useOptimistic, i as useFormStatus, n as jsxDEV, r as useActionState, t as Fragment } from "../jsx-dev-runtime-CWLRA2F3.js";
import "./dom/jsx-runtime.js";
import { n as Suspense, t as ErrorBoundary } from "../components-JXVm45kK.js";
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
var dom_default = {
	version: reactAPICompatVersion,
	useState,
	useEffect,
	useRef,
	useCallback,
	use,
	startTransition,
	useTransition,
	useDeferredValue,
	startViewTransition,
	useViewTransition,
	useMemo,
	useLayoutEffect,
	useInsertionEffect,
	useReducer,
	useId,
	useDebugValue,
	createRef,
	forwardRef,
	useImperativeHandle,
	useSyncExternalStore,
	useFormStatus,
	useActionState,
	useOptimistic,
	Suspense,
	ErrorBoundary,
	createContext,
	useContext,
	memo,
	isValidElement,
	createElement,
	cloneElement,
	Children,
	Fragment,
	StrictMode: Fragment,
	flushSync,
	createPortal
};
//#endregion
export { Children, ErrorBoundary, Fragment, Fragment as StrictMode, Suspense, cloneElement, createContext, createElement, createElement as jsx, createPortal, createRef, dom_default as default, flushSync, forwardRef, isValidElement, memo, render, startTransition, startViewTransition, use, useActionState, useCallback, useContext, useDebugValue, useDeferredValue, useEffect, useFormStatus, useId, useImperativeHandle, useInsertionEffect, useLayoutEffect, useMemo, useOptimistic, useReducer, useRef, useState, useSyncExternalStore, useTransition, useViewTransition, reactAPICompatVersion as version };
