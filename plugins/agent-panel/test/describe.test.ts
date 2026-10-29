import assert from 'node:assert/strict'
import { test } from 'node:test'
import { describeTool } from '../client/describe.ts'

test("a coding agent's command is shown as the command, its bookkeeping is not shown", () => {
  assert.equal(
    describeTool({
      tool: 'codex',
      info: "exec\n/bin/zsh -lc 'npm test' in /private/tmp/work/app\n",
    }),
    'codex: $ npm test',
  )
  assert.equal(
    describeTool({
      tool: 'codex',
      info: 'exec\n/bin/zsh -lc "./.acryl/bin/acryl act click --ref 7.15 --json" in /private/tmp/work/app\n',
    }),
    'codex: $ ./.acryl/bin/acryl act click --ref 7.15 --json',
  )
  for (const info of [
    'hook: PreToolUse\nhook: PreToolUse\n',
    'hook: PostToolUse Completed\n',
    'tokens used\n28,838\n',
    '',
    ' succeeded in 16ms:\n{"ok":true}\n',
  ])
    assert.equal(describeTool({ tool: 'codex', info }), undefined, JSON.stringify(info))
  assert.equal(
    describeTool({ tool: 'codex', info: ' exited 1 in 40ms:\nboom\n' }),
    'codex: exited 1 in 40ms',
  )
})

test("a coding agent's own sentence is shown, clipped", () => {
  assert.equal(
    describeTool({ tool: 'claude', info: 'Reading plugins/board/index.ts' }),
    'claude: Reading plugins/board/index.ts',
  )
  const long = describeTool({ tool: 'pi', info: 'x'.repeat(500) }) ?? ''
  assert.ok(long.length <= 'pi: '.length + 160, String(long.length))
  assert.ok(long.endsWith('…'))
})

test("the app's own agent: the tool and a short form of its arguments, and a failure with its reason", () => {
  assert.equal(describeTool({ tool: 'door_look', input: {}, result: 'Page: Demo' }), 'door_look')
  assert.equal(
    describeTool({ tool: 'door_act', input: { op: 'click', ref: '3.1' }, result: 'done' }),
    'door_act {"op":"click","ref":"3.1"}',
  )
  assert.equal(
    describeTool({ tool: 'door_act', input: {}, error: 'invalid: a call needs an op' }),
    'door_act failed: invalid: a call needs an op',
  )
})
