# acryl-blends-frame

The workbench around an app made with ACRYL Blends, as the owner's mockup draws it (`docs/design/blends-frame-mockup.html`):

- a top bar: the left-panel toggle, the app's name and newest version, Build/Preview, Settings, the right-panel toggle;
- on the left: the app's branches, each with what is open on it, then the versions (save points) of the checked-out branch;
- in the centre: the app alone, in one frame that only a person or the door navigates or reloads; its Select control picks an element of the
  app, and the next message the chat sends then carries that element's page and selector, shown above the composer as `Selected: ...` until
  its x clears it;
- on the right: the agents as tabs, with the chat's History.

It owns the page's `root` slot, so it is mounted instead of the IDE's workbench (`acryl-workspace`), never beside it. The Host half serves one
private route, `GET /api/acryl-blends-frame/state` (the app's name, folder, page and branches); `appPage` in the row's config says where the
app's page is served.
