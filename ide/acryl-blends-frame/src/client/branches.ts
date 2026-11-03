/** The Branches "New" button's call to the Host: a new branch from the checked-out version, switched to. */

import { FRAME_BRANCHES_NEW_PATH } from '../contract.ts'

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface BranchesApi {
  /** Rejects with the Host's reason (a taken name, a name git refuses). */
  create(name: string): Promise<void>
}

export function createBranchesApi(fetcher: FetchLike = (input, init) => fetch(input, init)): BranchesApi {
  return {
    async create(name) {
      const response = await fetcher(FRAME_BRANCHES_NEW_PATH, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (response.ok) return
      const body = (await response.json().catch(() => ({}))) as { error?: unknown }
      throw new Error(typeof body.error === 'string' ? body.error : `the branch could not be made (HTTP ${String(response.status)})`)
    },
  }
}
