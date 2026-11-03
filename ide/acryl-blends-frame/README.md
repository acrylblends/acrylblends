# acryl-blends-frame

The workbench around an app made with ACRYL Blends, as the owner's mockup draws it (`docs/design/blends-frame-mockup.html`):

- a top bar: the left-panel toggle, the app's name and newest version, Build/Preview, Settings, the right-panel toggle;
- on the left: the app's branches, each with what is open on it, then the versions (save points) of the checked-out branch;
- in the centre: the app alone, in one frame that only a person or the door navigates or reloads;
- on the right: the agents as tabs, with the chat's History.

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
