import { DatabaseSync } from 'node:sqlite'

export interface Note {
  id: number
  user_id: number
  title: string
  body: string
  updated_at: string
}

export function openDb(path = process.env.NOTES_DB ?? 'notes.db'): DatabaseSync {
  const db = new DatabaseSync(path)
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
  return db
}

export function notesStore(db: DatabaseSync) {
  return {
    list(userId: number, q = ''): Note[] {
      const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`
      return db
        .prepare(
          `SELECT * FROM notes WHERE user_id = ? AND (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\') ORDER BY updated_at DESC, id DESC`,
        )
        .all(userId, like, like) as unknown as Note[]
    },
    get(userId: number, id: number): Note | undefined {
      return db
        .prepare('SELECT * FROM notes WHERE id = ? AND user_id = ?')
        .get(id, userId) as unknown as Note | undefined
    },
    create(userId: number, title: string, body: string): Note {
      const info = db
        .prepare('INSERT INTO notes (user_id, title, body, updated_at) VALUES (?, ?, ?, ?)')
        .run(userId, title, body, new Date().toISOString())
      return this.get(userId, Number(info.lastInsertRowid))!
    },
    update(userId: number, id: number, title: string, body: string): Note | undefined {
      db.prepare(
        'UPDATE notes SET title = ?, body = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      ).run(title, body, new Date().toISOString(), id, userId)
      return this.get(userId, id)
    },
    remove(userId: number, id: number): boolean {
      return (
        Number(
          db.prepare('DELETE FROM notes WHERE id = ? AND user_id = ?').run(id, userId).changes,
        ) > 0
      )
    },
  }
}
