import { a as DomEvent } from "./types-Lqx5BxQF.js";
import { i as HtmlEscapedString } from "./html-SllAe0YT.js";
import { a as JSX, o as JSXNode, p as JSX$1, r as FC, s as Props, t as Child } from "./base-BpQy2Rk7.js";

//#region ../../plugins/acryl-router/src/core/jsx/components.d.ts
type ErrorHandler = (error: Error) => void;
type FallbackRender = (error: Error) => Child;
/**
 * @experimental
 * `ErrorBoundary` is an experimental feature.
 * The API might be changed.
 */
declare const ErrorBoundary: FC<PropsWithChildren<{
  fallback?: Child;
  fallbackRender?: FallbackRender;
  onError?: ErrorHandler;
}>>;
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/hooks/index.d.ts
type UpdateStateFunction<T> = (newState: T | ((currentState: T) => T)) => void;
declare const startViewTransition: (callback: () => void) => void;
declare const useViewTransition: () => [boolean, (callback: () => void) => void];
declare const startTransition: (callback: () => void) => void;
declare const useTransition: () => [boolean, (callback: () => void | Promise<void>) => void];
type UseDeferredValue = <T>(value: T, initialValue?: T) => T;
declare const useDeferredValue: UseDeferredValue;
type UseStateType = {
  <T>(initialState: T | (() => T)): [T, UpdateStateFunction<T>];
  <T = undefined>(): [T | undefined, UpdateStateFunction<T | undefined>];
};
declare const useState: UseStateType;
declare const useReducer: <T, A>(reducer: (state: T, action: A) => T, initialArg: T, init?: (initialState: T) => T) => [T, (action: A) => void];
declare const useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => void;
declare const useLayoutEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => void;
declare const useInsertionEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => void;
declare const useCallback: <T extends Function>(callback: T, deps: readonly unknown[]) => T;
type RefObject<T> = {
  current: T;
};
declare function useRef<T>(initialValue: T): RefObject<T>;
declare function useRef<T>(initialValue: T | null): RefObject<T | null>;
declare function useRef<T>(initialValue: T | undefined): RefObject<T | undefined>;
declare const use: <T>(promise: Promise<T>) => T;
declare const useMemo: <T>(factory: () => T, deps: readonly unknown[]) => T;
declare const useId: () => string;
declare const useDebugValue: (_value: unknown, _formatter?: (value: unknown) => string) => void;
declare const createRef: <T>() => RefObject<T | null>;
declare const forwardRef: <T, P = {}>(Component: (props: P, ref?: RefObject<T | null>) => JSX.Element) => ((props: P & {
  ref?: RefObject<T | null>;
}) => JSX.Element);
declare const useImperativeHandle: <T>(ref: RefObject<T | null>, createHandle: () => T, deps: readonly unknown[]) => void;
declare const useSyncExternalStore: <T>(subscribe: (callback: () => void) => () => void, getSnapshot: () => T, getServerSnapshot?: () => T) => T;
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/types.d.ts
type PropsWithChildren<P = unknown> = P & {
  children?: Child | undefined;
};
type CSSProperties = JSX$1.CSSProperties;
/**
 * React types
 */
type ReactElement<P = any, T = string | Function> = JSXNode & {
  type: T;
  props: P;
  key: string | null;
};
type ReactNode = ReactElement | string | number | boolean | null | undefined;
type ComponentClass<_P = {}, _S = {}> = unknown;
type Event = globalThis.Event;
type MouseEvent = DomEvent<'MouseEvent'>;
type KeyboardEvent = DomEvent<'KeyboardEvent'>;
type FocusEvent = DomEvent<'FocusEvent'>;
type ClipboardEvent = DomEvent<'ClipboardEvent'>;
type InputEvent = DomEvent<'InputEvent'>;
type PointerEvent = DomEvent<'PointerEvent'>;
type TouchEvent = DomEvent<'TouchEvent'>;
type WheelEvent = DomEvent<'WheelEvent'>;
type AnimationEvent = DomEvent<'AnimationEvent'>;
type TransitionEvent = DomEvent<'TransitionEvent'>;
type DragEvent = DomEvent<'DragEvent'>;
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/children.d.ts
declare const Children: {
  map: (children: Child[], fn: (child: Child, index: number) => Child) => Child[];
  forEach: (children: Child[], fn: (child: Child, index: number) => void) => void;
  count: (children: Child[]) => number;
  only: (_children: Child[]) => Child;
  toArray: (children: Child) => Child[];
};
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/dom/hooks/index.d.ts
type FormStatus = {
  pending: false;
  data: null;
  method: null;
  action: null;
} | {
  pending: true;
  data: FormData;
  method: 'get' | 'post';
  action: string | ((formData: FormData) => void | Promise<void>);
};
/**
 * This hook returns the current form status
 * @returns FormStatus
 */
declare const useFormStatus: () => FormStatus;
/**
 * This hook returns the current state and a function to update the state optimistically
 * The current state is updated optimistically and then reverted to the original state when all actions are resolved
 * @param state
 * @param updateState
 * @returns [T, (action: N) => void]
 */
declare const useOptimistic: <T, N>(state: T, updateState: (currentState: T, action: N) => T) => [T, (action: N) => void];
/**
 * This hook returns the current state and a function to update the state by form action
 * @param fn
 * @param initialState
 * @param permalink
 * @returns [T, (data: FormData) => void]
 */
declare const useActionState: <T>(fn: Function, initialState: T, permalink?: string) => [T, Function];
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/streaming.d.ts
/**
 * Used to specify nonce for scripts generated by `Suspense` and `ErrorBoundary`.
 *
 * @example
 * ```tsx
 * <StreamingContext.Provider value={{ scriptNonce: 'test-nonce' }}>
 *   <Suspense fallback={<p>Loading...</p>}>
 *     <Content />
 *   </Suspense>
 * </StreamingContext.Provider>
 * ```
 */
declare const StreamingContext: Context<{
  scriptNonce: string;
} | null>;
/**
 * @experimental
 * `Suspense` is an experimental feature.
 * The API might be changed.
 */
declare const Suspense: FC<PropsWithChildren<{
  fallback: any;
}>>;
/**
 * @experimental
 * `renderToReadableStream()` is an experimental feature.
 * The API might be changed.
 */
declare const renderToReadableStream: (content: HtmlEscapedString | JSXNode | Promise<HtmlEscapedString>, onError?: (e: unknown) => string | void) => ReadableStream<Uint8Array>;
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/index.d.ts
declare const _default: {
  version: string;
  memo: <T>(component: FC<T>, propsAreEqual?: (prevProps: Readonly<T>, nextProps: Readonly<T>) => boolean) => FC<T>;
  Fragment: ({
    children
  }: {
    key?: string;
    children?: Child | HtmlEscapedString;
  }) => HtmlEscapedString;
  StrictMode: ({
    children
  }: {
    key?: string;
    children?: Child | HtmlEscapedString;
  }) => HtmlEscapedString;
  isValidElement: (element: unknown) => element is JSXNode;
  createElement: (tag: string | Function, props: Props | null, ...children: Child[]) => JSXNode;
  cloneElement: <T extends JSXNode | JSX.Element>(element: T, props: Partial<Props>, ...children: Child[]) => T;
  ErrorBoundary: FC<PropsWithChildren<{
    fallback?: Child;
    fallbackRender?: FallbackRender;
    onError?: ErrorHandler;
  }>>;
  createContext: <T>(defaultValue: T) => Context<T>;
  useContext: <T>(context: Context<T>) => T;
  useState: {
    <T>(initialState: T | (() => T)): [T, (newState: T | ((currentState: T) => T)) => void];
    <T = undefined>(): [T | undefined, (newState: T | ((currentState: T | undefined) => T | undefined) | undefined) => void];
  };
  useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => void;
  useRef: typeof useRef;
  useCallback: <T extends Function>(callback: T, deps: readonly unknown[]) => T;
  useReducer: <T, A>(reducer: (state: T, action: A) => T, initialArg: T, init?: (initialState: T) => T) => [T, (action: A) => void];
  useId: () => string;
  useDebugValue: (_value: unknown, _formatter?: (value: unknown) => string) => void;
  use: <T>(promise: Promise<T>) => T;
  startTransition: (callback: () => void) => void;
  useTransition: () => [boolean, (callback: () => void | Promise<void>) => void];
  useDeferredValue: <T>(value: T, initialValue?: T) => T;
  startViewTransition: (callback: () => void) => void;
  useViewTransition: () => [boolean, (callback: () => void) => void];
  useMemo: <T>(factory: () => T, deps: readonly unknown[]) => T;
  useLayoutEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => void;
  useInsertionEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => void;
  createRef: <T>() => RefObject<T | null>;
  forwardRef: <T, P = {}>(Component: (props: P, ref?: RefObject<T | null>) => JSX.Element) => ((props: P & {
    ref?: RefObject<T | null>;
  }) => JSX.Element);
  useImperativeHandle: <T>(ref: RefObject<T | null>, createHandle: () => T, deps: readonly unknown[]) => void;
  useSyncExternalStore: <T>(subscribe: (callback: () => void) => () => void, getSnapshot: () => T, getServerSnapshot?: () => T) => T;
  useActionState: <T>(fn: Function, initialState: T, permalink?: string) => [T, Function];
  useOptimistic: <T, N>(state: T, updateState: (currentState: T, action: N) => T) => [T, (action: N) => void];
  Suspense: FC<PropsWithChildren<{
    fallback: any;
  }>>;
  Children: {
    map: (children: Child[], fn: (child: Child, index: number) => Child) => Child[];
    forEach: (children: Child[], fn: (child: Child, index: number) => void) => void;
    count: (children: Child[]) => number;
    only: (_children: Child[]) => Child;
    toArray: (children: Child) => Child[];
  };
};
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/context.d.ts
interface Context<T> extends FC<PropsWithChildren<{
  value: T;
}>> {
  values: T[];
  Provider: FC<PropsWithChildren<{
    value: T;
  }>>;
}
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
declare const createContext: <T>(defaultValue: T) => Context<T>;
/**
 * Read the current value of a context created with {@link createContext}.
 *
 * Safe to call from async components after `await`. See {@link createContext}
 * for the per-runtime isolation guarantees.
 */
declare const useContext: <T>(context: Context<T>) => T;
//#endregion
export { createRef as A, useImperativeHandle as B, PropsWithChildren as C, TransitionEvent as D, TouchEvent as E, useCallback as F, useRef as G, useLayoutEffect as H, useDebugValue as I, useTransition as J, useState as K, useDeferredValue as L, startTransition as M, startViewTransition as N, WheelEvent as O, use as P, FallbackRender as Q, useEffect as R, PointerEvent as S, ReactNode as T, useMemo as U, useInsertionEffect as V, useReducer as W, ErrorBoundary as X, useViewTransition as Y, ErrorHandler as Z, Event as _, StreamingContext as a, KeyboardEvent as b, useActionState as c, Children as d, AnimationEvent as f, DragEvent as g, ComponentClass as h, _default as i, forwardRef as j, RefObject as k, useFormStatus as l, ClipboardEvent as m, createContext as n, Suspense as o, CSSProperties as p, useSyncExternalStore as q, useContext as r, renderToReadableStream as s, Context as t, useOptimistic as u, FocusEvent as v, ReactElement as w, MouseEvent as x, InputEvent as y, useId as z };