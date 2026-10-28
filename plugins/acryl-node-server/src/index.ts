/**
 * The framework's standalone HTTP adapter (spec 046, ported in spec 047), the standalone counterpart of the Host adapter. It owns one
 * `node:http` server built by the ported adapter in `src/adapter/` and hands every request to `ctx.router.fetch`, with the socket's peer
 * address and local port as connection facts.
 * Use it in an app that runs without the ACRYL Host; inside the Host, `acryl-router-http` mounts prefixes on the Host's own web server.
 * One adapter per runtime: a plugin keeps asking `ctx.inject(['routerHttp'], ...)` for a mount, which simply never fires here, because this
 * adapter serves the whole router.
 *
 * A configured port that is taken is followed by the next free one, at most `scan` further ports; port 0 lets the system choose. Disposal ends
 * open streams, closes every connection and returns once the port is free.
 */

import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from 'acryl-router'
import { Request as AdapterRequest } from './adapter/request.ts'
import { createAdaptorServer } from './adapter/server.ts'
import { UpgradeHub, type UpgradeHubOptions } from './upgrade-hub.ts'
import type { UpgradeWebSocket } from 'acryl-router/helpers'
import type { WebSocketLike } from './adapter/websocket-types.ts'

export { serveStatic, type ServeStaticOptions } from './adapter/serve-static.ts'
export { RequestError } from './adapter/request.ts'
export { testWebSocket, type TestSocket, type TestWebSocketOptions, type TestWebSocketResult } from './test-websocket.ts'
export { UpgradeEmitter, UpgradeHub, type UpgradeHubOptions, type UpgradeRouter } from './upgrade-hub.ts'

/** Stable Cordis plugin name, equal to the package name and the Loader row id. */
export const name = 'acryl-node-server'
export const inject = ['router']

export interface Config {
  hostname: string
  port: number
  scan: number
  /** Limits of WebSocket upgrades (`upgrades()`); the defaults suit most apps. */
  websocket: UpgradeHubOptions
}

/** Every field has a default, so a caller passes only what it changes: `ctx.plugin(plugin, { ... })` takes the partial shape. */
export const Config: z<Partial<Config>, Config> = z.object({
  hostname: z.string().default('127.0.0.1').description('Address to bind. Loopback by default; binding elsewhere exposes the app to the network.'),
  port: z.number().min(0).max(65535).default(0).description('Port to listen on; 0 lets the system choose. A taken port is followed by the next free one.'),
  scan: z.number().min(0).default(20).description('How many further ports to try when the configured one is taken.'),
  websocket: z
    .object({
      maxPayload: z.number().min(1).default(1024 * 1024).description('The largest WebSocket frame accepted, in bytes; a bigger one closes the socket with 1009.'),
      heartbeat: z.number().min(0).default(30_000).description('Milliseconds between pings; a peer that did not answer the last one is terminated. 0 turns it off.'),
      grace: z.number().min(0).default(2000).description('Milliseconds a closing socket gets before it is terminated when its plugin unloads.'),
    })
    .default({}),
})

declare module '@deepseek-ai/cordis' {
  interface Context {
    nodeServer: NodeServer
  }
}

export class NodeServer extends Service {
  readonly hostname: string
  readonly config: Config
  private readonly server: Server
  private hub: UpgradeHub | undefined
  private bound = 0

  constructor(ctx: Context, config: Config) {
    super(ctx, 'nodeServer')
    this.config = config
    this.hostname = config.hostname
    const router = ctx.router
    // The handler sees the router's bindings (`c.env.connection`), not the raw `incoming`/`outgoing` pair. The global `Request` and
    // `Response` stay the platform's, because this adapter shares its process with the rest of the app; so the adapter's lightweight
    // request is made a real one (its signal still aborts when the client goes away) before the router re-creates it with its own signal.
    this.server = createAdaptorServer({
      fetch: (request, { incoming }) => router.fetch(new AdapterRequest(request), { remoteAddress: incoming.socket.remoteAddress, localPort: incoming.socket.localPort }),
      hostname: config.hostname,
      overrideGlobalObjects: false,
    }) as Server
    ctx.effect(() => async () => {
      await this.hub?.close()
      this.server.closeAllConnections()
      if (this.server.listening) await new Promise<void>(resolve => { this.server.close(() => { resolve() }) })
    }, 'acryl-node-server: close listener and open connections')
  }

  /**
   * `upgradeWebSocket` for the plugin that asks (call it once, in `apply`): `app.get('/ws', upgrade((c) => ({ onMessage(event, ws) { ... } })))`. Checks go in ordinary middleware on the
   * route, and a handler that returns a `Response` refuses the upgrade with that status before any handshake. Every socket it accepts belongs to the calling plugin: when the plugin
   * unloads they are closed with 1001 within `websocket.grace` and the handler sees `close` once. Pass `{ textOnly: true }` to drop binary frames. Needs the `ws` package.
   */
  upgrades(): UpgradeWebSocket<WebSocketLike> {
    if (!this.hub) {
      this.hub = new UpgradeHub(this.config.websocket)
      this.hub.attach(this.server, this.ctx.router)
    }
    return this.hub.upgradeWebSocketFor(this.ctx)
  }

  /** How many WebSocket connections are open now. */
  get sockets(): number {
    return this.hub?.size ?? 0
  }

  /** The port in use, 0 before the server listens. */
  get port(): number {
    return this.bound
  }

  /** The address clients use. */
  get url(): string {
    return `http://${this.hostname.includes(':') ? `[${this.hostname}]` : this.hostname}:${String(this.bound)}`
  }

  /** Bind, scanning past taken ports. */
  async listen(): Promise<void> {
    const { port, scan, hostname } = this.config
    const last = port === 0 ? 0 : Math.min(65535, port + scan)
    for (let candidate = port; candidate <= last; candidate += 1) {
      try {
        await new Promise<void>((resolve, reject) => {
          const onError = (error: Error): void => { reject(error) }
          this.server.once('error', onError)
          this.server.listen(candidate, hostname, () => { this.server.off('error', onError); resolve() })
        })
        this.bound = (this.server.address() as AddressInfo).port
        return
      } catch (error) {
        if (!isPortUnavailable(error)) throw error
      }
    }
    throw new Error(`acryl-node-server: no free port from ${String(port)} to ${String(last)} on ${hostname}`)
  }
}

/**
 * Whether a failed bind means "this port, try the next one". A port another socket holds answers `EADDRINUSE` everywhere. On Windows a port
 * inside a range the system reserves (Hyper-V, WSL and Docker exclude ranges, `netsh interface ipv4 show excludedportrange`) answers
 * `EACCES`, which is a property of that port too; elsewhere `EACCES` means the process may not bind low ports at all, so moving on would
 * only hide the reason.
 */
export function isPortUnavailable(error: unknown, platform: NodeJS.Platform = process.platform): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  return code === 'EADDRINUSE' || (platform === 'win32' && code === 'EACCES')
}

/** Loads once the server listens, so a plugin that injects `nodeServer` can rely on `url`. A failure to bind fails the plugin. */
export async function apply(ctx: Context, config: Partial<Config> = {}): Promise<void> {
  const server = new NodeServer(ctx, { hostname: '127.0.0.1', port: 0, scan: 20, websocket: {}, ...config })
  await server.listen()
}
