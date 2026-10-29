# Build, then check it through the door, in one run: the recorded run

`node scripts/verify-build-and-check.mjs --driver codex`, 2026-10-29, on 1.0.4 (the branch that became it), macOS, Node 24.19, Codex 0.163. A manual gate: it runs a real agent, so it is not part of `pnpm run check`.

**What it does.** A fresh agent-template app with the panel; a real (headless) Chrome opens the app's page; the message is typed into the panel and sent, as a person does:

> Do it now, without asking for approval. Add a Notes page to this app at /notes: a heading "Notes", a text box labelled "Note", a Save button, and a list; saving adds the note to the list on the page (a small script in the page is fine). Build it as a plugin in plugins/notes and install it into the running app. Then check your own work the way a person would, in this same run: with the door (.acryl/bin/acryl, see AGENTS.md) go to /notes, type a note, press Save, look at the page and confirm the note is listed. Tell me what you saw.

**What came out (171 s).** The gate reads what the door audited (`.acryl/audit/ui-control.jsonl`), not what the agent says:

```
act navigate:ok | look:ok | act type textbox "Note":ok | look:ok | act click button "Save":ok | look:ok
| look:ok | act type textbox "Note":ok | look:ok | act click button "Save":ok | look:ok
```

The agent installed the plugin, went to `/notes` with `act navigate`, looked, typed a note, pressed Save and looked again (and did it a second time after its own tests), then reported: typed `Buy oat milk`, clicked Save, confirmed it appears in the list; `npm test` 14/14, `npm run check`, plugin reload active. The panel showed the question and the report again after the page had reloaded several times during the run (the door reloads the pages after the plugin install, `act navigate` moves the page): the run belongs to the app, not to the page.

**What failed before, and why this run is the proof.** Three earlier tries, each kept honest here:

1. Through the panel's API with no page watching (a script, not a person's page): the agent built the feature but could not see it, because the open page was not refreshed until the run ended and the door had no reload verb (`act press Control+R` and `F5` do nothing). It killed the Electron process and ended without checking. Fixed by `act reload`, `act navigate` and the reload after a live plugin change.
2. With a page that carried no door tag: `look` said no page was open. Fixed by the door adding its script to every HTML page in development, through the new `ctx.router.wrap` (a plain middleware only wraps the routes mounted after it, and a plugin loaded at boot is mounted before the door).
3. In a real page, the same task: the audit showed the whole check, but the panel reported nothing and the run was cancelled when the agent's own navigation reloaded the page, because the run was tied to the page that asked. Fixed: runs belong to the app, a page that loads follows the latest one (`GET /api/agent-panel/run`), and only Stop (`POST /api/agent-panel/stop`) cancels.

Codex needed "Do it now, without asking for approval": with the owner's own global skills it stopped to present a design (see the facilitator notes).
