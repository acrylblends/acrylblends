/** The registry, adding a plugin and the GitHub check, as the page asks the frame's Host for them (see `../registry.ts`, `../plain.ts`). */

import { FRAME_PLUGINS_GITHUB_PATH, FRAME_PLUGINS_PULL_PATH, FRAME_PLUGINS_REGISTRY_PATH, parseGithubReadiness, parsePulledPlugin, parseRegistryView, type GithubReadiness, type PulledPluginView, type RegistryView } from '../contract.ts'
import { failureOf } from './plain-failure.ts'

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface RegistryApi {
  /** The public registry with the plugins this app already has marked; an unreadable registry is an answer, not a failure. */
  registry(): Promise<RegistryView>
  /** Add one released plugin (`github:<owner>/<repo>@<version>`) to the running app. @throws PlainFailure with why it was refused. */
  add(source: string): Promise<PulledPluginView>
  /** Whether this computer can share to GitHub now. */
  github(): Promise<GithubReadiness>
}

export function createRegistryApi(fetcher: FetchLike = (input, init) => fetch(input, init)): RegistryApi {
  const get = async (path: string): Promise<unknown> => {
    const response = await fetcher(path, { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
    if (!response.ok) throw await failureOf(response)
    return response.json()
  }
  return {
    registry: async () => parseRegistryView(await get(FRAME_PLUGINS_REGISTRY_PATH)),
    github: async () => parseGithubReadiness(await get(FRAME_PLUGINS_GITHUB_PATH)),
    async add(source) {
      const response = await fetcher(FRAME_PLUGINS_PULL_PATH, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ source }),
      })
      if (!response.ok) throw await failureOf(response)
      return parsePulledPlugin(await response.json())
    },
  }
}
