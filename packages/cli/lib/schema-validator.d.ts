import { I as MiddlewareHandler, Z as ValidationTargets, _ as Env } from "./context-DVQBjuns.js";

//#region ../../plugins/acryl-router/src/helpers/schema-validator.d.ts
/** The slice of the Standard Schema interface this needs; Schemastery (what Cordis uses), Zod and Valibot all implement it. */
interface StandardSchema<T = unknown> {
  readonly '~standard': {
    validate(value: unknown): StandardResult<T> | Promise<StandardResult<T>>;
  };
}
type StandardResult<T> = {
  readonly value: T;
  readonly issues?: undefined;
} | {
  readonly issues: readonly {
    readonly message: string;
    readonly path?: readonly unknown[] | undefined;
  }[];
};
/**
 * The core `validator` driven by a Standard Schema. A failure answers 400 with `{ error, issues }`; success makes the parsed value the
 * handler's `c.req.valid(target)`, typed by the schema.
 */
declare function schemaValidator<Target extends keyof ValidationTargets, Out, E extends Env = Env, P extends string = string>(target: Target, schema: StandardSchema<Out>): MiddlewareHandler<E, P, {
  in: { [K in Target]: Out };
  out: { [K in Target]: Out };
}>;
//#endregion
export { StandardSchema, schemaValidator };