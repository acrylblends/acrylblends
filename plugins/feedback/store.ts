/**
 * The notes people sent, in the app's own data: one JSON line per note in `notes.jsonl`, and the ids the builder has seen in `seen.json`. Appending
 * never rewrites a note, so a crash loses at most the note being written.
 */
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** The element a note was pinned on: a CSS selector to find it again, and a short name to show. */
export interface PinnedElement {
  readonly selector: string
  readonly label: string
}

export interface FeedbackNote {
  readonly id: string
  /** ISO time it was sent. */
  readonly at: string
  readonly text: string
  /** The page's path (and query) it was sent from. */
  readonly page: string
  /** Absent for "Nothing specific". */
  readonly element?: PinnedElement
  /** The builder has seen it in the frame. */
  readonly seen: boolean
}

export type NewNote = Pick<FeedbackNote, 'text' | 'page' | 'element'>

export const LIMITS = { text: 2000, page: 500, selector: 500, label: 120 } as const

/** A note as a page sent it, checked; a string says what is wrong. */
export function parseNewNote(body: unknown): NewNote | string {
  if (body === null || typeof body !== 'object') return 'send a JSON object'
  const { text, page, element } = body as Record<string, unknown>
  if (typeof text !== 'string' || text.trim() === '') return 'write a note'
  if (text.length > LIMITS.text) return `a note has at most ${LIMITS.text} characters`
  if (typeof page !== 'string' || !page.startsWith('/') || page.length > LIMITS.page) return 'the page must be a path'
  if (element === undefined || element === null) return { text: text.trim(), page }
  if (typeof element !== 'object') return 'the element must be an object'
  const { selector, label } = element as Record<string, unknown>
  if (typeof selector !== 'string' || selector === '' || selector.length > LIMITS.selector) return 'the element needs a selector'
  if (typeof label !== 'string' || label === '' || label.length > LIMITS.label) return 'the element needs a name'
  return { text: text.trim(), page, element: { selector, label } }
}

export class FeedbackStore {
  private readonly notesFile: string
  private readonly seenFile: string
  /** Writes one after another, so two notes never interleave in the file. */
  private queue: Promise<unknown> = Promise.resolve()

  constructor(dir: string) {
    this.notesFile = join(dir, 'notes.jsonl')
    this.seenFile = join(dir, 'seen.json')
  }

  add(note: NewNote, now: Date = new Date()): Promise<FeedbackNote> {
    const stored = { id: randomUUID(), at: now.toISOString(), ...note }
    return this.serial(async () => {
      await mkdir(join(this.notesFile, '..'), { recursive: true })
      await appendFile(this.notesFile, `${JSON.stringify(stored)}\n`)
      return { ...stored, seen: false }
    })
  }

  /** Every note, newest first. A line that is not a note is skipped. */
  async list(): Promise<FeedbackNote[]> {
    if (!existsSync(this.notesFile)) return []
    const seen = await this.seen()
    const notes: FeedbackNote[] = []
    for (const line of (await readFile(this.notesFile, 'utf8')).split('\n')) {
      if (line.trim() === '') continue
      try {
        const raw = JSON.parse(line) as Omit<FeedbackNote, 'seen'>
        if (typeof raw.id === 'string' && typeof raw.at === 'string' && typeof raw.text === 'string' && typeof raw.page === 'string')
          notes.push({ ...raw, seen: seen.has(raw.id) })
      } catch {
        // A torn last line: skipped.
      }
    }
    return notes.reverse()
  }

  markSeen(ids: readonly string[]): Promise<void> {
    return this.serial(async () => {
      const seen = await this.seen()
      for (const id of ids) seen.add(id)
      await mkdir(join(this.seenFile, '..'), { recursive: true })
      await writeFile(this.seenFile, JSON.stringify([...seen]))
    })
  }

  private async seen(): Promise<Set<string>> {
    try {
      const ids: unknown = JSON.parse(await readFile(this.seenFile, 'utf8'))
      return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [])
    } catch {
      return new Set()
    }
  }

  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work)
    this.queue = next.catch(() => {})
    return next
  }
}
