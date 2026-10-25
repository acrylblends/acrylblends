import { __CLASS__ } from '__PACKAGE__'
import { clientModules } from '__PACKAGE__/node-server'
import { routes } from './routes.ts'

// Client components without a bundler: src/client is compiled when the browser asks; `npm run build` compiles it once for production (NODE_ENV=production serves only dist/client).
const app = new __CLASS__()
  .route('/', routes)
  .route('/client', clientModules({ root: 'src/client', compiled: 'dist/client' }))

export default app
