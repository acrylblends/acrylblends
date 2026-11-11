/**
 * Settings > Plugins > Graph: every plugin of the running app (and of the frame around it) as a picture, with how they depend on each other, and a line for
 * each change as it happens. Ported from cordis-plugin-graph's `GraphTab.tsx` (MIT, commit e9bf6b5): the planes, the three relation toggles, the filter, the
 * counts and the detail card are its. New here: the picture is updated in place and the Host's fiber events arrive by a waiting request, not by asking every
 * two seconds; a changed plugin pulses; the strip lists the changes; the card says who a plugin needs and who needs it; and a plugin's code opens in the
 * Files tab from the card.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { EdgeKind, GraphEvent, GraphNode, GraphSnapshot, NodePhase } from '../graph-contract.ts'
import type { GraphApi } from './graph-api.ts'
import { EDGE_COLOR, GraphCanvas, PHASE_COLOR, nodeId, readPalette, toElements, type EdgeFilter, type PulseKind } from './graph-canvas.ts'
import { eventLine, phaseCounts, pulseOf, relationsOf } from './graph-model.ts'
import { installGraphStyles } from './graph-styles.ts'

/** The browser's own Cordis context, as the view reads it: its graph now, and each fiber change as it happens. */
export interface ClientGraph {
  inspect(): GraphSnapshot
  subscribe(listener: (event: Omit<GraphEvent, 'seq' | 'at'>) => void): () => void
}

export interface GraphViewInjected {
  readonly api: GraphApi
  /** Absent where the browser's context cannot be read: the client plane is then not offered. */
  readonly client?: ClientGraph
  /** Open a file of the app (a path from the app's folder) in the Files tab. */
  readonly openSource: (path: string) => void
}

type Plane = 'host' | 'client' | 'both'
const PLANE_LABEL: Record<Plane, string> = { host: 'app', client: 'browser', both: 'both' }
const EDGE_KINDS: readonly EdgeKind[] = ['inject', 'provider', 'nesting']
const EDGE_LABEL: Record<EdgeKind, string> = { inject: 'requires (inject)', provider: 'provides to', nesting: 'nested in (Loader tree)' }
const STRIP_LENGTH = 40
const REFRESH_DELAY_MS = 150
const RETRY_MS = 3000

interface StripEntry {
  readonly key: string
  readonly at: number
  readonly plane: 'host' | 'client'
  readonly uid: number
  readonly text: string
  readonly pulse: PulseKind
}

type Live = 'connecting' | 'live' | 'lost'

const prefixOf = (plane: 'host' | 'client'): string => (plane === 'host' ? 'h-' : 'c-')

export function GraphView({ api, client, openSource }: GraphViewInjected) {
  const root = useRef<HTMLDivElement>(null)
  const holder = useRef<HTMLDivElement>(null)
  const canvas = useRef<GraphCanvas | null>(null)
  const waiting = useRef(new Map<string, PulseKind>())

  const [plane, setPlane] = useState<Plane>('host')
  const [host, setHost] = useState<GraphSnapshot | undefined>(undefined)
  const [local, setLocal] = useState<GraphSnapshot | undefined>(undefined)
  const [problem, setProblem] = useState<string | undefined>(undefined)
  const [live, setLive] = useState<Live>('connecting')
  const [filter, setFilter] = useState<EdgeFilter>({ inject: true, provider: false, nesting: true })
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | undefined>(undefined)
  const [strip, setStrip] = useState<readonly StripEntry[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => installGraphStyles(), [])

  const note = useCallback((from: 'host' | 'client', event: Omit<GraphEvent, 'seq' | 'at'> & { readonly seq?: number; readonly at?: number }) => {
    const pulse = pulseOf(event)
    waiting.current.set(`${prefixOf(from)}f${String(event.uid)}`, pulse)
    const at = event.at ?? Date.now()
    setStrip(current => [{ key: `${from}:${String(event.seq ?? at)}:${String(current.length)}`, at, plane: from, uid: event.uid, text: eventLine(event), pulse }, ...current].slice(0, STRIP_LENGTH))
  }, [])

  // The Host's graph, and its fiber events: asked for once, then a request that the Host answers when a fiber changes.
  const refreshHost = useRef<() => void>(() => {})
  useEffect(() => {
    let stopped = false
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const read = async (): Promise<number | undefined> => {
      try {
        const view = await api.read()
        if (stopped) return undefined
        setHost(view.snapshot)
        setProblem(undefined)
        return view.seq
      } catch (cause) {
        if (!stopped) setProblem(cause instanceof Error ? cause.message : 'The plugin graph could not be read.')
        return undefined
      }
    }
    refreshHost.current = () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => { void read() }, REFRESH_DELAY_MS)
    }
    const listen = async (): Promise<void> => {
      let after = await read()
      while (!stopped && after === undefined) {
        setLive('lost')
        await new Promise<void>(done => setTimeout(done, RETRY_MS))
        after = stopped ? 0 : await read()
      }
      if (!stopped && after !== undefined) setLive('live')
      while (!stopped && after !== undefined) {
        try {
          const answer = await api.events(after, controller.signal)
          if (stopped) return
          after = answer.seq
          setLive('live')
          if (answer.events.length > 0) {
            for (const event of answer.events) note('host', event)
            refreshHost.current()
          }
        } catch {
          if (stopped) return
          setLive('lost')
          await new Promise<void>(done => setTimeout(done, RETRY_MS))
        }
      }
    }
    void listen()
    return () => {
      stopped = true
      controller.abort()
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [api, note])

  // The browser's own graph: read now, and again (a moment after) whenever one of its fibers changes.
  const refreshClient = useRef<() => void>(() => {})
  useEffect(() => {
    if (client === undefined) return undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const read = (): void => {
      try { setLocal(client.inspect()) } catch { setLocal(undefined) }
    }
    refreshClient.current = () => {
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(read, REFRESH_DELAY_MS)
    }
    read()
    const off = client.subscribe((event) => {
      note('client', event)
      refreshClient.current()
    })
    return () => {
      off()
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [client, note])

  const elements = useMemo(() => [
    ...(plane !== 'client' && host !== undefined ? toElements(host, filter, 'h-') : []),
    ...(plane !== 'host' && local !== undefined ? toElements(local, filter, 'c-') : []),
  ], [plane, host, local, filter])

  // The picture: made once, in the theme's colours, and made again in them when the theme changes.
  useEffect(() => {
    const element = holder.current
    if (element === null) return undefined
    const drawn = new GraphCanvas(element, readPalette(element), setSelected)
    canvas.current = drawn
    const observer = new MutationObserver(() => { drawn.setPalette(readPalette(element)) })
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
    return () => {
      observer.disconnect()
      drawn.destroy()
      canvas.current = null
    }
  }, [])

  useEffect(() => {
    const drawn = canvas.current
    if (drawn === null) return
    drawn.update(elements)
    for (const [id, pulse] of waiting.current) drawn.pulse(id, pulse)
    waiting.current.clear()
  }, [elements])

  // Another set of planes is another picture: it fits the box (after the update above has laid it out).
  useEffect(() => { canvas.current?.fit() }, [plane])

  useEffect(() => {
    const drawn = canvas.current
    if (drawn === null) return
    if (selected !== undefined) drawn.focus(selected)
    else drawn.search(query)
  }, [selected, query, elements])

  const nodeOf = useCallback((id: string | undefined): { readonly node: GraphNode; readonly snapshot: GraphSnapshot } | undefined => {
    if (id === undefined) return undefined
    const snapshot = id.startsWith('h-') ? host : id.startsWith('c-') ? local : undefined
    const uid = Number(id.slice(id.indexOf('f') + 1))
    const node = snapshot?.nodes.find(candidate => candidate.uid === uid)
    return snapshot === undefined || node === undefined ? undefined : { node, snapshot }
  }, [host, local])

  const chosen = nodeOf(selected)
  // A selected plugin that is gone (its fiber was replaced when the app reloaded) is no longer selected, so the filter shows again.
  useEffect(() => {
    if (selected === undefined || nodeOf(selected) !== undefined) return
    if (selected.startsWith('h-') ? host !== undefined : local !== undefined) setSelected(undefined)
  }, [selected, nodeOf, host, local])
  const relations = chosen === undefined ? undefined : relationsOf(chosen.snapshot, chosen.node.uid)
  const prefixOfSelected = selected === undefined ? 'h-' : selected.slice(0, 2)
  const counts = phaseCounts([plane !== 'client' ? host : undefined, plane !== 'host' ? local : undefined])
  const nodeCount = elements.filter(element => !('source' in element.data)).length
  const edgeCount = elements.length - nodeCount

  const copyPath = (path: string): void => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(path)
        setCopied(true)
        setTimeout(() => { setCopied(false) }, 1500)
      } catch {
        // The path is shown as text: it can be selected by hand.
      }
    })()
  }

  return (
    <div className="acrylBlendsGraph" ref={root}>
      <div className="acrylBlendsGraphBar">
        <strong>Cordis plugin graph</strong>
        <span className="acrylBlendsGraphCount">{nodeCount} fibers · {edgeCount} relations</span>
        <span className="acrylBlendsGraphLive" data-live={live} title={live === 'live' ? 'Changes arrive as they happen' : live === 'lost' ? 'The app is not answering; trying again' : 'Connecting'}>
          {live === 'live' ? 'live' : live === 'lost' ? 'reconnecting' : 'connecting'}
        </span>
        {client !== undefined && (
          <span className="acrylBlendsGraphPlanes" role="group" aria-label="Which plugins">
            {(['host', 'client', 'both'] as const).map(candidate => (
              <button key={candidate} type="button" aria-pressed={plane === candidate} onClick={() => { setPlane(candidate); setSelected(undefined) }}>{PLANE_LABEL[candidate]}</button>
            ))}
          </span>
        )}
        <button type="button" className="acrylBlendsGraphButton" onClick={() => { refreshHost.current(); refreshClient.current() }}>Recapture</button>
        <button type="button" className="acrylBlendsGraphButton" onClick={() => { canvas.current?.fit() }}>Fit</button>
      </div>
      <div className="acrylBlendsGraphBar">
        {EDGE_KINDS.map(kind => (
          <label key={kind} className="acrylBlendsGraphToggle">
            <input type="checkbox" checked={filter[kind]} onChange={(event) => { setFilter(current => ({ ...current, [kind]: event.target.checked })) }} />
            <span style={{ color: EDGE_COLOR[kind] }}>■</span> {EDGE_LABEL[kind]}
          </label>
        ))}
        <input className="acrylBlendsSearch acrylBlendsGraphSearch" type="search" aria-label="Filter plugins" placeholder="filter by name / module" value={query} onChange={(event) => { setQuery(event.target.value); setSelected(undefined) }} />
      </div>
      <div className="acrylBlendsGraphLegend">
        {[...counts].map(([phase, count]) => (
          <span key={phase}><span style={{ color: PHASE_COLOR[phase as NodePhase] }}>●</span> {phase} ({count})</span>
        ))}
        <span className="acrylBlendsGraphDim">Ctrl or Cmd + scroll to zoom, drag to move</span>
      </div>
      {problem !== undefined && <p className="acrylBlendsNote" data-error>{problem}</p>}
      <div className="acrylBlendsGraphBody">
        <div className="acrylBlendsGraphCanvas" ref={holder} aria-label="Plugin graph" />
        <aside className="acrylBlendsGraphSide">
          {chosen !== undefined && relations !== undefined && (
            <div className="acrylBlendsGraphCard" aria-label={`Plugin ${chosen.node.name}`}>
              <b>{chosen.node.name}</b>
              <dl>
                <dt>uid</dt><dd>{chosen.node.uid}</dd>
                <dt>phase</dt><dd><span style={{ color: PHASE_COLOR[chosen.node.phase] }}>●</span> {chosen.node.phase}{chosen.node.enabled ? '' : ' (row off)'}</dd>
                <dt>module</dt><dd>{chosen.node.moduleName ?? '—'}</dd>
                <dt>entry id</dt><dd>{chosen.node.loaderEntryId ?? '—'}</dd>
              </dl>
              <div className="acrylBlendsGraphSource">
                {chosen.node.source === undefined
                  ? <span className="acrylBlendsGraphDim">Source: not found (part of the runtime this plugin comes from).</span>
                  : (
                    <>
                      <span className="acrylBlendsGraphDim">{chosen.node.source.inApp === undefined ? 'Outside this app:' : 'In this app:'}</span>
                      <code className="acrylBlendsGraphPath">{chosen.node.source.file}</code>
                      <span className="acrylBlendsGraphActions">
                        {chosen.node.source.inApp !== undefined && (
                          <button type="button" className="acrylBlendsGraphButton" onClick={() => { openSource(chosen.node.source?.inApp ?? '') }}>Open source</button>
                        )}
                        <button type="button" className="acrylBlendsGraphButton" onClick={() => { copyPath(chosen.node.source?.file ?? '') }}>{copied ? 'Copied' : 'Copy path'}</button>
                      </span>
                    </>
                  )}
              </div>
              {chosen.node.provides.length > 0 && (
                <>
                  <h4>provides ({chosen.node.provides.length})</h4>
                  <ul>{chosen.node.provides.map(service => <li key={service}><code>{service}</code></li>)}</ul>
                </>
              )}
              {(relations.requires.length > 0 || relations.missing.length > 0) && (
                <>
                  <h4>needs ({relations.requires.length + relations.missing.length})</h4>
                  <ul>
                    {relations.requires.map(item => (
                      <li key={`${item.service}:${String(item.node.uid)}`}>
                        <code>{item.service}</code> from{' '}
                        <button type="button" className="acrylBlendsGraphLink" onClick={() => { setSelected(nodeId(prefixOfSelected, item.node.uid)); canvas.current?.centre(nodeId(prefixOfSelected, item.node.uid)) }}>{item.node.name}</button>
                      </li>
                    ))}
                    {relations.missing.map(service => <li key={`missing:${service}`}><code>{service}</code> <span className="acrylBlendsGraphWarn">waiting: nothing provides it</span></li>)}
                  </ul>
                </>
              )}
              {relations.usedBy.length > 0 && (
                <>
                  <h4>used by ({relations.usedBy.length})</h4>
                  <ul>
                    {relations.usedBy.map(item => (
                      <li key={`${item.service}:${String(item.node.uid)}`}>
                        <button type="button" className="acrylBlendsGraphLink" onClick={() => { setSelected(nodeId(prefixOfSelected, item.node.uid)); canvas.current?.centre(nodeId(prefixOfSelected, item.node.uid)) }}>{item.node.name}</button> via <code>{item.service}</code>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {chosen.node.effects.length > 0 && (
                <>
                  <h4>effects ({chosen.node.effects.length})</h4>
                  <ul>{chosen.node.effects.slice(0, 40).map((effect, index) => <li key={`${String(index)}:${effect}`}><code>{effect}</code></li>)}</ul>
                </>
              )}
            </div>
          )}
          <div className="acrylBlendsGraphStrip" aria-label="Changes as they happen">
            <h4>changes, as they happen</h4>
            {strip.length === 0
              ? <span className="acrylBlendsGraphDim">Nothing has changed since this opened. Switch a plugin off in the list, or ask the agent for one, and it shows here.</span>
              : (
                <ul>
                  {strip.map(entry => (
                    <li key={entry.key} data-pulse={entry.pulse}>
                      <span className="acrylBlendsGraphTime">{new Date(entry.at).toLocaleTimeString()}</span>{' '}
                      <button type="button" className="acrylBlendsGraphLink" onClick={() => { const id = nodeId(prefixOf(entry.plane), entry.uid); setSelected(id); canvas.current?.centre(id) }}>{entry.text}</button>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </aside>
      </div>
    </div>
  )
}
