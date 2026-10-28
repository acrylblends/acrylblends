# Third-party notices

Code that is copied into this repository (vendored), with its license next to it. The framework sources moved from ACRYL keep their own notices in `plugins/*/LICENSE` and `provenance.json`.

| Component | Version | License | Where | Why |
| --- | --- | --- | --- | --- |
| [xterm.js](https://github.com/xtermjs/xterm.js) (`@xterm/xterm`) | 6.0.0 | MIT | `plugins/driver-pty/client/vendor/xterm.mjs`, `xterm-css.mjs` (the package's `css/xterm.css` as a string), license in `LICENSE` | the terminal tab of the agent panel |
| `@xterm/addon-fit` | 0.11.0 | MIT | `plugins/driver-pty/client/vendor/addon-fit.mjs`, license in `LICENSE-addon-fit` | sizes the terminal to its box |
| [Agent Client Protocol](https://agentclientprotocol.com) v1 JSON schema (`@agentclientprotocol/sdk`, `schema/v1/schema.json`) | 2.0.2 | Apache-2.0 | `plugins/driver-acp/test/acp-v1/schema.json`, license in `LICENSE` | a test fixture: `driver-acp`'s conformance test checks every message against it; not shipped or copied into apps |

The files are unmodified copies from the npm tarballs. `plugins/driver-pty/client/vendor/VERSION` records the exact versions and how to update them.

`node-pty` (MIT, Microsoft) is not vendored: `driver-pty` lists it as a dependency and an app that adds the plugin installs it.
