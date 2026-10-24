import { I as MiddlewareHandler, t as Context } from "./context-Bm7rI-oK.js";

//#region ../../plugins/acryl-router/src/core/middleware/language/language.d.ts
type DetectorType = 'path' | 'querystring' | 'cookie' | 'header';
type CacheType = 'cookie';
interface DetectorOptions {
  /** Order of language detection strategies */
  order: DetectorType[];
  /** Query parameter name for language */
  lookupQueryString: string;
  /** Cookie name for language */
  lookupCookie: string;
  /** Index in URL path where language code appears */
  lookupFromPathIndex: number;
  /** Header key for language detection */
  lookupFromHeaderKey: string;
  /** Caching strategies */
  caches: CacheType[] | false;
  /** Cookie configuration options */
  cookieOptions?: {
    domain?: string;
    path?: string;
    sameSite?: 'Strict' | 'Lax' | 'None';
    secure?: boolean;
    maxAge?: number;
    httpOnly?: boolean;
  };
  /** Whether to ignore case in language codes */
  ignoreCase: boolean;
  /** Default language if none detected */
  fallbackLanguage: string;
  /** List of supported language codes */
  supportedLanguages: string[];
  /** Optional function to transform detected language codes */
  convertDetectedLanguage?: (lang: string) => string;
  /** Enable debug logging */
  debug?: boolean;
}
interface LanguageVariables {
  language: string;
}
/**
 * Detects language from query parameter
 */
declare const detectFromQuery: (c: Context, options: DetectorOptions) => string | undefined;
/**
 * Detects language from cookie
 */
declare const detectFromCookie: (c: Context, options: DetectorOptions) => string | undefined;
/**
 * Detects language from Accept-Language header
 */
declare function detectFromHeader(c: Context, options: DetectorOptions): string | undefined;
/**
 * Detects language from URL path
 */
declare function detectFromPath(c: Context, options: DetectorOptions): string | undefined;
/**
 * Language detector middleware factory
 * @param userOptions Configuration options for the language detector
 * @returns Acryl middleware function
 *
 * @example
 * ```ts
 * type Variables = LanguageVariables
 * const app = new Acryl<{ Variables: Variables }>()
 *
 * app.use(
 *   languageDetector({
 *     supportedLanguages: ['en', 'ja'], // Must include fallback
 *     fallbackLanguage: 'en', // Required
 *   })
 * )
 *
 * app.get('/', (c) => {
 *   const lang = c.get('language')
 *   return c.text(`Current language: ${lang}`)
 * })
 * ```
 */
declare const languageDetector: (userOptions: Partial<DetectorOptions>) => MiddlewareHandler;
//#endregion
//#region ../../plugins/acryl-router/src/core/middleware/language/index.d.ts
declare module '../../context.ts' {
  interface ContextVariableMap extends LanguageVariables {}
}
//#endregion
export { type CacheType, type DetectorOptions, type DetectorType, type LanguageVariables, detectFromCookie, detectFromHeader, detectFromPath, detectFromQuery, languageDetector };