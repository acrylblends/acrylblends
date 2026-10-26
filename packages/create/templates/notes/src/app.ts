import { openNotesDb } from './db.ts'
import { createApp } from './notes-app.ts'

/** The composition root: opens the database (once) and builds the app. `index.ts` serves it; the desktop shell does too, and calls `close` when it stops. */
const { db, close } = await openNotesDb()

export { close }
export default createApp(db)
