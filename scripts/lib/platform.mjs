/**
 * What a child process must be spawned as, per platform. Windows refuses two names a POSIX host accepts: a bare `npm` (the executable is `npm.cmd`, and
 * CreateProcess does not run batch files by bare name) and the door's extensionless command (the door writes `acryl.cmd` beside it for exactly this).
 * The browser's install locations differ too. Every answer here is pure, so the differences are tested on any machine.
 */
import { join } from 'node:path'

/** The npm a child process spawns: `npm.cmd` on Windows. */
export const npmCommand = (platform = process.platform) =>
  platform === 'win32' ? 'npm.cmd' : 'npm'

/** The door's command in an app folder: the `.cmd` wrapper the door writes beside the POSIX script on Windows. */
export const doorShimCommand = (app, platform = process.platform) =>
  join(app, '.acryl', 'bin', platform === 'win32' ? 'acryl.cmd' : 'acryl')

/**
 * How to spawn a batch file (npm.cmd, the door's .cmd): Windows cannot run it without cmd.exe, and the path is quoted for that shell. On every other
 * platform the command is spawned as it is.
 */
export const batchCommand = (command, platform = process.platform) =>
  platform === 'win32'
    ? { command: `"${command}"`, options: { shell: true } }
    : { command, options: {} }

/**
 * Where a Chrome or Chromium may be, in the order to try: `CHROME_BIN` wins; Windows names Chrome's two Program Files locations and the per-user
 * install, macOS the app bundle, and every other platform (Linux) the distribution paths.
 */
export function chromeCandidates(env = process.env, platform = process.platform) {
  const windows = [
    join(env.PROGRAMFILES ?? 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(
      env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)',
      'Google',
      'Chrome',
      'Application',
      'chrome.exe',
    ),
    join(env.LOCALAPPDATA ?? 'C:\\Users\\Public', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ]
  const mac = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
  const linux = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]
  const platformPaths = platform === 'win32' ? windows : platform === 'darwin' ? mac : linux
  return [env.CHROME_BIN, ...platformPaths].filter((path) => path !== undefined && path !== '')
}
