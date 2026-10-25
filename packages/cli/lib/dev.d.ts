import { v as Env } from "./context-DS3fYyG-.js";
import { t as Acryl } from "./app-D8riatvv.js";

//#region ../../plugins/acryl-router/src/core/helper/dev/index.d.ts
interface ShowRoutesOptions {
  verbose?: boolean;
  colorize?: boolean;
}
interface RouteData {
  path: string;
  method: string;
  name: string;
  isMiddleware: boolean;
}
declare const inspectRoutes: <E extends Env>(acryl: Acryl<E>) => RouteData[];
declare const showRoutes: <E extends Env>(acryl: Acryl<E>, opts?: ShowRoutesOptions) => void;
declare const getRouterName: <E extends Env>(app: Acryl<E>) => string;
//#endregion
export { getRouterName, inspectRoutes, showRoutes };