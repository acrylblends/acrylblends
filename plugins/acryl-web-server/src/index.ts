/**
 * The `webServer` port for a framework-hosted app. DSH's driver rows (the chat's connection and its remote gateway) register node handlers with
 * `webServer.register` and `webServer.registerUpgrade`; this plugin serves them on the framework's own node server, so those rows run unchanged
 * while the HTTP host, the page and the client-module serving stay ours.
 *
 * It is the inverse of `acryl-router-http`: there the Host's web server serves a router prefix; here our node server presents the web-server
 * interface a DSH row expects. The surface is deliberately small: `host` and `port` (what `acryl-web` reads), `register` (exact or prefix),
 * `registerUpgrade` (one exact path), and the index taps the page serving applies. A row that needs more of DSH's interface gets the extra
 * method here, named with the row that needs it - so this seam can shrink when a row goes away.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import { Context, Service } from '@deepseek-ai/cordis'
import type { NodeServer, RawRoute, RawUpgradeRoute } from 'acryl-node-server'

/** Stable Cordis plugin name, equal to the package name and the Loader row id. */
export const name = 'acryl-web-server'

/** Hard requirement: the node server whose raw routes carry these handlers. */
export const inject = ['nodeServer']

/** A node handler at a path `exact` (the pathname itself) or a `prefix` (the path and everything below it). */
export interface WebServerRoute {
  readonly kind: 'prefix' | 'exact'
  readonly path: string
  readonly handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

/** One exact-path upgrade handler; the socket belongs to the handler once its path matches. */
export interface WebServerUpgradeRoute {
  readonly path: string
  readonly handler: (req: IncomingMessage, socket: Duplex, head: Buffer) => void | Promise<void>
}

/** Transforms the served index document, in registration order. */
export type IndexTap = (html: string) => string

/** What a driver row (or `acryl-web`) reads from `webServer`. */
export interface WebServerService {
  /** The address the node server bound. */
  readonly host: string
  readonly port: number
  /** Serve `route` until the returned remover runs or the calling plugin unloads. A path already served throws. */
  register(route: WebServerRoute): () => void
  /** Claim `route.path` for an upgrade until the returned remover runs or the calling plugin unloads. */
  registerUpgrade(route: WebServerUpgradeRoute): () => void
  /** Transform the served index document while the caller lives; returns its remover. */
  tapIndex(transform: IndexTap): () => void
  /** The document with every live transform applied, in registration order. */
  index(html: string): string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    webServer: WebServerService
  }
}

/** The port, backed by `nodeServer`'s raw routes; every registration belongs to the plugin that made it. */
export class WebServer extends Service implements WebServerService {
  private readonly taps: IndexTap[] = []

  constructor(ctx: Context) {
    super(ctx, 'webServer')
  }

  get host(): string {
    return this.ctx.nodeServer.hostname
  }

  get port(): number {
    return this.ctx.nodeServer.port
  }

  register(route: WebServerRoute): () => void {
    const remove = this.ctx.nodeServer.registerRaw(route as RawRoute)
    this.ctx.effect(() => () => { remove() }, `acryl-web-server: ${route.kind} ${route.path}`)
    return remove
  }

  registerUpgrade(route: WebServerUpgradeRoute): () => void {
    const remove = this.ctx.nodeServer.registerRawUpgrade(route as RawUpgradeRoute)
    this.ctx.effect(() => () => { remove() }, `acryl-web-server: upgrade ${route.path}`)
    return remove
  }

  tapIndex(transform: IndexTap): () => void {
    this.taps.push(transform)
    const remove = (): void => {
      const at = this.taps.indexOf(transform)
      if (at >= 0) this.taps.splice(at, 1)
    }
    this.ctx.effect(() => () => { remove() }, 'acryl-web-server: index tap')
    return remove
  }

  index(html: string): string {
    let document = html
    for (const tap of [...this.taps]) document = tap(document)
    return document
  }
}

/** Provide `webServer` on this context; the node server must already be up (the plugin injects it). */
export function apply(ctx: Context): void {
  new WebServer(ctx)
}

/** Re-exported for callers that shape their own routes: the raw types the port is built on. */
export type { NodeServer, RawRoute, RawUpgradeRoute }
