import { n as ContentfulStatusCode, s as ServerErrorStatusCode, t as ClientErrorStatusCode } from "./http-status-DaAwGAFL.js";
import { T as UnionToIntersection } from "./types-CwrQjlaM.js";
import { t as Acryl } from "./app-CmAYW1Al.js";
import { a as ClientResponse, i as ClientRequestOptions, n as Client, s as FilterClientResponseByStatusCode } from "./types-CHesD1KG.js";

//#region ../../plugins/acryl-router/src/core/client/client.d.ts
declare const hc: <T extends Acryl<any, any, any>, Prefix extends string = string>(baseUrl: Prefix, options?: ClientRequestOptions) => UnionToIntersection<Client<T, Prefix>>;
//#endregion
//#region ../../plugins/acryl-router/src/core/client/fetch-result-please.d.ts
declare class DetailedError extends Error {
  /**
   * Additional `message` that will be logged AND returned to client
   */
  detail?: any;
  /**
   * Additional `code` that will be logged AND returned to client
   */
  code?: any;
  /**
   * Additional value that will be logged AND NOT returned to client
   */
  log?: any;
  /**
   * Optionally set the status code to return, in a web server context
   */
  statusCode?: any;
  constructor(message: string, options?: {
    detail?: any;
    code?: any;
    statusCode?: number;
    log?: any;
  });
}
//#endregion
//#region ../../plugins/acryl-router/src/core/client/utils.d.ts
/**
 * Shortcut to get a consumable response from `hc`'s fetch calls (Response), with types inference.
 *
 * Smartly parse the response data, throwing a structured error if the response is not `ok`. ({@link DetailedError})
 *
 * @example const result = await parseResponse(client.posts.$get())
 */
declare function parseResponse<T extends ClientResponse<any>>(fetchRes: T | Promise<T>): Promise<FilterClientResponseByStatusCode<T, Exclude<ContentfulStatusCode, ClientErrorStatusCode | ServerErrorStatusCode>> extends never ? undefined : FilterClientResponseByStatusCode<T, Exclude<ContentfulStatusCode, ClientErrorStatusCode | ServerErrorStatusCode>> extends ClientResponse<infer RT, infer _, infer RF> ? RF extends 'json' ? RT : RT extends string ? RT : string : undefined>;
//#endregion
export { DetailedError as n, hc as r, parseResponse as t };