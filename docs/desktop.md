# The desktop shell

An acrylblends app also runs as a desktop app: an Electron window opens on the app's own server. It is the same app folder and the same plugins; nothing in `src/app.ts`, the manifest or any plugin
changes. Today it runs from source (`npm run desktop`); packaging a distributable app (dmg, exe, deb) is not part of it.

## Use it

```sh
npx acrylblends init my-app --template todo --desktop     # or: acrylblends add desktop, in an app you already have
cd my-app
npm install
npm run desktop
```

The first `npm run desktop` downloads Electron's binary (about 100 MB, once per machine). `npm install` does not, because Electron 44 has no install script: the `electron` command fetches the
binary the first time it runs. Behind a proxy or mirror, set `ELECTRON_MIRROR` (and `ELECTRON_CACHE` to reuse a download); if the download is blocked, run `npx install-electron` where you can reach it.

## What `npm run desktop` does

1. Picks the app's instance exactly as `npm run dev` does.
2. Keeps Electron's user data inside the app's own home, `.acrylblends/electron`, set before anything else. Nothing is written to the user's application-data folder, and two apps never share window
   state, logs or the single-instance lock. `DSH_DESKTOP_USER_DATA` overrides the folder.
3. Takes a single-instance lock named from the app's home: a second launch of the same app focuses the first window and exits.
4. Starts `createApp` in the Electron main process (the server listens on a free loopback port) and opens one window on its address: `/` by default, `/todo` for the todo template
   (`acrylblends.desktopPath` in `package.json`).
5. Locks the renderer down: context isolation, no Node in the page, the sandbox, web security. Navigation stays on the app's own origin; any other link opens in the system browser.
6. When the window closes (or on SIGINT or SIGTERM), stops the server and exits, with a bounded wait so a stuck shutdown cannot hold the process.

## Where the code is

`src/plugins/desktop/`: `main.ts` (the steps above), `window.ts` (the window options), and `user-data.ts` and `shutdown.ts`, vendored from ACRYL Desktop with a recorded commit and digest in
`upstream.json`. `electron` is a development dependency, and only that folder imports it: the app's own code never does, so a different shell is a change in one place. An app with the `agent`
template shows the agent's pages, and the routes it installs live, in the same window.

## Checking it

`scripts/verify-desktop.mjs` (needs a display) generates an app in a scratch HOME, launches `npm run desktop` without installing the binary by hand, checks the window shows the app's page, that a second
launch hands over to the first, that closing the window ends the process and frees the port, and that nothing was written outside the app's home or left running.
