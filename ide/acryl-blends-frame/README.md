# acryl-blends-frame

The workbench around an app made with ACRYL Blends, as the owner's mockup draws it (`docs/design/blends-frame-mockup.html`):

- a top bar: the left-panel toggle, the app's name and newest version, Build/Preview, Settings, the right-panel toggle;
- on the left: the app's branches, each with what is open on it, then the versions (save points) of the checked-out branch;
- in the centre: the app alone, in one frame that only a person or the door navigates or reloads; its Select control picks an element of the
  app, and the next message the chat sends then carries that element's page and selector, shown at the left of the composer's input row as
  `Selected: ...` until its x clears it;
- on the right: the agents as tabs, with the chat's History.

On a new app the frame is the first screen: both panels open, a blank chat with its composer at the bottom, and the model connected in
Settings > Models. DSH's preview notice and credential prompt stay out of the frame instead of covering the app.

The canvas page reads the frame's view (`src/client/frame-view.ts`): Build keeps the app's own build-time controls out of the canvas (the
agent-panel's button and the feedback button), and Preview shows what production shows without a reload. The page's plugins read the handle
through `window.parent`; a page opened directly is unchanged.

Settings > Plugins shares a local plugin: the frame packages it (the builder's package shape, plus the Loader patch the plugin-hub needs),
publishes it with `@webboxes/plugin-hub` through the user's own `gh` and `git` to its own GitHub repository and release, and the row then shows
the repository and version. A second app installs it with `acrylblends add <the package folder>`; the plugin-hub refuses a package with secrets
before anything is sent. `shareOwner` in the frame row's config names the GitHub account or organization (the signed-in account when absent).

It owns the page's `root` slot, so it is mounted instead of the IDE's workbench (`acryl-workspace`), never beside it. The Host half serves one
private route, `GET /api/acryl-blends-frame/state` (the app's name, folder, page and branches); `appPage` in the row's config says where the
app's page is served.

## The chat saves by itself

When the chat's agent finishes a turn that changed files in the app's folder, the Host makes a save point (a version) without being asked. It is named
after the person's request (its first sentence, cut at a word after 50 characters), it holds the whole folder as `Save point` does, and the chat says
so in one line under that answer: `edited src/routes.ts, src/board.ts · saved as v7`. The new version is the top of Versions, "(current)", and the top
bar reads `v7 · saved`. A turn that changed no file makes no version and says nothing.

Which files a turn changed comes from DSH's `workspace-changes` row, which compares the working tree before and after each turn, so edits the person
made earlier and has not saved are not credited to the agent (they are still in the version, as in any save point). The Host keeps which turn made
which version in `chat-saves.json` in the app's data home (`GET /api/acryl-blends-frame/chat-saves?session=`), so the line is still there after a restart.

The chat the frame mounts needs more of DSH than the frame draws: the agent preset `acryl-blends` (shell, file tools and jobs; the registry's default),
the host rows it stands on, and the chat view's client rows, with a `sidebarRight` stand-in for the chat's links. They are in `packages/cli/src/ide-profile.ts`.

## The canvas shows what the files say

The app's code runs in the dev host (`npm run dev`), and the host loads it once. So that a version the person goes back to, a file the chat wrote, a
line typed in an editor or a `git switch` shows in the canvas without a restart (a restart would end the terminals and agents in the right panel),
the Host loads the app's code again whenever a file under `src/` changes, whoever changed it (300 ms after the last change).

How it works: the launcher (`scripts/ide-host.mjs`) loads `acryl-blends-frame/app-generation` before anything of the app does. It installs a resolve
hook that, once the Host raises the generation, gives every file of the app's `src/` (and the generated `frame/` rows) a `?gen=N` query, so a new import
of them - and of everything they import - is a fresh copy. Nothing in `node_modules` or the framework's `plugins/` gets one, so their services stay
single instances. The Host (`src/app-reload.ts`) then imports the app's rows (`app-plugins`, `app-routes`) under the new generation, and only if that
succeeds stops them and starts them from the new code. The page follows a long poll on `GET /api/acryl-blends-frame/app?after=<seq>` and reloads the
canvas when a new generation is up.

A file that does not load (a syntax error, a missing import) or a row that does not start leaves the last good code running and shows one line in
the top bar (`Not reloaded: src/routes.ts:47 ...`) until the next change loads. In-memory state of the app's modules starts again with each load.
Development only: Node cannot unload a module, so the old copies stay in memory until the host stops; `npm start` has no launcher and never loads the
hook. A host started by a launcher that predates the hook runs the code as it started.
