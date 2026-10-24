import { decodeBase64, decodeBase64Url, encodeBase64Url } from "./utils/encode.js";
import { getRuntimeKey } from "./adapter.js";
//#region ../../plugins/acryl-router/src/core/utils/jwt/jwa.ts
/**
* @module
* JSON Web Algorithms (JWA)
* https://datatracker.ietf.org/doc/html/rfc7518
*/
const AlgorithmTypes = {
	HS256: "HS256",
	HS384: "HS384",
	HS512: "HS512",
	RS256: "RS256",
	RS384: "RS384",
	RS512: "RS512",
	PS256: "PS256",
	PS384: "PS384",
	PS512: "PS512",
	ES256: "ES256",
	ES384: "ES384",
	ES512: "ES512",
	EdDSA: "EdDSA"
};
//#endregion
//#region ../../plugins/acryl-router/src/core/utils/jwt/types.ts
/**
* @module
* Type definitions for JWT utilities.
*/
var JwtAlgorithmNotImplemented = class extends Error {
	constructor(alg) {
		super(`${alg} is not an implemented algorithm`);
		this.name = "JwtAlgorithmNotImplemented";
	}
};
var JwtAlgorithmRequired = class extends Error {
	constructor() {
		super("JWT verification requires \"alg\" option to be specified");
		this.name = "JwtAlgorithmRequired";
	}
};
var JwtAlgorithmMismatch = class extends Error {
	constructor(expected, actual) {
		super(`JWT algorithm mismatch: expected "${expected}", got "${actual}"`);
		this.name = "JwtAlgorithmMismatch";
	}
};
var JwtTokenInvalid = class extends Error {
	constructor(token) {
		super(`invalid JWT token: ${token}`);
		this.name = "JwtTokenInvalid";
	}
};
var JwtTokenNotBefore = class extends Error {
	constructor(token) {
		super(`token (${token}) is being used before it's valid`);
		this.name = "JwtTokenNotBefore";
	}
};
var JwtTokenExpired = class extends Error {
	constructor(token) {
		super(`token (${token}) expired`);
		this.name = "JwtTokenExpired";
	}
};
var JwtTokenIssuedAt = class extends Error {
	constructor(currentTimestamp, iat) {
		super(`Invalid "iat" claim, must be a valid number lower than "${currentTimestamp}" (iat: "${iat}")`);
		this.name = "JwtTokenIssuedAt";
	}
};
var JwtTokenIssuer = class extends Error {
	constructor(expected, iss) {
		super(`expected issuer "${expected}", got ${iss ? `"${iss}"` : "none"} `);
		this.name = "JwtTokenIssuer";
	}
};
var JwtHeaderInvalid = class extends Error {
	constructor(header) {
		super(`jwt header is invalid: ${JSON.stringify(header)}`);
		this.name = "JwtHeaderInvalid";
	}
};
var JwtHeaderRequiresKid = class extends Error {
	constructor(header) {
		super(`required "kid" in jwt header: ${JSON.stringify(header)}`);
		this.name = "JwtHeaderRequiresKid";
	}
};
var JwtSymmetricAlgorithmNotAllowed = class extends Error {
	constructor(alg) {
		super(`symmetric algorithm "${alg}" is not allowed for JWK verification`);
		this.name = "JwtSymmetricAlgorithmNotAllowed";
	}
};
var JwtAlgorithmNotAllowed = class extends Error {
	constructor(alg, allowedAlgorithms) {
		super(`algorithm "${alg}" is not in the allowed list: [${allowedAlgorithms.join(", ")}]`);
		this.name = "JwtAlgorithmNotAllowed";
	}
};
var JwtTokenSignatureMismatched = class extends Error {
	constructor(token) {
		super(`token(${token}) signature mismatched`);
		this.name = "JwtTokenSignatureMismatched";
	}
};
var JwtPayloadRequiresAud = class extends Error {
	constructor(payload) {
		super(`required "aud" in jwt payload: ${JSON.stringify(payload)}`);
		this.name = "JwtPayloadRequiresAud";
	}
};
var JwtTokenAudience = class extends Error {
	constructor(expected, aud) {
		super(`expected audience "${Array.isArray(expected) ? expected.join(", ") : expected}", got "${aud}"`);
		this.name = "JwtTokenAudience";
	}
};
const CryptoKeyUsage = {
	Encrypt: "encrypt",
	Decrypt: "decrypt",
	Sign: "sign",
	Verify: "verify",
	DeriveKey: "deriveKey",
	DeriveBits: "deriveBits",
	WrapKey: "wrapKey",
	UnwrapKey: "unwrapKey"
};
//#endregion
//#region ../../plugins/acryl-router/src/core/utils/jwt/utf8.ts
/**
* @module
* Functions for encoding/decoding UTF8.
*/
const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();
//#endregion
//#region ../../plugins/acryl-router/src/core/utils/jwt/jws.ts
/**
* @module
* JSON Web Signature (JWS)
* https://datatracker.ietf.org/doc/html/rfc7515
*/
async function signing(privateKey, alg, data) {
	const algorithm = getKeyAlgorithm(alg);
	const cryptoKey = await importPrivateKey(privateKey, algorithm);
	return await crypto.subtle.sign(algorithm, cryptoKey, data);
}
async function verifying(publicKey, alg, signature, data) {
	const algorithm = getKeyAlgorithm(alg);
	const cryptoKey = await importPublicKey(publicKey, algorithm);
	return await crypto.subtle.verify(algorithm, cryptoKey, signature, data);
}
function pemToBinary(pem) {
	return decodeBase64(pem.replace(/-+(BEGIN|END).*?-+/g, "").replace(/\s/g, ""));
}
async function importPrivateKey(key, alg) {
	if (!crypto.subtle || !crypto.subtle.importKey) throw new Error("`crypto.subtle.importKey` is undefined. JWT auth middleware requires it.");
	if (isCryptoKey(key)) {
		if (key.type !== "private" && key.type !== "secret") throw new Error(`unexpected key type: CryptoKey.type is ${key.type}, expected private or secret`);
		return key;
	}
	const usages = [CryptoKeyUsage.Sign];
	if (typeof key === "object") return await crypto.subtle.importKey("jwk", key, alg, false, usages);
	if (key.includes("PRIVATE")) return await crypto.subtle.importKey("pkcs8", pemToBinary(key), alg, false, usages);
	return await crypto.subtle.importKey("raw", utf8Encoder.encode(key), alg, false, usages);
}
async function importPublicKey(key, alg) {
	if (!crypto.subtle || !crypto.subtle.importKey) throw new Error("`crypto.subtle.importKey` is undefined. JWT auth middleware requires it.");
	if (isCryptoKey(key)) {
		if (key.type === "public" || key.type === "secret") return key;
		key = await exportPublicJwkFrom(key);
	}
	if (typeof key === "string" && key.includes("PRIVATE")) key = await exportPublicJwkFrom(await crypto.subtle.importKey("pkcs8", pemToBinary(key), alg, true, [CryptoKeyUsage.Sign]));
	const usages = [CryptoKeyUsage.Verify];
	if (typeof key === "object") return await crypto.subtle.importKey("jwk", key, alg, false, usages);
	if (key.includes("PUBLIC")) return await crypto.subtle.importKey("spki", pemToBinary(key), alg, false, usages);
	return await crypto.subtle.importKey("raw", utf8Encoder.encode(key), alg, false, usages);
}
async function exportPublicJwkFrom(privateKey) {
	if (privateKey.type !== "private") throw new Error(`unexpected key type: ${privateKey.type}`);
	if (!privateKey.extractable) throw new Error("unexpected private key is unextractable");
	const jwk = await crypto.subtle.exportKey("jwk", privateKey);
	const { kty } = jwk;
	const { alg, e, n } = jwk;
	const { crv, x, y } = jwk;
	return {
		kty,
		alg,
		e,
		n,
		crv,
		x,
		y,
		key_ops: [CryptoKeyUsage.Verify]
	};
}
function getKeyAlgorithm(name) {
	switch (name) {
		case "HS256": return {
			name: "HMAC",
			hash: { name: "SHA-256" }
		};
		case "HS384": return {
			name: "HMAC",
			hash: { name: "SHA-384" }
		};
		case "HS512": return {
			name: "HMAC",
			hash: { name: "SHA-512" }
		};
		case "RS256": return {
			name: "RSASSA-PKCS1-v1_5",
			hash: { name: "SHA-256" }
		};
		case "RS384": return {
			name: "RSASSA-PKCS1-v1_5",
			hash: { name: "SHA-384" }
		};
		case "RS512": return {
			name: "RSASSA-PKCS1-v1_5",
			hash: { name: "SHA-512" }
		};
		case "PS256": return {
			name: "RSA-PSS",
			hash: { name: "SHA-256" },
			saltLength: 32
		};
		case "PS384": return {
			name: "RSA-PSS",
			hash: { name: "SHA-384" },
			saltLength: 48
		};
		case "PS512": return {
			name: "RSA-PSS",
			hash: { name: "SHA-512" },
			saltLength: 64
		};
		case "ES256": return {
			name: "ECDSA",
			hash: { name: "SHA-256" },
			namedCurve: "P-256"
		};
		case "ES384": return {
			name: "ECDSA",
			hash: { name: "SHA-384" },
			namedCurve: "P-384"
		};
		case "ES512": return {
			name: "ECDSA",
			hash: { name: "SHA-512" },
			namedCurve: "P-521"
		};
		case "EdDSA": return {
			name: "Ed25519",
			namedCurve: "Ed25519"
		};
		default: throw new JwtAlgorithmNotImplemented(name);
	}
}
function isCryptoKey(key) {
	if (getRuntimeKey() === "node" && !!crypto.webcrypto) return key instanceof crypto.webcrypto.CryptoKey;
	return key instanceof CryptoKey;
}
//#endregion
//#region ../../plugins/acryl-router/src/core/utils/jwt/jwt.ts
/**
* @module
* JSON Web Token (JWT)
* https://datatracker.ietf.org/doc/html/rfc7519
*/
const encodeJwtPart = (part) => encodeBase64Url(utf8Encoder.encode(JSON.stringify(part)).buffer).replace(/=/g, "");
const encodeSignaturePart = (buf) => encodeBase64Url(buf).replace(/=/g, "");
const decodeJwtPart = (part) => JSON.parse(utf8Decoder.decode(decodeBase64Url(part)));
function isTokenHeader(obj) {
	if (typeof obj === "object" && obj !== null) {
		const objWithAlg = obj;
		return "alg" in objWithAlg && Object.values(AlgorithmTypes).includes(objWithAlg.alg) && (!("typ" in objWithAlg) || objWithAlg.typ === "JWT");
	}
	return false;
}
const sign = async (payload, privateKey, alg = "HS256") => {
	const encodedPayload = encodeJwtPart(payload);
	let encodedHeader;
	if (typeof privateKey === "object" && "alg" in privateKey) {
		alg = privateKey.alg;
		encodedHeader = encodeJwtPart({
			alg,
			typ: "JWT",
			kid: privateKey.kid
		});
	} else encodedHeader = encodeJwtPart({
		alg,
		typ: "JWT"
	});
	const partialToken = `${encodedHeader}.${encodedPayload}`;
	const signaturePart = await signing(privateKey, alg, utf8Encoder.encode(partialToken));
	return `${partialToken}.${encodeSignaturePart(signaturePart)}`;
};
const verify = async (token, publicKey, algOrOptions) => {
	if (!algOrOptions) throw new JwtAlgorithmRequired();
	const { alg, iss, nbf = true, exp = true, iat = true, aud } = typeof algOrOptions === "string" ? { alg: algOrOptions } : algOrOptions;
	if (!alg) throw new JwtAlgorithmRequired();
	const tokenParts = token.split(".");
	if (tokenParts.length !== 3) throw new JwtTokenInvalid(token);
	const { header, payload } = decode(token);
	if (!isTokenHeader(header)) throw new JwtHeaderInvalid(header);
	if (header.alg !== alg) throw new JwtAlgorithmMismatch(alg, header.alg);
	const now = Math.floor(Date.now() / 1e3);
	if (nbf && payload.nbf !== void 0) {
		if (typeof payload.nbf !== "number" || !Number.isFinite(payload.nbf) || payload.nbf > now) throw new JwtTokenNotBefore(token);
	}
	if (exp && payload.exp !== void 0) {
		if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp <= now) throw new JwtTokenExpired(token);
	}
	if (iat && payload.iat !== void 0) {
		if (typeof payload.iat !== "number" || !Number.isFinite(payload.iat) || now < payload.iat) throw new JwtTokenIssuedAt(now, payload.iat);
	}
	if (iss) {
		if (!payload.iss) throw new JwtTokenIssuer(iss, null);
		if (typeof iss === "string" && payload.iss !== iss) throw new JwtTokenIssuer(iss, payload.iss);
		if (iss instanceof RegExp && !iss.test(payload.iss)) throw new JwtTokenIssuer(iss, payload.iss);
	}
	if (aud) {
		if (!payload.aud) throw new JwtPayloadRequiresAud(payload);
		if (!(Array.isArray(payload.aud) ? payload.aud : [payload.aud]).some((payloadAud) => aud instanceof RegExp ? aud.test(payloadAud) : typeof aud === "string" ? payloadAud === aud : Array.isArray(aud) && aud.includes(payloadAud))) throw new JwtTokenAudience(aud, payload.aud);
	}
	const headerPayload = token.substring(0, token.lastIndexOf("."));
	let signature;
	try {
		signature = decodeBase64Url(tokenParts[2]);
	} catch {
		throw new JwtTokenInvalid(token);
	}
	if (!await verifying(publicKey, alg, signature, utf8Encoder.encode(headerPayload))) throw new JwtTokenSignatureMismatched(token);
	return payload;
};
const symmetricAlgorithms = [
	AlgorithmTypes.HS256,
	AlgorithmTypes.HS384,
	AlgorithmTypes.HS512
];
const verifyWithJwks = async (token, options, init) => {
	const verifyOpts = options.verification || {};
	const header = decodeHeader(token);
	if (!isTokenHeader(header)) throw new JwtHeaderInvalid(header);
	if (!header.kid) throw new JwtHeaderRequiresKid(header);
	if (symmetricAlgorithms.includes(header.alg)) throw new JwtSymmetricAlgorithmNotAllowed(header.alg);
	if (!options.allowedAlgorithms.includes(header.alg)) throw new JwtAlgorithmNotAllowed(header.alg, options.allowedAlgorithms);
	let verifyKeys = options.keys ? [...options.keys] : void 0;
	if (options.jwks_uri) {
		const response = await fetch(options.jwks_uri, init);
		if (!response.ok) throw new Error(`failed to fetch JWKS from ${options.jwks_uri}`);
		const data = await response.json();
		if (!data.keys) throw new Error("invalid JWKS response. \"keys\" field is missing");
		if (!Array.isArray(data.keys)) throw new Error("invalid JWKS response. \"keys\" field is not an array");
		verifyKeys ??= [];
		verifyKeys.push(...data.keys);
	} else if (!verifyKeys) throw new Error("verifyWithJwks requires options for either \"keys\" or \"jwks_uri\" or both");
	const matchingKey = verifyKeys.find((key) => key.kid === header.kid);
	if (!matchingKey) throw new JwtTokenInvalid(token);
	if (matchingKey.alg && matchingKey.alg !== header.alg) throw new JwtAlgorithmMismatch(matchingKey.alg, header.alg);
	return await verify(token, matchingKey, {
		alg: header.alg,
		...verifyOpts
	});
};
const decode = (token) => {
	const parts = token.split(".");
	if (parts.length !== 3) throw new JwtTokenInvalid(token);
	try {
		return {
			header: decodeJwtPart(parts[0]),
			payload: decodeJwtPart(parts[1])
		};
	} catch {
		throw new JwtTokenInvalid(token);
	}
};
const decodeHeader = (token) => {
	const parts = token.split(".");
	if (parts.length !== 3) throw new JwtTokenInvalid(token);
	try {
		return decodeJwtPart(parts[0]);
	} catch {
		throw new JwtTokenInvalid(token);
	}
};
//#endregion
//#region ../../plugins/acryl-router/src/core/utils/jwt/index.ts
/**
* @module
* JWT utility.
*/
const Jwt = {
	sign,
	verify,
	decode,
	verifyWithJwks
};
//#endregion
export { AlgorithmTypes as n, Jwt as t };
