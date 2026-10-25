import { serve } from '__PACKAGE__/node-server'
import app from './app.ts'

const server = serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) }, (info) => {
  console.log(`listening on http://localhost:${info.port}`)
})

process.once('SIGINT', () => server.close(() => process.exit(0)))
process.once('SIGTERM', () => server.close(() => process.exit(0)))
