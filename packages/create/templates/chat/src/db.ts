import { DatabaseSync } from 'node:sqlite'

export interface Message {
  id: number
  conversation_id: number
  role: 'user' | 'assistant'
  content: string
}
export interface Conversation {
  id: number
  title: string
}

export function openDb(path = process.env.CHAT_DB ?? 'chat.db'): DatabaseSync {
  const db = new DatabaseSync(path)
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS conversations (id INTEGER PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL
    );
  `)
  return db
}

export function chatStore(db: DatabaseSync) {
  return {
    conversations: () =>
      db
        .prepare('SELECT id, title FROM conversations ORDER BY id DESC')
        .all() as unknown as Conversation[],
    conversation: (id: number) =>
      db.prepare('SELECT id, title FROM conversations WHERE id = ?').get(id) as unknown as
        | Conversation
        | undefined,
    messages: (id: number) =>
      db
        .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY id')
        .all(id) as unknown as Message[],
    start(title: string): number {
      const info = db
        .prepare('INSERT INTO conversations (title, created_at) VALUES (?, ?)')
        .run(title.slice(0, 60), new Date().toISOString())
      return Number(info.lastInsertRowid)
    },
    add(conversationId: number, role: Message['role'], content: string) {
      db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)').run(
        conversationId,
        role,
        content,
      )
    },
    remove: (id: number) =>
      Number(db.prepare('DELETE FROM conversations WHERE id = ?').run(id).changes) > 0,
  }
}
