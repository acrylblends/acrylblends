import { c as Result, l as Router } from "../router-CvUxUTOq.js";

//#region ../../plugins/acryl-router/src/core/router/pattern-router/router.d.ts
declare class PatternRouter<T> implements Router<T> {
  #private;
  name: string;
  add(method: string, path: string, handler: T): void;
  match(method: string, path: string): Result<T>;
}
//#endregion
export { PatternRouter };