import { Y as Schema, v as Env } from "./context-DS3fYyG-.js";
import { r as GetConnInfo } from "./types-Dv_nV2cv.js";
import { t as Acryl } from "./app-D8riatvv.js";

//#region ../../plugins/acryl-router/src/core/adapter/aws-lambda/types.d.ts
interface CognitoIdentity {
  cognitoIdentityId: string;
  cognitoIdentityPoolId: string;
}
interface ClientContext {
  client: ClientContextClient;
  Custom?: any;
  env: ClientContextEnv;
}
interface ClientContextClient {
  installationId: string;
  appTitle: string;
  appVersionName: string;
  appVersionCode: string;
  appPackageName: string;
}
interface ClientContextEnv {
  platformVersion: string;
  platform: string;
  make: string;
  model: string;
  locale: string;
}
/**
 * {@link Handler} context parameter.
 * See {@link https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html AWS documentation}.
 */
interface LambdaContext {
  callbackWaitsForEmptyEventLoop: boolean;
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  memoryLimitInMB: string;
  awsRequestId: string;
  logGroupName: string;
  logStreamName: string;
  identity?: CognitoIdentity | undefined;
  clientContext?: ClientContext | undefined;
  getRemainingTimeInMillis(): number;
}
type Callback<TResult = any> = (error?: Error | string | null, result?: TResult) => void;
type Handler<TEvent = any, TResult = any> = (event: TEvent, context: LambdaContext, callback: Callback<TResult>) => void | Promise<TResult>;
interface ClientCert {
  clientCertPem: string;
  subjectDN: string;
  issuerDN: string;
  serialNumber: string;
  validity: {
    notBefore: string;
    notAfter: string;
  };
}
interface Identity {
  accessKey?: string;
  accountId?: string;
  caller?: string;
  cognitoAuthenticationProvider?: string;
  cognitoAuthenticationType?: string;
  cognitoIdentityId?: string;
  cognitoIdentityPoolId?: string;
  principalOrgId?: string;
  sourceIp: string;
  user?: string;
  userAgent: string;
  userArn?: string;
  clientCert?: ClientCert;
}
interface ApiGatewayRequestContext {
  accountId: string;
  apiId: string;
  authorizer: {
    claims?: unknown;
    scopes?: unknown;
  };
  domainName: string;
  domainPrefix: string;
  extendedRequestId: string;
  httpMethod: string;
  identity: Identity;
  path: string;
  protocol: string;
  requestId: string;
  requestTime: string;
  requestTimeEpoch: number;
  resourceId?: string;
  resourcePath: string;
  stage: string;
}
interface Authorizer {
  iam?: {
    accessKey: string;
    accountId: string;
    callerId: string;
    cognitoIdentity: null;
    principalOrgId: null;
    userArn: string;
    userId: string;
  };
  jwt?: {
    claims: Record<string, string | number | boolean | string[]>;
    scopes: string[] | null;
  };
  /**
   * The `context` object returned by a Lambda (REQUEST) authorizer.
   * It is `null` when the authorizer returns no context.
   */
  lambda?: Record<string, unknown> | null;
}
interface ApiGatewayRequestContextV2 {
  accountId: string;
  apiId: string;
  authentication: null;
  authorizer: Authorizer;
  domainName: string;
  domainPrefix: string;
  http: {
    method: string;
    path: string;
    protocol: string;
    sourceIp: string;
    userAgent: string;
  };
  requestId: string;
  routeKey: string;
  stage: string;
  time: string;
  timeEpoch: number;
}
interface ALBRequestContext {
  elb: {
    targetGroupArn: string;
  };
}
interface LatticeRequestContextV2 {
  serviceNetworkArn: string;
  serviceArn: string;
  targetGroupArn: string;
  region: string;
  timeEpoch: string;
  identity: {
    sourceVpcArn?: string;
    type?: string;
    principal?: string;
    principalOrgID?: string;
    sessionName?: string;
    x509IssuerOu?: string;
    x509SanDns?: string;
    x509SanNameCn?: string;
    x509SanUri?: string;
    x509SubjectCn?: string;
  };
}
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/aws-lambda/handler.d.ts
type LambdaEvent = APIGatewayProxyEvent | APIGatewayProxyEventV2 | ALBProxyEvent | LatticeProxyEventV2;
interface LatticeProxyEventV2 {
  version: string;
  path: string;
  method: string;
  headers: Record<string, string[] | undefined>;
  queryStringParameters: Record<string, string[] | undefined>;
  body: string | null;
  isBase64Encoded: boolean;
  requestContext: LatticeRequestContextV2;
}
interface APIGatewayProxyEventV2 {
  version: string;
  routeKey: string;
  headers: Record<string, string | undefined>;
  multiValueHeaders?: undefined;
  cookies?: string[];
  rawPath: string;
  rawQueryString: string;
  body: string | null;
  isBase64Encoded: boolean;
  requestContext: ApiGatewayRequestContextV2;
  queryStringParameters?: {
    [name: string]: string | undefined;
  };
  pathParameters?: {
    [name: string]: string | undefined;
  };
  stageVariables?: {
    [name: string]: string | undefined;
  };
}
interface APIGatewayProxyEvent {
  version: string;
  httpMethod: string;
  headers: Record<string, string | undefined>;
  multiValueHeaders?: {
    [headerKey: string]: string[];
  };
  path: string;
  body: string | null;
  isBase64Encoded: boolean;
  queryStringParameters?: Record<string, string | undefined>;
  requestContext: ApiGatewayRequestContext;
  resource: string;
  multiValueQueryStringParameters?: {
    [parameterKey: string]: string[];
  };
  pathParameters?: Record<string, string>;
  stageVariables?: Record<string, string>;
}
interface ALBProxyEvent {
  httpMethod: string;
  headers?: Record<string, string | undefined>;
  multiValueHeaders?: Record<string, string[] | undefined>;
  path: string;
  body: string | null;
  isBase64Encoded: boolean;
  queryStringParameters?: Record<string, string | undefined>;
  multiValueQueryStringParameters?: {
    [parameterKey: string]: string[];
  };
  requestContext: ALBRequestContext;
}
type WithHeaders = {
  headers: Record<string, string | string[]>;
  multiValueHeaders?: undefined;
};
type WithMultiValueHeaders = {
  headers?: undefined;
  multiValueHeaders: Record<string, string[]>;
};
type APIGatewayProxyResult = {
  statusCode: number;
  statusDescription?: string;
  body: string;
  cookies?: string[];
  isBase64Encoded: boolean;
} & (WithHeaders | WithMultiValueHeaders);
declare const streamHandle: <E extends Env = Env, S extends Schema = {}, BasePath extends string = "/">(app: Acryl<E, S, BasePath>) => Handler;
type HandleOptions = {
  isContentTypeBinary: ((contentType: string) => boolean) | undefined;
};
/**
 * Converts a Acryl application to an AWS Lambda handler.
 *
 * Accepts events from API Gateway (v1 and v2), Application Load Balancer (ALB),
 * and Lambda Function URLs.
 *
 * @param app - The Acryl application instance
 * @param options - Optional configuration
 * @param options.isContentTypeBinary - A function to determine if the content type is binary.
 *                                      If not provided, the default function will be used.
 * @returns Lambda handler function
 *
 * @example
 * ```js
 * import { Acryl } from 'acrylblends'
 * import { handle } from 'acrylblends/aws-lambda'
 *
 * const app = new Acryl()
 *
 * app.get('/', (c) => c.text('Hello from Lambda'))
 * app.get('/json', (c) => c.json({ message: 'Hello JSON' }))
 *
 * export const handler = handle(app)
 * ```
 *
 * @example
 * ```js
 * // With custom binary content type detection
 * import { handle, defaultIsContentTypeBinary } from 'acrylblends/aws-lambda'
 * export const handler = handle(app, {
 *   isContentTypeBinary: (contentType) => {
 *     if (defaultIsContentTypeBinary(contentType)) {
 *       // default logic same as prior to v4.8.4
 *       return true
 *     }
 *     return contentType.startsWith('image/') || contentType === 'application/pdf'
 *   }
 * })
 * ```
 */
declare const handle: <E extends Env = Env, S extends Schema = {}, BasePath extends string = "/">(app: Acryl<E, S, BasePath>, {
  isContentTypeBinary
}?: HandleOptions) => (<L extends LambdaEvent>(event: L, lambdaContext?: LambdaContext) => Promise<APIGatewayProxyResult & (L extends {
  multiValueHeaders: Record<string, string[]>;
} ? WithMultiValueHeaders : WithHeaders)>);
/**
 * Check if the given content type is binary.
 * This is a default function and may be overwritten by the user via `isContentTypeBinary` option in handler().
 * @param contentType The content type to check.
 * @returns True if the content type is binary, false otherwise.
 */
declare const defaultIsContentTypeBinary: (contentType: string) => boolean;
//#endregion
//#region ../../plugins/acryl-router/src/core/adapter/aws-lambda/conninfo.d.ts
/**
 * Get connection information from AWS Lambda
 *
 * Extracts client IP from various Lambda event sources:
 * - API Gateway v1 (REST API): requestContext.identity.sourceIp
 * - API Gateway v2 (HTTP API/Function URLs): requestContext.http.sourceIp
 * - ALB: Falls back to x-forwarded-for header
 *
 * @param c - Context
 * @returns Connection information including remote address
 * @example
 * ```ts
 * import { Acryl } from 'acrylblends'
 * import { handle, getConnInfo } from 'acrylblends/aws-lambda'
 *
 * const app = new Acryl()
 *
 * app.get('/', (c) => {
 *   const info = getConnInfo(c)
 *   return c.text(`Your IP: ${info.remote.address}`)
 * })
 *
 * export const handler = handle(app)
 * ```
 */
declare const getConnInfo: GetConnInfo;
//#endregion
export { type ALBRequestContext, type APIGatewayProxyResult, type ApiGatewayRequestContext, type ApiGatewayRequestContextV2, type LambdaContext, type LambdaEvent, defaultIsContentTypeBinary, getConnInfo, handle, streamHandle };