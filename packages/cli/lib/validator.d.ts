import { I as MiddlewareHandler, W as ParsedFormValue, X as TypedResponse, Z as ValidationTargets, _ as Env, t as Context, w as FormValue } from "./context-Bm7rI-oK.js";
import { T as UnionToIntersection } from "./types-CwrQjlaM.js";

//#region ../../plugins/acryl-router/src/core/validator/utils.d.ts
/**
 * Checks if T is a literal union type (e.g., 'asc' | 'desc')
 * that should be preserved in input types.
 * Returns true for union literals, false for single literals or wide types.
 */
type IsLiteralUnion<T, Base> = [Exclude<T, undefined>] extends [Base] ? [Exclude<T, undefined>] extends [UnionToIntersection<Exclude<T, undefined>>] ? false : true : false;
type IsOptionalUnion<T> = [unknown] extends [T] ? false : undefined extends T ? true : false;
type SimplifyDeep<T> = { [K in keyof T]: T[K] } & {};
type InferInputInner<Output, Target extends keyof ValidationTargets, T extends FormValue> = SimplifyDeep<{ [K in keyof Output]: IsLiteralUnion<Output[K], string> extends true ? Output[K] : IsOptionalUnion<Output[K]> extends true ? Output[K] : Target extends 'form' ? T | T[] : Target extends 'query' ? string | string[] : Target extends 'param' ? string : Target extends 'header' ? string : Target extends 'cookie' ? string : unknown }>;
/**
 * Utility type to infer input types for validation targets.
 * Preserves literal union types (e.g., 'asc' | 'desc') while using
 * the default ValidationTargets type for other values.
 *
 * @example
 * ```ts
 * // In @acryl-router/zod-validator or similar:
 * type Input = InferInput<z.input<Schema>, 'query'>
 * // { orderBy: 'asc' | 'desc', page: string | string[] }
 * ```
 */
type InferInput<Output, Target extends keyof ValidationTargets, T extends FormValue = ParsedFormValue> = [Exclude<Output, undefined>] extends [never] ? {} : [Exclude<Output, undefined>] extends [object] ? undefined extends Output ? SimplifyDeep<InferInputInner<Exclude<Output, undefined>, Target, T>> | undefined : SimplifyDeep<InferInputInner<Output, Target, T>> : {};
//#endregion
//#region ../../plugins/acryl-router/src/core/validator/validator.d.ts
type ValidationTargetKeysWithBody = 'form' | 'json';
type ValidationTargetByMethod<M> = M extends 'get' | 'head' ? Exclude<keyof ValidationTargets, ValidationTargetKeysWithBody> : keyof ValidationTargets;
type ValidationFunction<InputType, OutputType, E extends Env = {}, P extends string = string> = (value: InputType, c: Context<E, P>) => OutputType | TypedResponse | Promise<OutputType> | Promise<TypedResponse>;
type ExtractValidationResponse<VF> = VF extends ((value: any, c: any) => infer R) ? R extends Promise<infer PR> ? PR extends TypedResponse<infer T, infer S, infer F> ? TypedResponse<T, S, F> : PR extends Response ? PR : PR extends undefined ? never : never : R extends TypedResponse<infer T, infer S, infer F> ? TypedResponse<T, S, F> : R extends Response ? R : R extends undefined ? never : never : never;
declare const validator: <InputType, P extends string, M extends string, U extends ValidationTargetByMethod<M>, P2 extends string = P, VF extends (value: unknown extends InputType ? ValidationTargets[U] : InputType, c: Context<any, P2>) => any = (value: unknown extends InputType ? ValidationTargets[U] : InputType, c: Context<any, P2>) => any, V extends {
  in: { [K in U]: K extends "json" ? unknown extends InputType ? ExtractValidatorOutput<VF> : InputType : InferInput<ExtractValidatorOutput<VF>, K, FormValue> };
  out: { [K in U]: ExtractValidatorOutput<VF> };
} = {
  in: { [K in U]: K extends "json" ? unknown extends InputType ? ExtractValidatorOutput<VF> : InputType : InferInput<ExtractValidatorOutput<VF>, K, FormValue> };
  out: { [K in U]: ExtractValidatorOutput<VF> };
}, E extends Env = any>(target: U, validationFunc: VF) => MiddlewareHandler<E, P, V, ExtractValidationResponse<VF>>;
type ExtractValidatorOutput<VF> = VF extends ((value: any, c: any) => infer R) ? R extends Promise<infer PR> ? PR extends Response | TypedResponse<any, any, any> ? never : PR : R extends Response | TypedResponse<any, any, any> ? never : R : never;
//#endregion
export { type InferInput, type ValidationFunction, validator };