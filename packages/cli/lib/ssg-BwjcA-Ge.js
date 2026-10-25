import "./router.js";
import { html } from "./html.js";
import { getExtension } from "./utils/mime.js";
import { findTargetHandler, isMiddleware } from "./utils/handler.js";
import { o as replaceUrlParam } from "./utils-Cx61GFMC.js";
import { createPool } from "./utils/concurrent.js";
//#region ../../plugins/acryl-router/src/core/helper/ssg/utils.ts
/**
* Get dirname
* @param path File Path
* @returns Parent dir path
*/
const dirname = (path) => {
	return path.split(/[\/\\]/).slice(0, -1).join("/");
};
const normalizePath = (path) => {
	return path.replace(/(\\)/g, "/").replace(/\/$/g, "");
};
const getUncRoot = (path) => {
	const uncRoot = path.replace(/\\/g, "/").match(/^\/\/([^/]+)\/([^/]+)/);
	if (uncRoot) return `${uncRoot[1].toLowerCase()}/${uncRoot[2].toLowerCase()}`;
};
const handleParent = (resultPaths) => {
	if (resultPaths.length === 0 || resultPaths[resultPaths.length - 1] === "..") resultPaths.push("..");
	else resultPaths.pop();
};
const handleNonDot = (path, resultPaths) => {
	path = path.replace(/^\.(?!.)/, "");
	if (path !== "") resultPaths.push(path);
};
const handleSegments = (paths, resultPaths) => {
	for (const path of paths) if (path === "..") handleParent(resultPaths);
	else handleNonDot(path, resultPaths);
};
const joinPaths = (...paths) => {
	const hasUncPrefix = getUncRoot(paths[0]) !== void 0;
	paths = paths.map(normalizePath);
	const resultPaths = [];
	handleSegments(paths.join("/").split("/"), resultPaths);
	return (hasUncPrefix ? "//" : paths[0][0] === "/" ? "/" : "") + resultPaths.join("/");
};
const filterStaticGenerateRoutes = (acryl) => {
	return acryl.routes.reduce((acc, { method, handler, path }) => {
		const targetHandler = findTargetHandler(handler);
		if (["GET", "ALL"].includes(method) && !isMiddleware(targetHandler)) acc.push({ path });
		return acc;
	}, []);
};
const isDynamicRoute = (path) => {
	return path.split("/").some((segment) => segment.startsWith(":") || segment.includes("*"));
};
const toSegments = (path) => path === "" ? [] : path.split("/");
const getPathRoot = (path) => {
	const normalizedPath = path.replace(/\\/g, "/");
	const uncRoot = getUncRoot(normalizedPath);
	if (uncRoot) return `unc:${uncRoot}`;
	const driveRoot = normalizedPath.match(/^([A-Za-z]):/);
	if (driveRoot) return `${normalizedPath[2] === "/" ? "drive-absolute" : "drive-relative"}:${driveRoot[1].toLowerCase()}`;
	return normalizedPath.startsWith("/") ? "absolute" : "relative";
};
const ensureWithinOutDir = (outDir, filePath) => {
	const outDirSegments = toSegments(joinPaths(outDir));
	const filePathSegments = toSegments(joinPaths(filePath));
	const hasMismatchedPathRoot = getPathRoot(outDir) !== getPathRoot(filePath);
	const climbsAboveOutDir = filePathSegments[outDirSegments.length] === "..";
	if (hasMismatchedPathRoot || filePathSegments.length <= outDirSegments.length || !outDirSegments.every((segment, i) => segment === filePathSegments[i]) || climbsAboveOutDir) throw new Error(`Path traversal detected: "${filePath}" is outside the output directory`);
};
//#endregion
//#region ../../plugins/acryl-router/src/core/helper/ssg/middleware.ts
const SSG_CONTEXT = "ACRYL_SSG_CONTEXT";
const X_ACRYL_DISABLE_SSG_HEADER_KEY = "x-acryl-disable-ssg";
(() => {
	try {
		return new Response("SSG is disabled", {
			status: 404,
			headers: { [X_ACRYL_DISABLE_SSG_HEADER_KEY]: "true" }
		});
	} catch {
		return null;
	}
})();
/**
* Define SSG Route
*/
const ssgParams = (params) => async (c, next) => {
	if (isDynamicRoute(c.req.path)) {
		c.req.raw.ssgParams = Array.isArray(params) ? params : await params(c);
		return c.notFound();
	}
	await next();
};
/**
* @experimental
* `isSSGContext` is an experimental feature.
* The API might be changed.
*/
const isSSGContext = (c) => !!c.env?.[SSG_CONTEXT];
/**
* @experimental
* `disableSSG` is an experimental feature.
* The API might be changed.
*/
const disableSSG = () => async function disableSSG(c, next) {
	if (isSSGContext(c)) {
		c.header(X_ACRYL_DISABLE_SSG_HEADER_KEY, "true");
		return c.notFound();
	}
	await next();
};
/**
* @experimental
* `onlySSG` is an experimental feature.
* The API might be changed.
*/
const onlySSG = () => async function onlySSG(c, next) {
	if (!isSSGContext(c)) return c.notFound();
	await next();
};
//#endregion
//#region ../../plugins/acryl-router/src/core/helper/ssg/plugins.ts
/**
* The default plugin that defines the recommended behavior.
*
* @experimental
* `defaultPlugin` is an experimental feature.
* The API might be changed.
*/
const defaultPlugin = () => {
	return { afterResponseHook: (res) => {
		if (res.status !== 200) return false;
		return res;
	} };
};
const REDIRECT_STATUS_CODES = /* @__PURE__ */ new Set([
	301,
	302,
	303,
	307,
	308
]);
const generateRedirectHtml = (location) => {
	return html`<!DOCTYPE html>
<title>Redirecting to: ${location}</title>
<meta http-equiv="refresh" content="0;url=${location}" />
<meta name="robots" content="noindex" />
<link rel="canonical" href="${location}" />
<body>
<a href="${location}">Redirecting to <code>${location}</code></a>
</body>
`.toString().replace(/\n/g, "");
};
/**
* The redirect plugin that generates HTML redirect pages for HTTP redirect responses for status codes 301, 302, 303, 307 and 308.
*
* When used with `defaultPlugin`, place `redirectPlugin` before it, because `defaultPlugin` skips non-200 responses.
*
* ```ts
* // ✅ Will work as expected
* toSSG(app, fs, { plugins: [redirectPlugin(), defaultPlugin()] })
*
* // ❌ Will not work as expected
* toSSG(app, fs, { plugins: [defaultPlugin(), redirectPlugin()] })
* ```
*
* @experimental
* `redirectPlugin` is an experimental feature.
* The API might be changed.
*/
const redirectPlugin = () => {
	return { afterResponseHook: (res) => {
		if (REDIRECT_STATUS_CODES.has(res.status)) {
			const location = res.headers.get("Location");
			if (!location) return false;
			const htmlBody = generateRedirectHtml(location);
			return new Response(htmlBody, {
				status: 200,
				headers: { "Content-Type": "text/html; charset=utf-8" }
			});
		}
		return res;
	} };
};
//#endregion
//#region ../../plugins/acryl-router/src/core/helper/ssg/ssg.ts
const DEFAULT_CONCURRENCY = 2;
const DEFAULT_CONTENT_TYPE = "text/plain";
const DEFAULT_OUTPUT_DIR = "./static";
const generateFilePath = (routePath, outDir, mimeType, extensionMap) => {
	const extension = determineExtension(mimeType, extensionMap);
	let filePath;
	if (routePath.endsWith(`.${extension}`)) filePath = joinPaths(outDir, routePath);
	else if (routePath === "/") filePath = joinPaths(outDir, `index.${extension}`);
	else if (routePath.endsWith("/")) filePath = joinPaths(outDir, routePath, `index.${extension}`);
	else filePath = joinPaths(outDir, `${routePath}.${extension}`);
	ensureWithinOutDir(outDir, filePath);
	return filePath;
};
const parseResponseContent = async (response) => {
	const contentType = response.headers.get("Content-Type");
	try {
		if (contentType?.includes("text") || contentType?.includes("json")) return await response.text();
		else return await response.arrayBuffer();
	} catch (error) {
		throw new Error(`Error processing response: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
};
const defaultExtensionMap = {
	"text/html": "html",
	"text/xml": "xml",
	"application/xml": "xml",
	"application/atom+xml": "xml",
	"application/rss+xml": "xml",
	"application/yaml": "yaml"
};
const determineExtension = (mimeType, userExtensionMap) => {
	const extensionMap = userExtensionMap || defaultExtensionMap;
	if (mimeType in extensionMap) return extensionMap[mimeType];
	return getExtension(mimeType) || "html";
};
const combineBeforeRequestHooks = (hooks) => {
	if (!Array.isArray(hooks)) return hooks;
	return async (req) => {
		let currentReq = req;
		for (const hook of hooks) {
			const result = await hook(currentReq);
			if (result === false) return false;
			if (result instanceof Request) currentReq = result;
		}
		return currentReq;
	};
};
const combineAfterResponseHooks = (hooks) => {
	if (!Array.isArray(hooks)) return hooks;
	return async (res) => {
		let currentRes = res;
		for (const hook of hooks) {
			const result = await hook(currentRes);
			if (result === false) return false;
			if (result instanceof Response) currentRes = result;
		}
		return currentRes;
	};
};
const combineAfterGenerateHooks = (hooks, fsModule, options) => {
	if (!Array.isArray(hooks)) return hooks;
	return async (result) => {
		for (const hook of hooks) await hook(result, fsModule, options);
	};
};
/**
* @experimental
* `fetchRoutesContent` is an experimental feature.
* The API might be changed.
*/
const fetchRoutesContent = function* (app, beforeRequestHook, afterResponseHook, concurrency) {
	const baseURL = "http://localhost";
	const pool = createPool({ concurrency });
	for (const route of filterStaticGenerateRoutes(app)) {
		const thisRouteBaseURL = new URL(route.path, baseURL).toString();
		let forGetInfoURLRequest = new Request(thisRouteBaseURL);
		yield new Promise(async (resolveGetInfo, rejectGetInfo) => {
			try {
				if (beforeRequestHook) {
					const maybeRequest = await beforeRequestHook(forGetInfoURLRequest);
					if (!maybeRequest) {
						resolveGetInfo(void 0);
						return;
					}
					forGetInfoURLRequest = maybeRequest;
				}
				await pool.run(() => app.fetch(forGetInfoURLRequest, { [SSG_CONTEXT]: true }));
				if (!forGetInfoURLRequest.ssgParams) {
					if (isDynamicRoute(route.path)) {
						resolveGetInfo(void 0);
						return;
					}
					forGetInfoURLRequest.ssgParams = [{}];
				}
				const requestInit = {
					method: forGetInfoURLRequest.method,
					headers: forGetInfoURLRequest.headers
				};
				resolveGetInfo((function* () {
					for (const param of forGetInfoURLRequest.ssgParams) yield new Promise(async (resolveReq, rejectReq) => {
						try {
							const replacedUrlParam = replaceUrlParam(route.path, param);
							let response = await pool.run(() => app.request(replacedUrlParam, requestInit, { [SSG_CONTEXT]: true }));
							if (response.headers.get("x-acryl-disable-ssg")) {
								resolveReq(void 0);
								return;
							}
							if (afterResponseHook) {
								const maybeResponse = await afterResponseHook(response);
								if (!maybeResponse) {
									resolveReq(void 0);
									return;
								}
								response = maybeResponse;
							}
							resolveReq({
								routePath: replacedUrlParam,
								mimeType: response.headers.get("Content-Type")?.split(";")[0] || DEFAULT_CONTENT_TYPE,
								content: await parseResponseContent(response)
							});
						} catch (error) {
							rejectReq(error);
						}
					});
				})());
			} catch (error) {
				rejectGetInfo(error);
			}
		});
	}
};
/**
* @experimental
* `saveContentToFile` is an experimental feature.
* The API might be changed.
*/
const createdDirs = /* @__PURE__ */ new Set();
const saveContentToFile = async (data, fsModule, outDir, extensionMap) => {
	const awaitedData = await data;
	if (!awaitedData) return;
	const { routePath, content, mimeType } = awaitedData;
	const filePath = generateFilePath(routePath, outDir, mimeType, extensionMap);
	const dirPath = dirname(filePath);
	if (dirPath !== "" && !createdDirs.has(dirPath)) {
		await fsModule.mkdir(dirPath, { recursive: true });
		createdDirs.add(dirPath);
	}
	if (typeof content === "string") await fsModule.writeFile(filePath, content);
	else if (content instanceof ArrayBuffer) await fsModule.writeFile(filePath, new Uint8Array(content));
	return filePath;
};
/**
* @experimental
* `toSSG` is an experimental feature.
* The API might be changed.
*/
const toSSG = async (app, fs, options) => {
	let result;
	const getInfoPromises = [];
	const savePromises = [];
	const plugins = options?.plugins || [defaultPlugin()];
	const beforeRequestHooks = [];
	const afterResponseHooks = [];
	const afterGenerateHooks = [];
	if (options?.beforeRequestHook) beforeRequestHooks.push(...Array.isArray(options.beforeRequestHook) ? options.beforeRequestHook : [options.beforeRequestHook]);
	if (options?.afterResponseHook) afterResponseHooks.push(...Array.isArray(options.afterResponseHook) ? options.afterResponseHook : [options.afterResponseHook]);
	if (options?.afterGenerateHook) afterGenerateHooks.push(...Array.isArray(options.afterGenerateHook) ? options.afterGenerateHook : [options.afterGenerateHook]);
	for (const plugin of plugins) {
		if (plugin.beforeRequestHook) beforeRequestHooks.push(...Array.isArray(plugin.beforeRequestHook) ? plugin.beforeRequestHook : [plugin.beforeRequestHook]);
		if (plugin.afterResponseHook) afterResponseHooks.push(...Array.isArray(plugin.afterResponseHook) ? plugin.afterResponseHook : [plugin.afterResponseHook]);
		if (plugin.afterGenerateHook) afterGenerateHooks.push(...Array.isArray(plugin.afterGenerateHook) ? plugin.afterGenerateHook : [plugin.afterGenerateHook]);
	}
	try {
		const outputDir = options?.dir ?? "./static";
		const concurrency = options?.concurrency ?? DEFAULT_CONCURRENCY;
		const combinedBeforeRequestHook = combineBeforeRequestHooks(beforeRequestHooks.length > 0 ? beforeRequestHooks : [(req) => req]);
		const combinedAfterResponseHook = combineAfterResponseHooks(afterResponseHooks.length > 0 ? afterResponseHooks : [(req) => req]);
		const getInfoGen = fetchRoutesContent(app, combinedBeforeRequestHook, combinedAfterResponseHook, concurrency);
		for (const getInfo of getInfoGen) getInfoPromises.push(getInfo.then((getContentGen) => {
			if (!getContentGen) return;
			for (const content of getContentGen) savePromises.push(saveContentToFile(content, fs, outputDir, options?.extensionMap).catch((e) => e));
		}));
		await Promise.all(getInfoPromises);
		const files = [];
		for (const savePromise of savePromises) {
			const fileOrError = await savePromise;
			if (typeof fileOrError === "string") files.push(fileOrError);
			else if (fileOrError) throw fileOrError;
		}
		result = {
			success: true,
			files
		};
	} catch (error) {
		result = {
			success: false,
			files: [],
			error: error instanceof Error ? error : new Error(String(error))
		};
	}
	if (afterGenerateHooks.length > 0) await combineAfterGenerateHooks(afterGenerateHooks, fs, options)(result, fs, options);
	return result;
};
//#endregion
export { defaultExtensionMap as a, toSSG as c, X_ACRYL_DISABLE_SSG_HEADER_KEY as d, disableSSG as f, ssgParams as h, combineBeforeRequestHooks as i, defaultPlugin as l, onlySSG as m, combineAfterGenerateHooks as n, fetchRoutesContent as o, isSSGContext as p, combineAfterResponseHooks as r, saveContentToFile as s, DEFAULT_OUTPUT_DIR as t, redirectPlugin as u };
