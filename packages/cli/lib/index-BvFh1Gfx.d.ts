import { L as MiddlewareHandler, Z as TypedResponse, t as Context } from "./context-DS3fYyG-.js";
import { c as StatusCode } from "./http-status-DaAwGAFL.js";
import { b as MessageEvent, r as CloseEvent, t as BinaryType } from "./types-Lqx5BxQF.js";

//#region ../../plugins/acryl-router/src/core/helper/websocket/index.d.ts
/**
 * WebSocket Event Listeners type
 */
interface WSEvents<T = unknown> {
  onOpen?: (evt: Event, ws: WSContext<T>) => void;
  onMessage?: (evt: MessageEvent<WSMessageReceive>, ws: WSContext<T>) => void;
  onClose?: (evt: CloseEvent, ws: WSContext<T>) => void;
  onError?: (evt: Event, ws: WSContext<T>) => void;
}
/**
 * Upgrade WebSocket Type
 */
interface UpgradeWebSocket<T = unknown, U = any, _WSEvents = WSEvents<T>> {
  (createEvents: (c: Context) => _WSEvents | Promise<_WSEvents>, options?: U): MiddlewareHandler<any, string, {
    outputFormat: 'ws';
  }>;
  (c: Context, events: _WSEvents, options?: U): Promise<Response & TypedResponse<{}, StatusCode, 'ws'>>;
}
/**
 * ReadyState for WebSocket
 */
type WSReadyState = 0 | 1 | 2 | 3;
/**
 * An argument for WSContext class
 */
interface WSContextInit<T = unknown> {
  send(data: string | ArrayBuffer | Uint8Array<ArrayBuffer>, options: SendOptions): void;
  close(code?: number, reason?: string): void;
  raw?: T;
  readyState: WSReadyState;
  url?: string | URL | null;
  protocol?: string | null;
}
/**
 * Options for sending message
 */
interface SendOptions {
  compress?: boolean;
}
/**
 * A context for controlling WebSockets
 */
declare class WSContext<T = unknown> {
  #private;
  constructor(init: WSContextInit<T>);
  send(source: string | ArrayBuffer | Uint8Array<ArrayBuffer>, options?: SendOptions): void;
  raw?: T;
  binaryType: BinaryType;
  get readyState(): WSReadyState;
  url: URL | null;
  protocol: string | null;
  close(code?: number, reason?: string): void;
}
type WSMessageReceive = string | Blob | ArrayBufferLike;
declare const createWSMessageEvent: (source: WSMessageReceive) => MessageEvent<WSMessageReceive>;
interface WebSocketHelperDefineContext {}
type WebSocketHelperDefineHandler<T, U> = (c: Context, events: WSEvents<T>, options?: U) => Promise<Response | void> | Response | void;
/**
 * Create a WebSocket adapter/helper
 */
declare const defineWebSocketHelper: <T = unknown, U = any>(handler: WebSocketHelperDefineHandler<T, U>) => UpgradeWebSocket<T, U>;
//#endregion
export { WSEvents as a, WebSocketHelperDefineContext as c, defineWebSocketHelper as d, WSContextInit as i, WebSocketHelperDefineHandler as l, UpgradeWebSocket as n, WSMessageReceive as o, WSContext as r, WSReadyState as s, SendOptions as t, createWSMessageEvent as u };