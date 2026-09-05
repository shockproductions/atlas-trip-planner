import type { ID } from '@/domain/types'

/**
 * Detachable panels.
 *
 * A panel opens as a real OS window under Electron and as a browser window
 * elsewhere; both load the same app at a standalone panel route. State stays in
 * sync through the BroadcastChannel in `data/sync.ts`, so a map on the second
 * monitor updates as you plan on the first.
 */

export type PanelKind = 'map' | 'ideas' | 'day' | 'travel'

const SIZES: Record<PanelKind, { width: number; height: number }> = {
  map: { width: 1000, height: 760 },
  ideas: { width: 460, height: 780 },
  day: { width: 720, height: 900 },
  travel: { width: 460, height: 880 },
}

export function canDetachWindows(): boolean {
  return typeof window !== 'undefined' && typeof window.open === 'function'
}

export function openPanelWindow(kind: PanelKind, tripId: ID, dayId?: ID): void {
  const hash = `#/panel/${kind}/${tripId}${dayId ? `/${dayId}` : ''}`
  const { origin, pathname } = window.location
  const url = `${origin}${pathname}${hash}`
  const { width, height } = SIZES[kind]
  window.open(
    url,
    `atlas-${kind}-${dayId ?? tripId}`,
    `popup=yes,width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no`,
  )
}

/** True when this document is itself a detached panel window. */
export function isPanelWindow(): boolean {
  return typeof window !== 'undefined' && window.location.hash.startsWith('#/panel/')
}
