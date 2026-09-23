/**
 * The published plan.
 *
 * One trip file lives in the repository and ships with the build
 * (`public/trips/<file>.json`). That copy is the canonical itinerary: it is what
 * a new device seeds from, and what everyone converges on after a pull request
 * is merged and the site redeploys.
 *
 * Everything after seeding is still local-first. The published file is fetched,
 * never written to — proposing a change means opening a pull request against
 * the repository, not writing back to a server. See `proposeUrl()`.
 */
import type { TripData } from '@/domain/types'
import { COLLECTIONS } from '@/domain/types'

/** `owner/repo`, overridable so a fork can point the propose flow at itself. */
export const REPO = import.meta.env.VITE_REPO ?? 'shockproductions/atlas-trip-planner'
/** The branch proposals target. */
export const BRANCH = import.meta.env.VITE_REPO_BRANCH ?? 'main'
/** Path of the canonical trip inside the repository. */
export const TRIP_PATH = 'public/trips/sydney-2026.json'

/**
 * Relative on purpose: the same build is served from a GitHub Pages subpath,
 * an Electron `file://` window and a Capacitor WebView.
 */
const TRIP_URL = './trips/sydney-2026.json'

/** Settings key holding the revision of the published plan already adopted. */
export const ADOPTED_REVISION_KEY = 'publishedRevision'

/** Cheap, stable content hash — enough to tell "this changed" from "it didn't". */
export function revisionOf(text: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193)
    h2 = Math.imul(h2 + c, 0x85ebca6b) ^ (h2 >>> 13)
  }
  return ((h1 >>> 0).toString(16) + (h2 >>> 0).toString(16)).padStart(16, '0')
}

export interface PublishedTrip {
  data: TripData
  revision: string
}

function looksLikeTripData(value: unknown): value is TripData {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return COLLECTIONS.every((c) => record[c] && typeof record[c] === 'object')
}

/**
 * Fetch the published plan. Returns null rather than throwing: offline, a
 * `file://` origin and a half-deployed site are all ordinary, and every caller
 * has a sensible answer for "there isn't one".
 */
export async function fetchPublishedTrip(): Promise<PublishedTrip | null> {
  if (typeof fetch !== 'function') return null
  try {
    // cache: no-store so an update check asks the network, not the disk cache.
    const response = await fetch(TRIP_URL, { cache: 'no-store' })
    if (!response.ok) return null
    const text = await response.text()
    const parsed: unknown = JSON.parse(text)
    if (!looksLikeTripData(parsed)) return null
    return { data: parsed, revision: revisionOf(text) }
  } catch {
    return null
  }
}

/* ------------------------------------------------------------ proposing */

/**
 * Where a contributor goes to propose their edited itinerary.
 *
 * GitHub forks the repository automatically for anyone without write access
 * and offers "create a new branch and start a pull request", so this needs no
 * token, no OAuth app and no backend — and the owner still has to merge before
 * anything reaches the published plan.
 */
export function proposeUrl(): string {
  return `https://github.com/${REPO}/upload/${BRANCH}/public/trips`
}

/** The diff view for a proposal that is already open. */
export function pullRequestsUrl(): string {
  return `https://github.com/${REPO}/pulls`
}

/** The canonical file as GitHub renders it. */
export function publishedFileUrl(): string {
  return `https://github.com/${REPO}/blob/${BRANCH}/${TRIP_PATH}`
}
