import { C as PropsWithChildren, G as useRef, Q as FallbackRender, Z as ErrorHandler, k as RefObject, t as Context } from "./context-DxFdY_un.js";
import { a as JSX, o as JSXNode, r as FC, s as Props, t as Child } from "./base-BpQy2Rk7.js";

//#region ../../plugins/acryl-router/src/core/jsx/dom/components.d.ts
declare const ErrorBoundary: FC<PropsWithChildren<{
  fallback?: Child;
  fallbackRender?: FallbackRender;
  onError?: ErrorHandler;
}>>;
declare const Suspense: FC<PropsWithChildren<{
  fallback: any;
}>>;
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/dom/context.d.ts
declare const createContext: <T>(defaultValue: T) => Context<T>;
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/dom/render.d.ts
type Container = HTMLElement | DocumentFragment;
declare const render: (jsxNode: Child, container: Container) => void;
declare const flushSync: (callback: () => void) => void;
declare const createPortal: (children: Child, container: HTMLElement, key?: string) => Child;
//#endregion
//#region ../../plugins/acryl-router/src/core/jsx/dom/index.d.ts
declare const createElement: (tag: string | ((props: Props) => JSXNode), props: Props | null, ...children: Child[]) => JSXNode;
declare const cloneElement: <T extends JSXNode | JSX.Element>(element: T, props: Props, ...children: Child[]) => T;
declare const memo: <T>(component: FC<T>, propsAreEqual?: (prevProps: Readonly<T>, nextProps: Readonly<T>) => boolean) => FC<T>;
declare const _default: {
  version: string;
  useState: {
    <T>(initialState: T | (() => T)): [T, (newState: T | ((currentState: T) => T)) => void];
    <T = undefined>(): [T | undefined, (newState: T | ((currentState: T | undefined) => T | undefined) | undefined) => void];
  };
  useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => void;
  useRef: typeof useRef;
  useCallback: <T extends Function>(callback: T, deps: readonly unknown[]) => T;
  use: <T>(promise: Promise<T>) => T;
  startTransition: (callback: () => void) => void;
  useTransition: () => [boolean, (callback: () => void | Promise<void>) => void];
  useDeferredValue: <T>(value: T, initialValue?: T) => T;
  startViewTransition: (callback: () => void) => void;
  useViewTransition: () => [boolean, (callback: () => void) => void];
  useMemo: <T>(factory: () => T, deps: readonly unknown[]) => T;
  useLayoutEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => void;
  useInsertionEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => void;
  useReducer: <T, A>(reducer: (state: T, action: A) => T, initialArg: T, init?: (initialState: T) => T) => [T, (action: A) => void];
  useId: () => string;
  useDebugValue: (_value: unknown, _formatter?: (value: unknown) => string) => void;
  createRef: <T>() => RefObject<T | null>;
  forwardRef: <T, P = {}>(Component: (props: P, ref?: RefObject<T | null>) => JSX.Element) => ((props: P & {
    ref?: RefObject<T | null>;
  }) => JSX.Element);
  useImperativeHandle: <T>(ref: RefObject<T | null>, createHandle: () => T, deps: readonly unknown[]) => void;
  useSyncExternalStore: <T>(subscribe: (callback: () => void) => () => void, getSnapshot: () => T, getServerSnapshot?: () => T) => T;
  useFormStatus: () => {
    pending: false;
    data: null;
    method: null;
    action: null;
  } | {
    pending: true;
    data: FormData;
    method: "get" | "post";
    action: string | ((formData: FormData) => void | Promise<void>);
  };
  useActionState: <T>(fn: Function, initialState: T, permalink?: string) => [T, Function];
  useOptimistic: <T, N>(state: T, updateState: (currentState: T, action: N) => T) => [T, (action: N) => void];
  Suspense: FC<PropsWithChildren<{
    fallback: any;
  }>>;
  ErrorBoundary: FC<PropsWithChildren<{
    fallback?: Child;
    fallbackRender?: FallbackRender;
    onError?: ErrorHandler;
  }>>;
  createContext: <T>(defaultValue: T) => Context<T>;
  useContext: <T>(context: Context<T>) => T;
  memo: <T>(component: FC<T>, propsAreEqual?: (prevProps: Readonly<T>, nextProps: Readonly<T>) => boolean) => FC<T>;
  isValidElement: (element: unknown) => element is JSXNode;
  createElement: (tag: string | ((props: Props) => JSXNode), props: Props | null, ...children: Child[]) => JSXNode;
  cloneElement: <T extends JSXNode | JSX.Element>(element: T, props: Props, ...children: Child[]) => T;
  Children: {
    map: (children: Child[], fn: (child: Child, index: number) => Child) => Child[];
    forEach: (children: Child[], fn: (child: Child, index: number) => void) => void;
    count: (children: Child[]) => number;
    only: (_children: Child[]) => Child;
    toArray: (children: Child) => Child[];
  };
  Fragment: (props: Record<string, unknown>) => JSXNode;
  StrictMode: (props: Record<string, unknown>) => JSXNode;
  flushSync: (callback: () => void) => void;
  createPortal: (children: Child, container: HTMLElement, key?: string) => Child;
};
//#endregion
export { createPortal as a, createContext as c, memo as i, ErrorBoundary as l, cloneElement as n, flushSync as o, createElement as r, render as s, _default as t, Suspense as u };