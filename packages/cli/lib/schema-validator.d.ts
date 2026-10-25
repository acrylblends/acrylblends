import { L as MiddlewareHandler, Q as ValidationTargets, v as Env } from "./context-DS3fYyG-.js";

//#region ../../plugins/acryl-router/src/helpers/schema-validator.d.ts
/**
 * The Standard Schema v1 interface (https://standardschema.dev), declared here so the framework needs no dependency for it. Schemastery
 * (what Cordis uses), Zod and Valibot implement it, and a hand-written schema object of the same shape is accepted as well. Only
 * `validate` is called, so `version` and `vendor` may be left out of a hand-written schema.
 */
interface StandardSchema<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaProps<Input, Output>;
}
/** The `~standard` properties of a {@link StandardSchema}. */
interface StandardSchemaProps<Input = unknown, Output = Input> {
  /** The version of the standard; every library sets it. */
  readonly version?: 1 | undefined;
  /** The name of the schema library; every library sets it. */
  readonly vendor?: string | undefined;
  /** Validates an unknown value. */
  readonly validate: (value: unknown, options?: StandardSchemaOptions | undefined) => StandardResult<Output> | Promise<StandardResult<Output>>;
  /** The input and output types, for inference only. */
  readonly types?: {
    readonly input: Input;
    readonly output: Output;
  } | undefined;
}
/** Options a caller may pass to `validate`. */
interface StandardSchemaOptions {
  /** Library-specific parameters. */
  readonly libraryOptions?: Record<string, unknown> | undefined;
}
/** One validation issue: a message and where in the value it applies. */
interface StandardIssue {
  readonly message: string;
  readonly path?: readonly (PropertyKey | {
    readonly key: PropertyKey;
  })[] | undefined;
}
/** What `validate` answers: the parsed value, or the issues. */
type StandardResult<Output> = {
  readonly value: Output;
  readonly issues?: undefined;
} | {
  readonly issues: readonly StandardIssue[];
};
/**
 * The core `validator` driven by a Standard Schema. A failure answers 400 with `{ error, issues }`; success makes the parsed value the
 * handler's `c.req.valid(target)`, typed by the schema's output.
 */
declare function schemaValidator<Target extends keyof ValidationTargets, Out, E extends Env = Env, P extends string = string>(target: Target, schema: StandardSchema<unknown, Out>): MiddlewareHandler<E, P, {
  in: { [K in Target]: Out };
  out: { [K in Target]: Out };
}>;
//#endregion
export { StandardIssue, StandardResult, StandardSchema, StandardSchemaOptions, StandardSchemaProps, schemaValidator };