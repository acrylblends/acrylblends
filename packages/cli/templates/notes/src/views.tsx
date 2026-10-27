import type { Note } from './db.ts'
import { doorEnabled } from './door.ts'
import { BODY_MAX, TITLE_MAX } from './schema.ts'

const counterScript = `
const filter = document.getElementById('filter')
if (filter) filter.addEventListener('input', () => {
  const q = filter.value.toLowerCase()
  for (const li of document.querySelectorAll('[data-note]'))
    li.hidden = !li.textContent.toLowerCase().includes(q)
})
`

const Layout = ({
  title,
  user,
  children,
}: {
  title: string
  user?: string
  children?: unknown
}) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title}</title>
      <style
        dangerouslySetInnerHTML={{
          __html:
            'body{font:16px system-ui;max-width:42rem;margin:2rem auto;padding:0 1rem}label{display:block;margin:.75rem 0 .25rem}input,textarea{width:100%;box-sizing:border-box;padding:.5rem}.error{color:#b00020}nav{display:flex;gap:1rem;align-items:center}nav form{margin-left:auto}li{margin:.5rem 0}',
        }}
      />
    </head>
    <body>
      <nav>
        <strong>Notes</strong>
        {user ? (
          <>
            <a href="/notes">All notes</a>
            <a href="/notes/new">New note</a>
            <form method="post" action="/logout">
              <span>{user} </span>
              <button type="submit">Log out</button>
            </form>
          </>
        ) : (
          <>
            <a href="/login">Log in</a>
            <a href="/signup">Sign up</a>
          </>
        )}
      </nav>
      {children}
      <script dangerouslySetInnerHTML={{ __html: counterScript }} />
      <script type="module" src="/client/counter.tsx" />
      {doorEnabled() ? <script type="module" src="/api/acryl-door/page.js" /> : null}
    </body>
  </html>
)

const Errors = ({ errors }: { errors: string[] }) =>
  errors.length > 0 ? (
    <ul class="error" role="alert">
      {errors.map((e) => (
        <li>{e}</li>
      ))}
    </ul>
  ) : null

export const authPage = (mode: 'login' | 'signup', errors: string[] = [], email = ''): string =>
  (
    <Layout title={mode === 'login' ? 'Log in' : 'Sign up'}>
      <h1>{mode === 'login' ? 'Log in' : 'Sign up'}</h1>
      <Errors errors={errors} />
      <form method="post" action={`/${mode}`}>
        <label for="email">Email</label>
        <input id="email" name="email" type="email" value={email} />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" />
        <p>
          <button type="submit">{mode === 'login' ? 'Log in' : 'Create account'}</button>
        </p>
      </form>
    </Layout>
  ).toString()

export const listPage = (user: string, notes: Note[], q: string): string =>
  (
    <Layout title="Notes" user={user}>
      <h1>Your notes</h1>
      <form method="get" action="/notes">
        <label for="filter">Search</label>
        <input id="filter" name="q" type="search" value={q} />
        <button type="submit">Search</button>
      </form>
      {notes.length === 0 ? <p>{q ? `No note matches "${q}".` : 'No notes yet.'}</p> : null}
      <ul>
        {notes.map((n) => (
          <li data-note>
            <a href={`/notes/${n.id}/edit`}>{n.title}</a>
            <form method="post" action={`/notes/${n.id}/delete`} style="display:inline">
              <button type="submit">Delete</button>
            </form>
          </li>
        ))}
      </ul>
    </Layout>
  ).toString()

export const formPage = (
  user: string,
  action: string,
  note: { title: string; body: string },
  errors: string[] = [],
): string =>
  (
    <Layout title="Note" user={user}>
      <h1>{action === '/notes' ? 'New note' : 'Edit note'}</h1>
      <Errors errors={errors} />
      <form method="post" action={action}>
        <label for="title">Title</label>
        <input id="title" name="title" value={note.title} />
        <label for="body">Note</label>
        <textarea id="body" name="body" rows={8} maxlength={BODY_MAX}>
          {note.body}
        </textarea>
        <small id="count" aria-live="polite" data-island="counter" />
        <p>
          <button type="submit">Save</button> <a href="/notes">Cancel</a>
        </p>
      </form>
    </Layout>
  ).toString()

export { TITLE_MAX }
