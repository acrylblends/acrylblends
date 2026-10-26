import type { Context } from '__PACKAGE__'
import { __CLASS__ } from '__PACKAGE__'
import { deleteCookie, getCookie, setCookie } from '__PACKAGE__/cookie'
import { csrf } from '__PACKAGE__/csrf'
import type { Db } from '__PACKAGE__/db'
import { createMiddleware } from '__PACKAGE__/factory'
import { HTTPException } from '__PACKAGE__/http-exception'
import { clientModules } from '__PACKAGE__/node-server'
import { schemaValidator } from '__PACKAGE__/schema-validator'
import { authStore, verifyPassword } from './auth.ts'
import { notesStore } from './db.ts'
import { checkCredentials, checkNote, NoteSchema } from './schema.ts'
import { authPage, formPage, listPage } from './views.tsx'

type Env = { Variables: { user: { id: number; email: string } } }

const COOKIE = 'sid'
const MONTH = 60 * 60 * 24 * 30

export interface AppOptions {
  /** Believe `X-Forwarded-Proto` (set it when a reverse proxy you run terminates HTTPS in front of the app). Default: the TRUST_PROXY=1 environment variable. */
  trustProxy?: boolean
  /** The address people use in the browser, for example `https://notes.example.com`. Behind a proxy the app sees `http://127.0.0.1:3000`, so csrf needs it. Default: PUBLIC_ORIGIN. */
  publicOrigin?: string
}

export function createApi(db: Db) {
  const auth = authStore(db)
  const notes = notesStore(db)
  return new __CLASS__<Env>()
    .use(async (c, next) => {
      const user = await auth.userFor(getCookie(c, COOKIE))
      if (!user) return c.json({ error: 'Log in first.' }, 401)
      c.set('user', user)
      await next()
    })
    .get('/', async (c) =>
      c.json({ notes: await notes.list(c.get('user').id, c.req.query('q') ?? '') }, 200),
    )
    .post('/', schemaValidator('json', NoteSchema), async (c) =>
      c.json(
        {
          note: await notes.create(
            c.get('user').id,
            c.req.valid('json').title,
            c.req.valid('json').body,
          ),
        },
        201,
      ),
    )
    .get('/:id', async (c) => {
      const note = await notes.get(c.get('user').id, Number(c.req.param('id')))
      return note ? c.json({ note }, 200) : c.json({ error: 'No such note.' }, 404)
    })
    .put('/:id', schemaValidator('json', NoteSchema), async (c) => {
      const { title, body } = c.req.valid('json')
      const note = await notes.update(c.get('user').id, Number(c.req.param('id')), title, body)
      return note ? c.json({ note }, 200) : c.json({ error: 'No such note.' }, 404)
    })
    .delete('/:id', async (c) =>
      (await notes.remove(c.get('user').id, Number(c.req.param('id'))))
        ? c.json({ ok: true }, 200)
        : c.json({ error: 'No such note.' }, 404),
    )
}

export type Api = ReturnType<typeof createApi>

export function createApp(
  db: Db,
  {
    trustProxy = process.env.TRUST_PROXY === '1',
    publicOrigin = process.env.PUBLIC_ORIGIN,
  }: AppOptions = {},
) {
  const auth = authStore(db)
  const notes = notesStore(db)
  const app = new __CLASS__<Env>()
  // Refuses a form POST that does not come from this site (checks Origin and Sec-Fetch-Site); JSON requests are not form-shaped and pass.
  app.use(csrf(publicOrigin ? { origin: [publicOrigin] } : undefined))
  // A secure cookie is only sent over HTTPS: set when the request is HTTPS, or a proxy we trust says it was.
  const session = (c: Context<Env>) => ({
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
    maxAge: MONTH,
    secure:
      new URL(c.req.url).protocol === 'https:' ||
      (trustProxy && c.req.header('x-forwarded-proto') === 'https'),
  })
  // The log has the stack; the page never does.
  app.onError((error, c) => {
    if (error instanceof HTTPException) return error.getResponse()
    console.error(error)
    return c.text('Internal Server Error', 500)
  })

  const requireUser = createMiddleware<Env>(async (c, next) => {
    const user = await auth.userFor(getCookie(c, COOKIE))
    if (!user) return c.redirect('/login')
    c.set('user', user)
    await next()
  })

  app.get('/', (c) => c.redirect('/notes'))
  app.get('/signup', (c) => c.html(authPage('signup')))
  app.get('/login', (c) => c.html(authPage('login')))

  app.post('/signup', async (c) => {
    const form = await c.req.parseBody()
    const email = String(form.email ?? '')
      .trim()
      .toLowerCase()
    const errors = checkCredentials(email, form.password, true)
    if (errors.length === 0 && (await auth.findUser(email)))
      errors.push('That email already has an account. Log in instead.')
    if (errors.length > 0) return c.html(authPage('signup', errors, email), 400)
    const id = await auth.createUser(email, String(form.password))
    setCookie(c, COOKIE, await auth.startSession(id), session(c))
    return c.redirect('/notes', 303)
  })

  app.post('/login', async (c) => {
    const form = await c.req.parseBody()
    const email = String(form.email ?? '')
      .trim()
      .toLowerCase()
    const errors = checkCredentials(email, form.password, false)
    if (errors.length > 0) return c.html(authPage('login', errors, email), 400)
    const user = await auth.findUser(email)
    if (!user || !(await verifyPassword(String(form.password), user.password_hash)))
      return c.html(authPage('login', ['Wrong email or password.'], email), 401)
    setCookie(c, COOKIE, await auth.startSession(user.id), session(c))
    return c.redirect('/notes', 303)
  })

  app.post('/logout', async (c) => {
    const token = getCookie(c, COOKIE)
    if (token) await auth.endSession(token)
    deleteCookie(c, COOKIE, { path: '/' })
    return c.redirect('/login', 303)
  })

  app.use('/notes/*', requireUser)
  app.use('/notes', requireUser)

  app.get('/notes', async (c) => {
    const q = (c.req.query('q') ?? '').trim()
    return c.html(listPage(c.get('user').email, await notes.list(c.get('user').id, q), q))
  })
  app.get('/notes/new', (c) =>
    c.html(formPage(c.get('user').email, '/notes', { title: '', body: '' })),
  )
  app.post('/notes', async (c) => {
    const form = await c.req.parseBody()
    const checked = checkNote(form)
    if ('issues' in checked)
      return c.html(
        formPage(
          c.get('user').email,
          '/notes',
          { title: String(form.title ?? ''), body: String(form.body ?? '') },
          checked.issues.map((i) => i.message),
        ),
        400,
      )
    await notes.create(c.get('user').id, checked.value.title, checked.value.body)
    return c.redirect('/notes', 303)
  })
  app.get('/notes/:id/edit', async (c) => {
    const note = await notes.get(c.get('user').id, Number(c.req.param('id')))
    return note
      ? c.html(formPage(c.get('user').email, `/notes/${note.id}`, note))
      : c.html(listPage(c.get('user').email, [], ''), 404)
  })
  app.post('/notes/:id', async (c) => {
    const id = Number(c.req.param('id'))
    const form = await c.req.parseBody()
    const checked = checkNote(form)
    if ('issues' in checked)
      return c.html(
        formPage(
          c.get('user').email,
          `/notes/${id}`,
          { title: String(form.title ?? ''), body: String(form.body ?? '') },
          checked.issues.map((i) => i.message),
        ),
        400,
      )
    if (!(await notes.update(c.get('user').id, id, checked.value.title, checked.value.body)))
      return c.text('No such note.', 404)
    return c.redirect('/notes', 303)
  })
  app.post('/notes/:id/delete', async (c) => {
    if (!(await notes.remove(c.get('user').id, Number(c.req.param('id')))))
      return c.text('No such note.', 404)
    return c.redirect('/notes', 303)
  })

  app.route('/api/notes', createApi(db))
  // Client components without a bundler: src/client is compiled when the browser asks; `npm run build` compiles it once for production.
  app.route('/client', clientModules({ root: 'src/client', compiled: 'dist/client' }))
  return app
}
