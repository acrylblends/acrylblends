# The previous published layout (acrylblends 1.1.0)

`acrylblends upgrade` brings an app made before the ACRYL frame onto it. To do that safely it has to tell the template's own files (which it may replace)
from the app's files (which it never touches without `--force` and a backup). These are the scaffold files of the release before the frame, copied from the
`v1.1.0` tag: `src/app.ts` and the template's route module (`src/routes.ts`, or `src/todo.ts` for the to-do template), exactly as a scaffolded app has them
after `acrylblends init` substituted the app name (`__APP_NAME__` stands in for it here).

An app whose files match these is the template's; one that differs was edited (or made by another version), and the upgrade refuses to replace it.
