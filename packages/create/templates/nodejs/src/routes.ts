import { __CLASS__ } from '__PACKAGE__'
import { aboutPage, counterPage } from './page.tsx'

/** The routes, in a file that does not import the Node adapter, so browser code can import the type: `import type { AppType } from '../routes.ts'`. */
export const routes = new __CLASS__()
  .get('/', (c) => c.text('__CLASS__!'))
  .get('/about', (c) => c.html(aboutPage()))
  .get('/counter', (c) => c.html(counterPage()))

export type AppType = typeof routes
