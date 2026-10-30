# The ACRYL reference set for the frame comparison

The screenshots each slice is compared with: ACRYL's own desktop at the views and viewports of `../frame-views.json`, named `<view>@<width>x<height>.png`.

Taken 2026-10-30 by the ACRYL side from the framework's own desktop, so nothing here is a reconstruction:

- The run: an isolated ACRYL worktree at `main` (`37f4dd9c`), built with `pnpm run build`, started with `node scripts/live-run.mjs desktop --no-key --keep --inspect 9333`. The live run gave the app its own throwaway root (its own `HOME`, ACRYL home, engine home and Electron user data), injected no model key, and verified on exit that its port was free and the real homes were untouched.
- The capture: the harness's own view list and steps, run against the desktop window through its Electron inspector at both viewports (`1440x900`, `1024x768`), with `prefers-color-scheme` set per view, `localStorage` cleared before each view, and the same wait timings `scripts/frame-compare.mjs capture` uses. The window's page is the same page `frame-compare` drives in a headless browser; the token the host prints is not on disk for a desktop run, so the window's own inspector was the way in.
- The view list uses ACRYL's own labels for the two panel controls, because the reference is authoritative: `Collapse sidebar` and `Show right panel`. (The list first said `Toggle sidebar` and `Toggle right panel`; that mapping is history, not a difference.)
- No personal data: the run was a fresh isolated home with no key injected; the terminal views were captured after each visible terminal was given a neutral prompt (`PS1='$ '; clear`) so no user name or machine path appears; the Models view shows an empty key field.
- The kept run roots were deleted after the capture; the desktop's port was confirmed free and the real homes untouched.

Refreshing the set after ACRYL's frame changes is the same procedure; the ACRYL side owns it.
