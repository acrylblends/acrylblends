# Share, versions and blueprints: one snapshot

The app is `blend.yaml` + `plugins/` + `src/`. Every way the app is kept or passed on reads exactly that, so a plugin built as a folder with its
row is in all of them without any export step:

- **A version** is a commit of the app folder. The frame saves one after the chat's turn changed files ("saved as vN" under the turn), and the
  left panel lists the versions of the branch. Going back to a version restores its `blend.yaml` and `plugins/`, and the canvas follows: a
  plugin added after that version is gone, and comes back with the newer version.
- **A shared plugin** is one folder of `plugins/`, packaged for the CordisPlugins registry (https://cordisplugins.github.io/plugins): Settings >
  Plugins > Share on the plugin's row writes its `package.json` and Loader patch, checks it holds no secret, and publishes it to a GitHub
  repository of the person's own account (through their own `gh` and `git` login), then shows the repository and version on the row. Another
  app takes it as a folder in its `plugins/` plus a row.
- **A blueprint** is a copy of the app folder (without `node_modules`, `.git` and data) as an entry of a Blends registry; an app made from it
  starts the same rows, its own plugins included.

## What you do, and what only the person does

- Before anything is shared, the plugin must work: [verify before done](../start-here/verify-before-done.md). Give it a doc comment whose first
  sentence says what it does: it becomes the package's description.
- Sharing sends the person's work to GitHub under their name. Never share, push or publish yourself: tell the person to press **Share** on the
  plugin's row in Settings > Plugins. Never ask for or handle a token.
- A fix to a plugin that was already shared needs a new version: Share again offers the next patch version and asks first.
