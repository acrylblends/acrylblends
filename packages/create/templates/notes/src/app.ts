import { openDb } from './db.ts'
import { createApp } from './notes-app.ts'

/** The database is opened here, once, so the server can close it when it stops. */
export const db = openDb()

export default createApp(db)
