import { c as Result, l as Router } from "../router-CvUxUTOq.js";

//#region ../../plugins/acryl-router/src/core/router/smart-router/router.d.ts
declare class SmartRouter<T> implements Router<T> {
  #private;
  name: string;
  constructor(init: {
    routers: Router<T>[];
  });
  add(method: string, path: string, handler: T): void;
  match(method: string, path: string): Result<T>;
  get activeRouter(): Router<T>;
}
//#endregion
export { SmartRouter };