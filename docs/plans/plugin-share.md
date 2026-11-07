# Sharing a plugin between people: the `plugin-share` plugin

Spec: `specs/049-framework-architecture/tasks.md` M11 (T009, T011, T015) in acryldev/acryl. This note is the Cordis mini-design; `plugin pull` comes first.

## 1. Capability and boundary

`plugin-share` turns a release someone published into a running plugin in this app, and later publishes one. It is its own plugin because it has its own lifecycle and is left out of production, as the builder is. Extensions keeps owning the install transaction (`install`, rollback, ledger): pull hands it a folder and never mounts anything itself.

Fetching and unpacking belong to `@webboxes/plugin-hub`, the digest and the portability rules to `@webboxes/blends-core`. Neither is copied.

## 2. Provides and consumes

- Provides the service `pluginShare`: `pull(source)` answers `{ ok: true, name, version, integrity, digest, action, state }` or `{ ok: false, refusal, reason, next }`.
- `inject: ['extensions', 'appInstance']`. A service the pulled plugin needs is looked up with `ctx.get`, by name, at the moment of the pull.
- The door reaches it through `ctx.get('pluginShare')` and its own port, as it does for `extensions`: the verb `plugin-pull { source }`, the CLI `plugin pull <source>`.

## 3. Effects and disposal

A pull holds nothing after it answers. Its scratch store is removed on every path, including a thrown error. The plugin has no timers, routes or subscriptions. Pulls run one at a time, so two pulls of one name cannot race for its folder.

## 4. Configuration and composition

Row id `plugin-share`, equal to the package name; mounted after `extensions`. Config: `dir` (where pulled plugins go, the extensions source, default `<root>/plugins`) and `releases` (the `ReleasePort`, default GitHub over HTTPS; a test passes a local fixture).

## 5. Events and durability

No event of its own: extensions emits `extensions/changed`. The folder under `plugins/` is the durable fact. T015 adds the source and digests to `blend.yaml` and the lock.

## 6. The order of a pull

Everything up to step 5 runs in memory or in the scratch store, so a refusal has nothing to undo, and no code of the plugin has run.

1. Read the source. `github:` and a `.tgz` path or address are accepted, anything else is refused by name. `@sha256:<digest>` at the end names the content digest. A relative `.tgz` path is read from the app folder.
2. `pullPlugin` into a scratch store: the release's single `.tgz`, its sha512, the version against the tag.
3. `readTarball`, then the pure checks in `pull-check.ts`, in this order: a name the extensions folder can hold; the named digest; `portabilityIssues`; no `dependencies` (nothing is installed, so they could not resolve); an entry file; every service in its literal `inject` present in this app.
4. If `plugins/<name>/` exists: the same digest counts as already there, a different one is refused, so a person's edits are never overwritten.
5. Write to `plugins/.pulling-<name>/`, rename to `plugins/<name>/`, call `extensions.install`.
6. An install that fails or stays pending removes what step 5 wrote, so the app is as it was.

Service names are read from the source with `hostInjectFromSource`, never with `readServiceContract`, whose fallback imports the plugin: a stranger's code does not run to find out whether it may run. A computed `inject` is refused for that reason. Step 6 catches what a literal cannot say.

Known limit: an object-form `inject` lists every key as needed, so a plugin marking a service optional there is refused when the service is absent, and the reason names the service.

An agent can call the verb, as it can already write and install a plugin. Pull gives it no new power. Publish does, which is why T011 waits for a person.

## Verification

Real Cordis activation in `plugins/plugin-share/test/`: a pull from a local release fixture, with its route answering without a restart; each refusal changes nothing on disk or in the running app; pulling twice; the service leaving with its fiber. The hub's sha512 and tar parsing keep their own tests.

## The rule each book decided

- **Clean Architecture:** the checks are pure policy over plain files, and the door depends on a port it declares, not on this plugin.
- **Clean Code:** one reason per refusal, each with a name and a next step.
- **A Philosophy of Software Design:** one deep call, `pull(source)`. "Already there" is defined as success, not as an error for callers to handle.
- **DDD Distilled:** one language with the hub and the registry: source, release, integrity (the tarball's sha512), digest (the content's sha256), refusal.
- **The Pragmatic Programmer:** crash early, before a byte reaches `plugins/`; DRY, the hub and blends-core are dependencies, not copies.
