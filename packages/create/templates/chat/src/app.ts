import { createApp } from './chat-app.ts'
import { openDb } from './db.ts'

export const db = openDb()

export default createApp(db)
