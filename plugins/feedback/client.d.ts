// Types for the browser client served as-is (client.js): the Host reads it as text and appends its start call; tests import the exported helpers.

/** The ACRYL frame's view handle, or undefined when the page is not in the frame's canvas. */
export function frameViewOf(win: { readonly parent: unknown }): { readonly mode: 'build' | 'preview' } | undefined
