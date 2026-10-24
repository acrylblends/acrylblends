import { I as MiddlewareHandler, t as Context } from "./context-Bm7rI-oK.js";

//#region ../../plugins/acryl-router/src/core/middleware/secure-headers/permissions-policy.d.ts
type PermissionsPolicyDirective = StandardizedFeatures | ProposedFeatures | ExperimentalFeatures;
/**
 * These features have been declared in a published version of the respective specification.
 */
type StandardizedFeatures = 'accelerometer' | 'ambientLightSensor' | 'attributionReporting' | 'autoplay' | 'battery' | 'bluetooth' | 'camera' | 'chUa' | 'chUaArch' | 'chUaBitness' | 'chUaFullVersion' | 'chUaFullVersionList' | 'chUaHighEntropyValues' | 'chUaMobile' | 'chUaModel' | 'chUaPlatform' | 'chUaPlatformVersion' | 'chUaWow64' | 'computePressure' | 'crossOriginIsolated' | 'directSockets' | 'displayCapture' | 'encryptedMedia' | 'executionWhileNotRendered' | 'executionWhileOutOfViewport' | 'fullscreen' | 'geolocation' | 'gyroscope' | 'hid' | 'identityCredentialsGet' | 'idleDetection' | 'keyboardMap' | 'magnetometer' | 'mediasession' | 'microphone' | 'midi' | 'navigationOverride' | 'otpCredentials' | 'payment' | 'pictureInPicture' | 'publickeyCredentialsGet' | 'screenWakeLock' | 'serial' | 'storageAccess' | 'syncXhr' | 'tools' | 'usb' | 'webShare' | 'windowManagement' | 'xrSpatialTracking';
/**
 * These features have been proposed, but the definitions have not yet been integrated into their respective specs.
 */
type ProposedFeatures = 'autofill' | 'clipboardRead' | 'clipboardWrite' | 'deferredFetch' | 'gamepad' | 'languageDetector' | 'languageModel' | 'manualText' | 'rewriter' | 'sharedAutofill' | 'speakerSelection' | 'summarizer' | 'translator' | 'writer';
/**
 * These features generally have an explainer only, but may be available for experimentation by web developers.
 */
type ExperimentalFeatures = 'allScreensCapture' | 'browsingTopics' | 'capturedSurfaceControl' | 'conversionMeasurement' | 'digitalCredentialsCreate' | 'digitalCredentialsGet' | 'focusWithoutUserActivation' | 'joinAdInterestGroup' | 'localFonts' | 'monetization' | 'runAdAuction' | 'smartCard' | 'syncScript' | 'trustTokenRedemption' | 'unload' | 'verticalScroll';
//#endregion
//#region ../../plugins/acryl-router/src/core/middleware/secure-headers/secure-headers.d.ts
type SecureHeadersVariables = {
  secureHeadersNonce?: string;
};
type ContentSecurityPolicyOptionHandler = (ctx: Context, directive: string) => string;
type ContentSecurityPolicyOptionValue = (string | ContentSecurityPolicyOptionHandler)[];
interface ContentSecurityPolicyOptions {
  defaultSrc?: ContentSecurityPolicyOptionValue;
  baseUri?: ContentSecurityPolicyOptionValue;
  childSrc?: ContentSecurityPolicyOptionValue;
  connectSrc?: ContentSecurityPolicyOptionValue;
  fontSrc?: ContentSecurityPolicyOptionValue;
  formAction?: ContentSecurityPolicyOptionValue;
  frameAncestors?: ContentSecurityPolicyOptionValue;
  frameSrc?: ContentSecurityPolicyOptionValue;
  imgSrc?: ContentSecurityPolicyOptionValue;
  manifestSrc?: ContentSecurityPolicyOptionValue;
  mediaSrc?: ContentSecurityPolicyOptionValue;
  objectSrc?: ContentSecurityPolicyOptionValue;
  reportTo?: string;
  reportUri?: string | string[];
  sandbox?: ContentSecurityPolicyOptionValue;
  scriptSrc?: ContentSecurityPolicyOptionValue;
  scriptSrcAttr?: ContentSecurityPolicyOptionValue;
  scriptSrcElem?: ContentSecurityPolicyOptionValue;
  styleSrc?: ContentSecurityPolicyOptionValue;
  styleSrcAttr?: ContentSecurityPolicyOptionValue;
  styleSrcElem?: ContentSecurityPolicyOptionValue;
  upgradeInsecureRequests?: ContentSecurityPolicyOptionValue;
  workerSrc?: ContentSecurityPolicyOptionValue;
  requireTrustedTypesFor?: ContentSecurityPolicyOptionValue;
  trustedTypes?: ContentSecurityPolicyOptionValue;
}
interface ReportToOptions {
  group: string;
  max_age: number;
  endpoints: ReportToEndpoint[];
}
interface ReportToEndpoint {
  url: string;
}
interface ReportingEndpointOptions {
  name: string;
  url: string;
}
type PermissionsPolicyValue = '*' | 'self' | 'src' | 'none' | string;
type PermissionsPolicyOptions = Partial<Record<PermissionsPolicyDirective, PermissionsPolicyValue[] | boolean>>;
type overridableHeader = boolean | string;
interface SecureHeadersOptions {
  contentSecurityPolicy?: ContentSecurityPolicyOptions;
  contentSecurityPolicyReportOnly?: ContentSecurityPolicyOptions;
  crossOriginEmbedderPolicy?: overridableHeader;
  crossOriginResourcePolicy?: overridableHeader;
  crossOriginOpenerPolicy?: overridableHeader;
  originAgentCluster?: overridableHeader;
  referrerPolicy?: overridableHeader;
  reportingEndpoints?: ReportingEndpointOptions[];
  reportTo?: ReportToOptions[];
  strictTransportSecurity?: overridableHeader;
  xContentTypeOptions?: overridableHeader;
  xDnsPrefetchControl?: overridableHeader;
  xDownloadOptions?: overridableHeader;
  xFrameOptions?: overridableHeader;
  xPermittedCrossDomainPolicies?: overridableHeader;
  xXssProtection?: overridableHeader;
  removePoweredBy?: boolean;
  permissionsPolicy?: PermissionsPolicyOptions;
}
declare const NONCE: ContentSecurityPolicyOptionHandler;
/**
 * Secure Headers Middleware for Acryl.
 *
 *
 * @param {Partial<SecureHeadersOptions>} [customOptions] - The options for the secure headers middleware.
 * @param {ContentSecurityPolicyOptions} [customOptions.contentSecurityPolicy] - Settings for the Content-Security-Policy header.
 * @param {ContentSecurityPolicyOptions} [customOptions.contentSecurityPolicyReportOnly] - Settings for the Content-Security-Policy-Report-Only header.
 * @param {overridableHeader} [customOptions.crossOriginEmbedderPolicy=false] - Settings for the Cross-Origin-Embedder-Policy header.
 * @param {overridableHeader} [customOptions.crossOriginResourcePolicy=true] - Settings for the Cross-Origin-Resource-Policy header.
 * @param {overridableHeader} [customOptions.crossOriginOpenerPolicy=true] - Settings for the Cross-Origin-Opener-Policy header.
 * @param {overridableHeader} [customOptions.originAgentCluster=true] - Settings for the Origin-Agent-Cluster header.
 * @param {overridableHeader} [customOptions.referrerPolicy=true] - Settings for the Referrer-Policy header.
 * @param {ReportingEndpointOptions[]} [customOptions.reportingEndpoints] - Settings for the Reporting-Endpoints header.
 * @param {ReportToOptions[]} [customOptions.reportTo] - Settings for the Report-To header.
 * @param {overridableHeader} [customOptions.strictTransportSecurity=true] - Settings for the Strict-Transport-Security header.
 * @param {overridableHeader} [customOptions.xContentTypeOptions=true] - Settings for the X-Content-Type-Options header.
 * @param {overridableHeader} [customOptions.xDnsPrefetchControl=true] - Settings for the X-DNS-Prefetch-Control header.
 * @param {overridableHeader} [customOptions.xDownloadOptions=true] - Settings for the X-Download-Options header.
 * @param {overridableHeader} [customOptions.xFrameOptions=true] - Settings for the X-Frame-Options header.
 * @param {overridableHeader} [customOptions.xPermittedCrossDomainPolicies=true] - Settings for the X-Permitted-Cross-Domain-Policies header.
 * @param {overridableHeader} [customOptions.xXssProtection=true] - Settings for the X-XSS-Protection header.
 * @param {boolean} [customOptions.removePoweredBy=true] - Settings for remove X-Powered-By header.
 * @param {PermissionsPolicyOptions} [customOptions.permissionsPolicy] - Settings for the Permissions-Policy header.
 * @returns {MiddlewareHandler} The middleware handler function.
 *
 * @example
 * ```ts
 * const app = new Acryl()
 * app.use(secureHeaders())
 * ```
 */
declare const secureHeaders: (customOptions?: SecureHeadersOptions) => MiddlewareHandler;
//#endregion
//#region ../../plugins/acryl-router/src/core/middleware/secure-headers/index.d.ts
declare module '../../context.ts' {
  interface ContextVariableMap extends SecureHeadersVariables {}
}
//#endregion
export { type ContentSecurityPolicyOptionHandler, NONCE, type SecureHeadersVariables, secureHeaders };