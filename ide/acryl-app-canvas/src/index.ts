/**
 * Host side of `acryl-app-canvas`: nothing to do. The canvas is the client half (`./client`), which registers the centre of the advanced shell
 * only when the Host serves an app, so this package keeps a Host row only so the client bundle is composed.
 */

import type { Context } from '@deepseek-ai/cordis'

/** Stable Cordis plugin name. */
export const name = 'acryl-app-canvas'

/** The Host half mounts nothing. */
export function apply(_ctx: Context): void {}
