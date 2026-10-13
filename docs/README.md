# ACRYLBLENDS documentation

ACRYLBLENDS is a framework for apps built on [Cordis](https://www.npmjs.com/package/@deepseek-ai/cordis), the plugin system
ACRYL runs on. Cordis does the composing: plugins, services, dependencies, lifecycle, cleanup and events. ACRYLBLENDS adds a
library of plugins extracted from ACRYL, and a command that copies them into your app. You own every copied line; there
is no ACRYLBLENDS runtime to import.

## Documentation

- [Getting started](getting-started.md) - create an app, run it, add plugins, lock it, save it
- [The plugin library](plugins.md) - every plugin: what it does, its service, its config, where it came from
- [Extending a running app](extending-apps.md) - extensions, the builder, durable tasks; how an agent writes a plugin
- [The app manifest](manifest.md) - `blend.yaml`: the app as data, parameters, diagnostics, the lock
- [Building with Cordis](cordis.md) - plugins, services, `inject`, effects, events, a scope per task, HTTP
