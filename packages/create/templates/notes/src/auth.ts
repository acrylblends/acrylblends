import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  length: number,
) => Promise<Buffer>

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, 64)
  return `${salt.toString('hex')}:${key.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(':')
  if (!salt || !key) return false
  const expected = Buffer.from(key, 'hex')
  const actual = await scryptAsync(password, Buffer.from(salt, 'hex'), expected.length)
  return timingSafeEqual(actual, expected)
}

export function authStore(db: DatabaseSync) {
  return {
    findUser(email: string) {
      return db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email) as
        | { id: number; email: string; password_hash: string }
        | undefined
    },
    async createUser(email: string, password: string): Promise<number> {
      const info = db
        .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
        .run(email, await hashPassword(password))
      return Number(info.lastInsertRowid)
    },
    startSession(userId: number): string {
      const token = randomBytes(32).toString('hex')
      db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, userId)
      return token
    },
    userFor(token: string | undefined) {
      if (!token) return undefined
      return db
        .prepare(
          'SELECT users.id AS id, users.email AS email FROM sessions JOIN users ON users.id = sessions.user_id WHERE token = ?',
        )
        .get(token) as { id: number; email: string } | undefined
    },
    endSession(token: string) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
    },
  }
}
