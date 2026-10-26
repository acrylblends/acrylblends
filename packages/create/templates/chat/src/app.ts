import { createApp } from './chat-app.ts'
import { openChatDb } from './db.ts'

/** The composition root: opens the database (once) and builds the app. `index.ts` serves it; the desktop shell does too, and calls `close` when it stops. */
const { db, close } = await openChatDb()

export { close }
export default createApp(db)
