import { t as Context } from "./context-B5Y1lLha.js";
import { t as StreamingApi } from "./stream-CPdqZ0Fp.js";

//#region ../../plugins/acryl-router/src/core/helper/streaming/stream.d.ts
declare const stream: (c: Context, cb: (stream: StreamingApi) => Promise<void>, onError?: (e: Error, stream: StreamingApi) => Promise<void>) => Response;
//#endregion
//#region ../../plugins/acryl-router/src/core/helper/streaming/sse.d.ts
interface SSEMessage {
  data: string | Promise<string>;
  event?: string;
  id?: string;
  retry?: number;
}
declare class SSEStreamingApi extends StreamingApi {
  constructor(writable: WritableStream, readable: ReadableStream);
  writeSSE(message: SSEMessage): Promise<void>;
}
declare const streamSSE: (c: Context, cb: (stream: SSEStreamingApi) => Promise<void>, onError?: (e: Error, stream: SSEStreamingApi) => Promise<void>) => Response;
//#endregion
//#region ../../plugins/acryl-router/src/core/helper/streaming/text.d.ts
declare const streamText: (c: Context, cb: (stream: StreamingApi) => Promise<void>, onError?: (e: Error, stream: StreamingApi) => Promise<void>) => Response;
//#endregion
export { type SSEMessage, SSEStreamingApi, stream, streamSSE, streamText };