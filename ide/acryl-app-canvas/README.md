# acryl-app-canvas

The centre of the Blends frame: the app's own page, in one frame that a person or the agent (through the door) may navigate or reload. The frame
never replaces the app page on its own; there is no retry that replaces a page that loaded.

The canvas takes `desktop.main` only when the Host serves an app (`appPage` in the workspace capabilities), so a surface without an app keeps the
workspace canvas in the centre. It provides `appCanvas`: `address()`, `navigate(path)`, `reload()`, `subscribe(listener)` and `pageWindow()` (the
door's page window id of the canvas page).
