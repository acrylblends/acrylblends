import { __CLASS__ } from '__PACKAGE__'
import { deleteCookie, getCookie, setCookie } from '__PACKAGE__/cookie'
import { csrf } from '__PACKAGE__/csrf'
import { createMiddleware } from '__PACKAGE__/factory'
import { schemaValidator } from '__PACKAGE__/schema-validator'
import type { DatabaseSync } from 'node:sqlite'
import { authStore, verifyPassword } from './auth.ts'
import { notesStore, openDb } from './db.ts'
import { checkCredentials, checkNote, NoteSchema } from './schema.ts'
import { authPage, formPage, listPage } from './views.tsx'

type Env = { Variables: { user: { id: number; email: string } } }

const COOKIE = 'sid'
const session = { path: '/', httpOnly: true, sameSite: 'Lax' as const, maxAge: 60 * 60 * 24 * 30 }

export function createApi(db: DatabaseSync) {
  const auth = authStore(db)
  const notes = notesStore(db)
  return new __CLASS__<Env>()
    .use(async (c, next) => {
      const user = auth.userFor(getCookie(c, COOKIE))
      if (!user) return c.json({ error: 'Log in first.' }, 401)
      c.set('user', user)
      await next()
    })
    .get('/', (c) => c.json({ notes: notes.list(c.get('user').id, c.req.query('q') ?? '') }, 200))
    .post('/', schemaValidator('json', NoteSchema), (c) =>
      c.json(
        {
          note: notes.create(c.get('user').id, c.req.valid('json').title, c.req.valid('json').body),
        },
        201,
      ),
    )
    .get('/:id', (c) => {
      const note = notes.get(c.get('user').id, Number(c.req.param('id')))
      return note ? c.json({ note }, 200) : c.json({ error: 'No such note.' }, 404)
    })
    .put('/:id', schemaValidator('json', NoteSchema), (c) => {
      const { title, body } = c.req.valid('json')
      const note = notes.update(c.get('user').id, Number(c.req.param('id')), title, body)
      return note ? c.json({ note }, 200) : c.json({ error: 'No such note.' }, 404)
    })
    .delete('/:id', (c) =>
      notes.remove(c.get('user').id, Number(c.req.param('id')))
        ? c.json({ ok: true }, 200)
        : c.json({ error: 'No such note.' }, 404),
    )
}

export type Api = ReturnType<typeof createApi>

export function createApp(db: DatabaseSync = openDb()) {
  const auth = authStore(db)
  const notes = notesStore(db)
  const app = new __CLASS__<Env>()
  // Refuses a form POST that does not come from this site (checks Origin and Sec-Fetch-Site); JSON requests are not form-shaped and pass.
  app.use(csrf())

  const requireUser = createMiddleware<Env>(async (c, next) => {
    const user = auth.userFor(getCookie(c, COOKIE))
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
    if (errors.length === 0 && auth.findUser(email))
      errors.push('That email already has an account. Log in instead.')
    if (errors.length > 0) return c.html(authPage('signup', errors, email), 400)
    const id = await auth.createUser(email, String(form.password))
    setCookie(c, COOKIE, auth.startSession(id), session)
    return c.redirect('/notes', 303)
  })

  app.post('/login', async (c) => {
    const form = await c.req.parseBody()
    const email = String(form.email ?? '')
      .trim()
      .toLowerCase()
    const errors = checkCredentials(email, form.password, false)
    if (errors.length > 0) return c.html(authPage('login', errors, email), 400)
    const user = auth.findUser(email)
    if (!user || !(await verifyPassword(String(form.password), user.password_hash)))
      return c.html(authPage('login', ['Wrong email or password.'], email), 401)
    setCookie(c, COOKIE, auth.startSession(user.id), session)
    return c.redirect('/notes', 303)
  })

  app.post('/logout', (c) => {
    const token = getCookie(c, COOKIE)
    if (token) auth.endSession(token)
    deleteCookie(c, COOKIE, { path: '/' })
    return c.redirect('/login', 303)
  })

  app.use('/notes/*', requireUser)
  app.use('/notes', requireUser)

  app.get('/notes', (c) => {
    const q = (c.req.query('q') ?? '').trim()
    return c.html(listPage(c.get('user').email, notes.list(c.get('user').id, q), q))
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
    notes.create(c.get('user').id, checked.value.title, checked.value.body)
    return c.redirect('/notes', 303)
  })
  app.get('/notes/:id/edit', (c) => {
    const note = notes.get(c.get('user').id, Number(c.req.param('id')))
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
    if (!notes.update(c.get('user').id, id, checked.value.title, checked.value.body))
      return c.text('No such note.', 404)
    return c.redirect('/notes', 303)
  })
  app.post('/notes/:id/delete', (c) => {
    if (!notes.remove(c.get('user').id, Number(c.req.param('id'))))
      return c.text('No such note.', 404)
    return c.redirect('/notes', 303)
  })

  app.route('/api/notes', createApi(db))
  return app
}
