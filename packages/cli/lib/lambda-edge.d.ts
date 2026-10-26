import { r as GetConnInfo } from "./types-Dv_nV2cv.js";
import { t as Acryl } from "./app-D8riatvv.js";

//#region ../../plugins/acryl-router/src/core/adapter/lambda-edge/handler.d.ts
interface CloudFrontHeader {
  key: string;
  value: string;
}
interface CloudFrontHeaders {
  [name: string]: CloudFrontHeader[];
}
interface CloudFrontCustomOrigin {
  customHeaders: CloudFrontHeaders;
  domainName: string;
  keepaliveTimeout: number;
  path: string;
  port: number;
  protocol: string;
  readTimeout: number;
  sslProtocols: string[];
}
interface CloudFrontS3Origin {
  authMethod: 'origin-access-identity' | 'none';
  customHeaders: CloudFrontHeaders;
  domainName: string;
  path: string;
  region: string;
}
type CloudFrontOrigin = {
  s3: CloudFrontS3Origin;
  custom?: never;
} | {
  custom: CloudFrontCustomOrigin;
  s3?: never;
};
interface CloudFrontRequest {
  clientIp: string;
  headers: CloudFrontHeaders;
  method: string;
  querystring: string;
  uri: string;
  body?: {
    inputTruncated: boolean;
    action: string;
    encoding: string;
    data: string;
  };
  origin?: CloudFrontOrigin;
}
interface CloudFrontResponse {
  headers: CloudFrontHeaders;
  status: string;
  statusDescription?: string;
}
interface CloudFrontConfig {
  distributionDomainName: string;
  distributionId: string;
  eventType: string;
  requestId: string;
}
interface CloudFrontEvent {
  cf: {
    config: CloudFrontConfig;
    request: CloudFrontRequest;
    response?: CloudFrontResponse;
  };
}
interface CloudFrontEdgeEvent {
  Records: CloudFrontEvent[];
}
type CloudFrontContext = {};
interface Callback {
  (err: Error | null, result?: CloudFrontRequest | CloudFrontResult): void;
}
interface CloudFrontResult {
  status: string;
  statusDescription?: string;
  headers?: {
    [header: string]: {
      key: string;
      value: string;
    }[];
  };
  body?: string;
  bodyEncoding?: 'text' | 'base64';
}
declare const handle: (app: Acryl<any>) => ((event: CloudFrontEdgeEvent, context?: CloudFrontContext, callback?: Callback) => Promise<CloudFrontResult | CloudFrontRequest>);
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/lambda-edge/conninfo.d.ts
declare const getConnInfo: GetConnInfo;
//#endregion
export { type Callback, type CloudFrontConfig, type CloudFrontEdgeEvent, type CloudFrontRequest, type CloudFrontResponse, getConnInfo, handle };