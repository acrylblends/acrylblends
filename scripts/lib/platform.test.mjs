import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { batchCommand, chromeCandidates, doorShimCommand, npmCommand } from './platform.mjs'

test('npm is spawned as npm.cmd on Windows and as npm elsewhere', () => {
  assert.equal(npmCommand('win32'), 'npm.cmd')
  assert.equal(npmCommand('darwin'), 'npm')
  assert.equal(npmCommand('linux'), 'npm')
})

test('a batch file is spawned through the shell on Windows, and as it is elsewhere', () => {
  assert.deepEqual(batchCommand('npm.cmd', 'win32'), {
    command: '"npm.cmd"',
    options: { shell: true },
  })
  assert.deepEqual(batchCommand('npm', 'linux'), { command: 'npm', options: {} })
})

test('the door command is the .cmd wrapper the door writes on Windows', () => {
  assert.equal(doorShimCommand('/app', 'linux'), join('/app', '.acryl', 'bin', 'acryl'))
  assert.equal(doorShimCommand('/app', 'darwin'), join('/app', '.acryl', 'bin', 'acryl'))
  assert.equal(doorShimCommand('C:\\app', 'win32'), join('C:\\app', '.acryl', 'bin', 'acryl.cmd'))
})

test('Chrome is found where each platform installs it, and CHROME_BIN wins', () => {
  const windows = chromeCandidates(
    { PROGRAMFILES: 'C:\\PF', 'PROGRAMFILES(X86)': 'C:\\PF86', LOCALAPPDATA: 'C:\\LA' },
    'win32',
  )
  assert.deepEqual(windows, [
    join('C:\\PF', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join('C:\\PF86', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join('C:\\LA', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ])
  const mac = chromeCandidates({}, 'darwin')
  assert.equal(mac[0], '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  const linux = chromeCandidates({ CHROME_BIN: '/opt/chrome' }, 'linux')
  assert.equal(linux[0], '/opt/chrome')
  assert.equal(linux[1], '/usr/bin/google-chrome')
})
