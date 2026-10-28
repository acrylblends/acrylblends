export { type AddOptions, add, listPlugins, parseAddOptions } from './add'
export { HELP, runCli, VERSION } from './cli'
export { type InitOptions, init, parseInitOptions, UsageError } from './init'
export type { Io } from './io'
export {
  closure,
  copyPlugin,
  isOmitted,
  type LibraryPlugin,
  libraryRoot,
  readLibrary,
} from './library'
export {
  assertTargetFree,
  copyTemplate,
  isValidName,
  mergeDependencies,
  nameFrom,
  readTemplatePlugins,
  TargetNotEmptyError,
} from './project'
export {
  isTemplate,
  resolveTemplate,
  TEMPLATE_ALIASES,
  TEMPLATE_SUMMARY,
  TEMPLATES,
  type Template,
  templateDir,
  templatesRoot,
} from './templates'
export { parseUpgradeOptions, type UpgradeOptions, upgrade } from './upgrade'
