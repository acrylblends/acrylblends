//#region ../../plugins/acryl-router/src/helpers/read-sse.d.ts
/**
 * `readSSE(response)`: the events of a `text/event-stream` answer from `fetch`, for the browser. `EventSource` reads GET streams only; a chat
 * or any stream that needs a POST body, a header or an `AbortSignal` is read with `fetch`, and this is the loop every such page otherwise writes by
 * hand. It follows the parsing rules of the HTML standard (lines end in LF, CRLF or CR; the `data` lines of one event join with LF; a line that
 * starts with a colon is a comment; an event ends at a blank line; an event with no `data` line is not dispatched; the last event is dispatched
 * only if its blank line arrived), and it is one module with no imports, so it also runs in a service worker and on a fetch runtime.
 *
 * ACRYL's own addition, not part of the upstream port.
 */
/** One event of the stream. */
interface SSEEvent {
  /** The `event:` name; `message` when the event has none. */
  readonly event: string;
  /** The `data:` lines of the event, joined with a line feed. */
  readonly data: string;
  /** The `id:` of the event, when it had one. */
  readonly id?: string;
  /** The `retry:` of the event in milliseconds, when it had one. */
  readonly retry?: number;
}
interface ReadSSEOptions {
  /** Stops the loop and cancels the response body when it aborts. (Abort the `fetch` itself with the signal you pass to it.) */
  readonly signal?: AbortSignal;
}
/**
 * Read the events of a `text/event-stream` response as they arrive. Leaving the loop early (`break`, a thrown error) cancels the body, so the
 * request to the server ends.
 * @throws when the response is not `ok` (the status is in the message; the body is cancelled, not parsed), has no body, or fails while it is read.
 */
declare function readSSE(response: Response, options?: ReadSSEOptions): AsyncGenerator<SSEEvent, void, undefined>;
//#endregion
export { ReadSSEOptions, SSEEvent, readSSE };