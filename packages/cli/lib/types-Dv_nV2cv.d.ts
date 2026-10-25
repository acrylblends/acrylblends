import { t as Context } from "./context-DS3fYyG-.js";

//#region ../../plugins/acryl-router/src/core/helper/conninfo/types.d.ts
type AddressType = 'IPv6' | 'IPv4' | undefined;
type NetAddrInfo = {
  /**
   * Transport protocol type
   */
  transport?: 'tcp' | 'udp';
  /**
   * Transport port number
   */
  port?: number;
  address?: string;
  addressType?: AddressType;
} & ({
  /**
   * Host name such as IP Addr
   */
  address: string;
  /**
   * Host name type
   */
  addressType: AddressType;
} | {});
/**
 * HTTP Connection information
 */
interface ConnInfo {
  /**
   * Remote information
   */
  remote: NetAddrInfo;
}
/**
 * Helper type
 */
type GetConnInfo = (c: Context) => ConnInfo;
//#endregion
export { NetAddrInfo as i, ConnInfo as n, GetConnInfo as r, AddressType as t };