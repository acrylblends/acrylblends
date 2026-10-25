import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
//#region ../../plugins/acryl-node-server/src/transpile.ts
/**
* One TypeScript module compiled to JavaScript with the app's own `typescript`: the transform behind `acrylblends/node-server/register`
* (server JSX on Node) and `clientModules` (browser modules). `typescript` is loaded from the app on first use, so the framework itself has
* no dependencies.
*/
/** Thrown when the app has no `typescript` to compile a file with. */
var MissingTypeScriptError = class extends Error {
	constructor(file, what) {
		super(`acrylblends: ${file} ${what}, and compiling it needs the typescript package in this app: npm install --save-dev typescript`);
		this.name = "MissingTypeScriptError";
	}
};
const compilers = /* @__PURE__ */ new Map();
const importSources = /* @__PURE__ */ new Map();
/**
* The app's own `typescript`, resolved from the file, so each app compiles with the version it pinned.
* @param file - the module to compile.
* @param what - what the file needs compiling for, for the error message.
* @returns the compiler.
* @throws MissingTypeScriptError when the app has no `typescript`.
*/
function compilerFor(file, what) {
	let owner;
	for (let dir = dirname(file); owner === void 0; dir = dirname(dir)) if (existsSync(join(dir, "node_modules", "typescript", "package.json"))) owner = dir;
	else if (dirname(dir) === dir) throw new MissingTypeScriptError(file, what);
	const path = createRequire(join(owner, "package.json")).resolve("typescript");
	let compiler = compilers.get(path);
	if (compiler === void 0) {
		compiler = createRequire(path)(path);
		compilers.set(path, compiler);
	}
	return compiler;
}
/** `jsxImportSource` of the tsconfig.json nearest to the file (following `extends`), read once per config. */
function importSourceFor(file, ts, fallback) {
	const config = ts.findConfigFile(dirname(file), (path) => existsSync(path));
	if (config === void 0) return fallback;
	let source = importSources.get(`${config}\0${fallback}`);
	if (source === void 0) {
		const { config: json } = ts.readConfigFile(config, (path) => ts.sys.readFile(path));
		source = ts.parseJsonConfigFileContent(json ?? {}, ts.sys, dirname(config)).options.jsxImportSource ?? fallback;
		importSources.set(`${config}\0${fallback}`, source);
	}
	return source;
}
/**
* A TypeScript or JSX module compiled to an ES module, with its source map inline (a file's own `@jsxImportSource` pragma wins over the
* options).
* @param file - absolute path of the module, which also locates the app's `typescript` and tsconfig.json.
* @param text - its source.
* @param options - the JSX runtime and the specifier rewrite.
* @returns the JavaScript.
* @throws MissingTypeScriptError when the app has no `typescript`.
*/
function compileModule(file, text, options) {
	const ts = compilerFor(file, options.what);
	const output = ts.transpileModule(text, {
		fileName: file,
		compilerOptions: {
			module: "esnext",
			target: "es2022",
			jsx: "react-jsx",
			jsxImportSource: options.importSource ?? importSourceFor(file, ts, options.defaultImportSource),
			allowImportingTsExtensions: true,
			inlineSourceMap: true,
			inlineSources: true
		}
	}).outputText;
	return options.rewrite === void 0 ? output : rewriteSpecifiers(ts, output, options.rewrite);
}
/** The output with each import specifier `rewrite` maps replaced; TypeScript's lexer finds them, so strings and comments are left alone. */
function rewriteSpecifiers(ts, code, rewrite) {
	let result = "";
	let last = 0;
	for (const { fileName, pos } of ts.preProcessFile(code, true, true).importedFiles.toSorted((a, b) => a.pos - b.pos)) {
		const start = pos + 1;
		if (code.slice(start, start + fileName.length) !== fileName) continue;
		const replacement = rewrite(fileName);
		if (replacement === void 0) continue;
		result += code.slice(last, start) + replacement;
		last = start + fileName.length;
	}
	return result + code.slice(last);
}
//#endregion
export { compileModule as n, MissingTypeScriptError as t };
