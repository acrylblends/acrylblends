import { t as AddressType } from "../types-Dv_nV2cv.js";

//#region ../../plugins/acryl-router/src/core/utils/ipaddr.d.ts
/**
 * Expand IPv6 Address
 * @param ipV6 Shorten IPv6 Address
 * @return expanded IPv6 Address
 */
declare const expandIPv6: (ipV6: string) => string;
declare const INVALID_IP_ADDRESS_ERROR_CODE = "ERR_INVALID_IP_ADDRESS";
type InvalidIPAddressError = TypeError & {
  code: typeof INVALID_IP_ADDRESS_ERROR_CODE;
};
/**
 * Distinct Remote Addr
 * @param remoteAddr Remote Addr
 */
declare const distinctRemoteAddr: (remoteAddr: string) => AddressType;
/**
 * Convert IPv4 to Uint8Array
 * @param ipv4 IPv4 Address
 * @returns BigInt
 */
declare const convertIPv4ToBinary: (ipv4: string) => bigint;
/**
 * Convert IPv6 to Uint8Array
 * @param ipv6 IPv6 Address
 * @returns BigInt
 */
declare const convertIPv6ToBinary: (ipv6: string) => bigint;
/**
 * Convert a binary representation of an IPv4 address to a string.
 * @param ipV4 binary IPv4 Address
 * @return IPv4 Address in string
 */
declare const convertIPv4BinaryToString: (ipV4: bigint) => string;
/**
 * Check if a binary IPv6 address is an IPv4-mapped IPv6 address (::ffff:x.x.x.x)
 * @param ipv6binary binary IPv6 Address
 * @return true if the address is an IPv4-mapped IPv6 address
 */
declare const isIPv4MappedIPv6: (ipv6binary: bigint) => boolean;
/**
 * Extract the IPv4 portion from an IPv4-mapped IPv6 address
 * @param ipv6binary binary IPv4-mapped IPv6 Address
 * @return binary IPv4 Address
 */
declare const convertIPv4MappedIPv6ToIPv4: (ipv6binary: bigint) => bigint;
/**
 * Convert a binary representation of an IPv6 address to a string.
 * @param ipV6 binary IPv6 Address
 * @return normalized IPv6 Address in string
 */
declare const convertIPv6BinaryToString: (ipV6: bigint) => string;
//#endregion
export { INVALID_IP_ADDRESS_ERROR_CODE, InvalidIPAddressError, convertIPv4BinaryToString, convertIPv4MappedIPv6ToIPv4, convertIPv4ToBinary, convertIPv6BinaryToString, convertIPv6ToBinary, distinctRemoteAddr, expandIPv6, isIPv4MappedIPv6 };