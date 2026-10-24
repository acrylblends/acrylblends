import { t as validator } from "./validator-D84mq-dO.js";
//#region ../../plugins/acryl-router/src/helpers/schema-validator.ts
const pathOf = (path) => (path ?? []).map((part) => String(typeof part === "object" && part !== null && "key" in part ? part.key : part)).join(".");
/**
* The core `validator` driven by a Standard Schema. A failure answers 400 with `{ error, issues }`; success makes the parsed value the
* handler's `c.req.valid(target)`, typed by the schema.
*/
function schemaValidator(target, schema) {
	return validator(target, async (value, c) => {
		const result = await schema["~standard"].validate(value);
		if (result.issues !== void 0) return c.json({
			error: `invalid ${target}`,
			issues: result.issues.map((issue) => ({
				message: issue.message,
				path: pathOf(issue.path)
			}))
		}, 400);
		return result.value;
	});
}
//#endregion
export { schemaValidator };
