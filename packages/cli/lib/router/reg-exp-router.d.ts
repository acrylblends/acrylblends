import { a as ParamIndexMap, c as Result, l as Router } from "../router-CvUxUTOq.js";

//#region ../../plugins/acryl-router/src/core/router/reg-exp-router/matcher.d.ts
type HandlerData<T> = [T, ParamIndexMap][];
type StaticMap<T> = Record<string, Result<T>>;
type Matcher<T> = [RegExp, HandlerData<T>[], StaticMap<T>];
type MatcherMap<T> = Record<string, Matcher<T> | null>;
declare function match<R extends Router<T>, T>(this: R, method: string, path: string): Result<T>;
//#endregion
//#region ../../plugins/acryl-router/src/core/router/reg-exp-router/router.d.ts
declare class RegExpRouter<T> implements Router<T> {
  #private;
  name: string;
  constructor();
  add(method: string, path: string, handler: T): void;
  match: typeof match<Router<T>, T>;
  protected buildAllMatchers(): MatcherMap<T>;
}
//#endregion
//#region ../../plugins/acryl-router/src/core/router/reg-exp-router/prepared-router.d.ts
type RelocateMap = Record<string, ([(number | string)[], ParamIndexMap] | [(number | string)[]])[]>;
declare class PreparedRegExpRouter<T> implements Router<T> {
  #private;
  name: string;
  constructor(matchers: MatcherMap<T>, relocateMap: RelocateMap);
  add(method: string, path: string, handler: T): void;
  protected buildAllMatchers(): MatcherMap<T>;
  match: typeof match<Router<T>, T>;
}
declare const buildInitParams: (params: {
  paths: string[];
}) => ConstructorParameters<typeof PreparedRegExpRouter>;
declare const serializeInitParams: (params: ConstructorParameters<typeof PreparedRegExpRouter>) => string;
//#endregion
export { PreparedRegExpRouter, RegExpRouter, buildInitParams, serializeInitParams };