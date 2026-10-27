import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

/** Throwaway homes and databases live inside the project (`.acrylblends/` is ignored by git), because a sandboxed agent may not write to the system temp folder. */
const scratch = join(fileURLToPath(new URL('..', import.meta.url)), '.acrylblends', 'test')
mkdirSync(scratch, { recursive: true })

/** Start `src/main.ts` the way `npm start` does, on a port the system chooses, and read the address it prints. */
async function start(env: Record<string, string> = {}) {
  const home = mkdtempSync(join(scratch, 'server-test-'))
  const child = spawn(
    process.execPath,
    ['--import', './plugins/acryl-node-server/src/register.ts', 'src/main.ts'],
    {
      env: { ...process.env, ACRYLBLENDS_HOME: home, ACRYLBLENDS_PORT: '0', ...env },
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  )
  let out = ''
  const address = await new Promise<string>((resolve, reject) => {
    child.once('exit', (code) =>
      reject(new Error(`the server exited with ${code} before it listened`)),
    )
    child.stdout.on('data', (chunk) => {
      out += chunk
      const match = /listening on (http:\/\/\S+)/.exec(out)
      if (match?.[1]) resolve(match[1])
    })
  })
  return { child, address, home }
}

test('the server listens on 127.0.0.1 unless HOST says otherwise', async () => {
  const { child, address, home } = await start()
  try {
    assert.match(address, /^http:\/\/127\.0\.0\.1:\d+$/)
  } finally {
    child.kill('SIGTERM')
    await once(child, 'exit')
    rmSync(home, { recursive: true, force: true })
  }
})

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  test(`${signal} stops the server cleanly and frees the port`, async () => {
    const { child, address, home } = await start()
    try {
      assert.equal((await fetch(address)).status, 200)
      const started = Date.now()
      child.kill(signal)
      const [code] = await once(child, 'exit')
      assert.equal(code, 0)
      assert.ok(Date.now() - started < 5000, 'the server took too long to stop')
      await assert.rejects(fetch(address), 'the port should be free')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
}
