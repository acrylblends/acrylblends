import { serve } from '__PACKAGE__/node-server'
import { openChatDb } from './db.ts'
import { createApp } from './chat-app.ts'

const port = Number(process.env.PORT || 3000)
// Local by default. Behind a reverse proxy on the same machine this is right; in a container set HOST=0.0.0.0.
const hostname = process.env.HOST || '127.0.0.1'

// The database is opened here, once, and closed when the process stops.
const { db, close } = await openChatDb()
const server = serve({ fetch: createApp(db).fetch, port, hostname }, (info) => {
  console.log(`listening on http://${info.address}:${info.port}`)
})

// Stop taking requests, let the ones in flight finish, then close the database and exit. A connection that never ends cannot keep the process alive past 10 seconds.
function shutdown(): void {
  server.close(() => {
    close().then(
      () => process.exit(0),
      (error) => {
        console.error(error)
        process.exit(1)
      },
    )
  })
  server.closeIdleConnections()
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
