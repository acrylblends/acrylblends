//#region ../../plugins/acryl-router/src/core/utils/color.d.ts
/**
 * @module
 * Color utility.
 */
/**
 * Get whether color change on terminal is enabled or disabled.
 * If `NO_COLOR` environment variable is set, this function returns `false`.
 * Unlike getColorEnabledAsync(), this cannot check Cloudflare environment variables.
 * @see {@link https://no-color.org/}
 *
 * @returns {boolean}
 */
declare function getColorEnabled(): boolean;
/**
 * Get whether color change on terminal is enabled or disabled.
 * If `NO_COLOR` environment variable is set, this function returns `false`.
 * @see {@link https://no-color.org/}
 *
 * @returns {boolean}
 */
declare function getColorEnabledAsync(): Promise<boolean>;
//#endregion
export { getColorEnabled, getColorEnabledAsync };