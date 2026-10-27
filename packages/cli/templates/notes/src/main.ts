import { fileURLToPath } from 'node:url'
import { selectInstance } from '../plugins/instance/index.ts'
import { createApp } from './app.ts'

// The composition root: the one place that reads the environment and chooses where the app lives.
const chosen = selectInstance({
  projectRoot: fileURLToPath(new URL('..', import.meta.url)),
  // PORT and HOST are the names hosting platforms set; ACRYLBLENDS_PORT and ACRYLBLENDS_HOST win when both are given.
  env: {
    ...(process.env.PORT ? { ACRYLBLENDS_PORT: process.env.PORT } : {}),
    ...(process.env.HOST ? { ACRYLBLENDS_HOST: process.env.HOST } : {}),
    ...process.env,
  },
})
const app = await createApp(chosen, {
  ...(process.env.NOTES_DB ? { database: process.env.NOTES_DB } : {}),
})
console.log(`listening on ${app.url} (data in ${chosen.home})`)

// Stop taking requests, let the ones in flight finish, then close the database (the db plugin does, when it is disposed) and exit.
const stop = async () => {
  const timer = setTimeout(() => process.exit(1), 10_000)
  timer.unref()
  await app.stop()
  process.exit(0)
}
process.once('SIGINT', stop)
process.once('SIGTERM', stop)
