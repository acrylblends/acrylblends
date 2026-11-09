import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { instanceEnv, productInstance, selectInstance, stablePort, withRunEnv } from '../index.ts'
import {
  appFolders,
  createApp,
  isAppId,
  isPortableName,
  LAYOUT_VERSION,
  listApps,
  newAppId,
  openRoot,
  personHome,
  platformDataDir,
  productRoot,
  renameApp,
  touchApp,
} from '../storage.ts'

const scratch = mkdtempSync(join(tmpdir(), 'instance-storage-'))
after(() => rmSync(scratch, { recursive: true, force: true }))

test('macOS: the per-user application data folder is Library/Application Support, with spaces and non-ASCII in the home kept', () => {
  assert.equal(
    platformDataDir('darwin', {}, '/Users/Zoë Smith'),
    '/Users/Zoë Smith/Library/Application Support',
  )
  // macOS ignores the XDG variables.
  assert.equal(
    platformDataDir('darwin', { XDG_DATA_HOME: '/elsewhere' }, '/Users/a'),
    '/Users/a/Library/Application Support',
  )
})

test('Windows: LOCALAPPDATA (never the roaming profile), else <home>\\AppData\\Local, as Windows paths on any OS', () => {
  assert.equal(
    platformDataDir(
      'win32',
      {
        LOCALAPPDATA: 'C:\\Users\\Zoë Smith\\AppData\\Local',
        APPDATA: 'C:\\Users\\Zoë Smith\\AppData\\Roaming',
      },
      'C:\\Users\\Zoë Smith',
    ),
    'C:\\Users\\Zoë Smith\\AppData\\Local',
  )
  assert.equal(platformDataDir('win32', {}, 'C:\\Users\\a'), 'C:\\Users\\a\\AppData\\Local')
  // A relative LOCALAPPDATA is not a folder of this machine: the home's is used.
  assert.equal(
    platformDataDir('win32', { LOCALAPPDATA: 'AppData' }, 'C:\\Users\\a'),
    'C:\\Users\\a\\AppData\\Local',
  )
  assert.equal(
    productRoot('ACRYL Blends Blank', 'win32', {}, 'C:\\Users\\a'),
    'C:\\Users\\a\\AppData\\Local\\ACRYL Blends Blank',
  )
})

test('Linux: an absolute XDG_DATA_HOME, else ~/.local/share; a relative XDG_DATA_HOME is invalid and ignored', () => {
  assert.equal(platformDataDir('linux', {}, '/home/zoë'), '/home/zoë/.local/share')
  assert.equal(platformDataDir('linux', { XDG_DATA_HOME: '/data/zoë' }, '/home/zoë'), '/data/zoë')
  assert.equal(
    platformDataDir('linux', { XDG_DATA_HOME: 'relative/share' }, '/home/zoë'),
    '/home/zoë/.local/share',
  )
  assert.equal(
    platformDataDir('linux', { XDG_DATA_HOME: '  ' }, '/home/zoë'),
    '/home/zoë/.local/share',
  )
  assert.equal(
    productRoot('ACRYL Blends Blank', 'linux', {}, '/home/a'),
    '/home/a/.local/share/ACRYL Blends Blank',
  )
})

test('the home comes from HOME (USERPROFILE on Windows), so an isolated run that moves it moves everything', () => {
  assert.equal(personHome({ HOME: '/tmp/isolated' }, 'darwin'), '/tmp/isolated')
  assert.equal(
    personHome({ USERPROFILE: 'C:\\iso', HOME: '/c/Users/git-bash' }, 'win32'),
    'C:\\iso',
  )
})

test('names: a folder name every OS accepts, Windows reserved names refused in any case and with any extension', () => {
  for (const bad of [
    '',
    ' lead',
    'trail ',
    'dot.',
    'a/b',
    'a\\b',
    'a:b',
    'a?b',
    'CON',
    'con',
    'Nul.txt',
    'com1',
    'tab\there',
    'LPT9',
    'x'.repeat(65),
  ])
    assert.equal(isPortableName(bad, 64), false, JSON.stringify(bad))
  for (const good of ['ACRYL Blends Blank', 'console', 'com10', 'notes-3f2a', 'Zoë'])
    assert.equal(isPortableName(good, 64), true, good)
  assert.throws(() => productRoot('Bad/Name', 'linux', {}, '/home/a'), /cannot be a folder name/)
})

test('an app id is the name folded to ASCII plus four random hex digits, 40 characters at most, never the name itself', () => {
  assert.equal(
    newAppId('My Notes', () => '3f2a'),
    'my-notes-3f2a',
  )
  assert.equal(
    newAppId('Zoë’s Café!', () => '00ff'),
    'zoe-s-cafe-00ff',
  )
  assert.equal(
    newAppId('日本語', () => 'abcd'),
    'app-abcd',
  )
  assert.equal(
    newAppId('CON', () => '0001'),
    'con-0001',
  )
  const long = newAppId('a'.repeat(200), () => 'beef')
  assert.ok(long.length <= 40 && isAppId(long), long)
  for (const bad of ['My-Notes', 'a--b', '-a', 'a-', 'con', 'a_b', 'x'.repeat(41)])
    assert.equal(isAppId(bad), false, bad)
})

test('an app has four folders under apps/<id>, logs inside data (the engine writes <home>/logs), on each OS in its own separators', () => {
  assert.deepEqual(appFolders('/root', 'notes-3f2a', 'linux'), {
    id: 'notes-3f2a',
    source: '/root/apps/notes-3f2a/source',
    data: '/root/apps/notes-3f2a/data',
    cache: '/root/apps/notes-3f2a/cache',
    logs: '/root/apps/notes-3f2a/data/logs',
  })
  assert.equal(
    appFolders('C:\\root', 'notes-3f2a', 'win32').logs,
    'C:\\root\\apps\\notes-3f2a\\data\\logs',
  )
  assert.throws(() => appFolders('/root', '../escape'), /not an app id/)
})

test('the first open writes layout.json and an empty registry; a newer layout is reported, never changed; a foreign file stops', () => {
  const root = join(scratch, 'first')
  assert.deepEqual(openRoot(root, '1.2.0'), { kind: 'current' })
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'layout.json'), 'utf8')), {
    layout: LAYOUT_VERSION,
    writtenBy: '1.2.0',
  })
  assert.deepEqual(listApps(root), [])
  assert.deepEqual(openRoot(root, '1.3.0'), { kind: 'current' })
  // The second open does not rewrite who wrote the layout.
  assert.equal(JSON.parse(readFileSync(join(root, 'layout.json'), 'utf8')).writtenBy, '1.2.0')

  const newer = join(scratch, 'newer')
  openRoot(newer, '1.2.0')
  const before = JSON.stringify({ layout: LAYOUT_VERSION + 1, writtenBy: '9.0.0' })
  writeFileSync(join(newer, 'layout.json'), before)
  assert.deepEqual(openRoot(newer, '1.2.0'), {
    kind: 'newer',
    layout: LAYOUT_VERSION + 1,
    writtenBy: '9.0.0',
  })
  assert.equal(readFileSync(join(newer, 'layout.json'), 'utf8'), before)

  const foreign = join(scratch, 'foreign')
  openRoot(foreign, '1.2.0')
  writeFileSync(join(foreign, 'layout.json'), '{"something":"else"}')
  assert.throws(() => openRoot(foreign, '1.2.0'), /no layout version/)
})

test('the registry: create makes the folders and an entry with no path in it; rename keeps the folder; touch records the open', () => {
  const root = join(scratch, 'registry')
  openRoot(root, '1.2.0')
  const made = createApp(root, '  My Notes  ', {
    now: () => new Date('2026-11-05T10:00:00Z'),
    random: () => '3f2a',
  })
  assert.deepEqual(made, {
    id: 'my-notes-3f2a',
    name: 'My Notes',
    created: '2026-11-05T10:00:00.000Z',
  })
  const folders = appFolders(root, made.id)
  for (const folder of [folders.source, folders.data, folders.logs, folders.cache])
    assert.ok(existsSync(folder), folder)
  assert.ok(
    !readFileSync(join(root, 'apps.json'), 'utf8').includes(root),
    'apps.json holds no absolute path',
  )

  // The same name twice is two apps; a random id already taken is drawn again.
  const twin = createApp(root, 'My Notes', { random: () => '3f2a' })
  assert.notEqual(twin.id, made.id)
  assert.equal(listApps(root).length, 2)

  const renamed = renameApp(root, made.id, 'Shop')
  assert.equal(renamed.id, 'my-notes-3f2a')
  // The product's default name is not the person's until they give one: the first start asks for it while `named` is absent.
  assert.equal(made.named, undefined)
  assert.equal(renamed.named, true)
  assert.equal(listApps(root)[0]?.name, 'Shop')
  assert.ok(existsSync(folders.source), 'renaming never moves the folder')

  touchApp(root, made.id, () => new Date('2026-11-06T09:00:00Z'))
  assert.equal(listApps(root)[0]?.lastOpened, '2026-11-06T09:00:00.000Z')
  assert.throws(() => createApp(root, '   '), /1 to 80 characters/)
  assert.throws(() => renameApp(root, 'missing-0000', 'x'), /no app/)
})

test('a product app is an AppInstance: source is its root, data its home and the engine home, its registry id seeds the port', () => {
  const folders = appFolders('/root', 'shop-3f2a', 'linux')
  const chosen = productInstance(folders, 'Shop')
  assert.equal(chosen.kind, 'product')
  assert.equal(chosen.name, 'Shop')
  assert.equal(chosen.root, folders.source)
  assert.equal(chosen.home, folders.data)
  assert.equal(chosen.dshHome, folders.data)
  assert.equal(chosen.port.start, stablePort('shop-3f2a'))
  assert.ok(Object.isFrozen(chosen))
})

test('a child started with instanceEnv chooses the same home and start port, whatever folder it runs in', () => {
  const chosen = productInstance(appFolders('/root', 'shop-3f2a'), 'Shop')
  // The host runs from the bundle: its own folder is not the app, and the environment names the app's source.
  const child = selectInstance({ projectRoot: '/bundle', env: instanceEnv(chosen) })
  assert.equal(child.root, chosen.root)
  assert.equal(child.home, chosen.home)
  assert.equal(child.dshHome, chosen.dshHome)
  assert.equal(child.port.start, chosen.port.start)
  // The folder the host runs on is `source`, which names nothing: the app's own name reaches the page through the environment.
  assert.equal(child.name, 'Shop')
  assert.deepEqual(Object.keys(instanceEnv(chosen)).sort(), [
    'ACRYLBLENDS_HOME',
    'ACRYLBLENDS_NAME',
    'ACRYLBLENDS_PORT',
    'ACRYLBLENDS_ROOT',
  ])
})

test('a product app listens where the environment says, as any instance does', () => {
  const chosen = productInstance(appFolders('/root', 'shop-3f2a'), 'Shop')
  assert.equal(withRunEnv(chosen, {}), chosen)
  const pinned = withRunEnv(chosen, { ACRYLBLENDS_PORT: '3741', ACRYLBLENDS_HOST: '0.0.0.0' })
  assert.deepEqual(pinned.port, { start: 3741, scan: true })
  assert.equal(pinned.host, '0.0.0.0')
  assert.equal(pinned.home, chosen.home)
  assert.equal(withRunEnv(chosen, { PORT: '0' }).port.scan, false)
})
