/**
 * The one place this package names the framework. The templates are written with `__PACKAGE__` and `__RANGE__`, and the text of `AGENTS.md` with
 * `__PACKAGE__`, so a rename (for example to `acryl`) is a change here and in `scripts/lib/names.mjs`, which a test keeps equal.
 */
export const PACKAGE = 'acrylblends'
export const CLASS = 'Acryl'
export const CREATE = 'create-acrylblends'
/** The range of the framework package a created app depends on: the first release whose root is the framework. */
export const RANGE = '^0.5.0'
