/**
 * A plugin's own route prefix under the app's mount. The app is served at the root of its own server `''`, or at the prefix a host serves it at (`/app` in
 * the ACRYL frame); a plugin that mounts routes of its own (the panel, the PTY driver) takes that mount as config and derives its prefix from it, so its
 * routes belong to the app wherever the app is served. The same rule `routerHttp.mount` applies.
 */
export function mountedPrefix(mount: string | undefined, path: string, plugin: string): string {
  if (mount === undefined || mount === '') return path
  if (!/^\/[A-Za-z0-9._~\-/]*[A-Za-z0-9._~-]$/u.test(mount))
    throw new TypeError(
      `${plugin}: the app's mount "${mount}" must be empty or an absolute path such as "/app"`,
    )
  return `${mount}${path}`
}
