import type { Db } from '__PACKAGE__/db'
import { openDb } from '__PACKAGE__/db/sqlite'
import { fileURLToPath } from 'node:url'

export interface Note {
  id: number
  user_id: number
  title: string
  body: string
  updated_at: string
}

/** The folder of numbered SQL files (001-notes.sql, ...). Applied on start, each once, in one transaction. */
const MIGRATIONS = fileURLToPath(new URL('../migrations', import.meta.url))

/** Open the notes database and apply the migrations. Call `close` once, when the process stops. */
export function openNotesDb(path = process.env.NOTES_DB ?? 'data/notes.sqlite') {
  return openDb({ path, migrations: MIGRATIONS })
}

export function notesStore(db: Db) {
  return {
    list(userId: number, q = ''): Promise<Note[]> {
      const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`
      return db.all<Note>(
        `SELECT * FROM notes WHERE user_id = ? AND (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\') ORDER BY updated_at DESC, id DESC`,
        userId,
        like,
        like,
      )
    },
    get(userId: number, id: number): Promise<Note | undefined> {
      return db.get<Note>('SELECT * FROM notes WHERE id = ? AND user_id = ?', id, userId)
    },
    async create(userId: number, title: string, body: string): Promise<Note> {
      const note = await db.get<Note>(
        'INSERT INTO notes (user_id, title, body, updated_at) VALUES (?, ?, ?, ?) RETURNING *',
        userId,
        title,
        body,
        new Date().toISOString(),
      )
      return note!
    },
    update(userId: number, id: number, title: string, body: string): Promise<Note | undefined> {
      return db.get<Note>(
        'UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ? AND user_id = ? RETURNING *',
        title,
        body,
        new Date().toISOString(),
        id,
        userId,
      )
    },
    async remove(userId: number, id: number): Promise<boolean> {
      const { changes } = await db.run('DELETE FROM notes WHERE id = ? AND user_id = ?', id, userId)
      return changes > 0
    },
  }
}
