import type { TripData } from '@/domain/types'

/**
 * Live state sharing between windows of the same app — detached Electron
 * panels, or two browser tabs. Purely local (BroadcastChannel), so it works
 * offline and needs no server.
 */

const CHANNEL = 'atlas-sync'

let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL)
    } catch {
      return null
    }
  }
  return channel
}

/** Id of this window, so we ignore our own echoes. */
const SELF = Math.random().toString(36).slice(2)

export function broadcastData(data: TripData): void {
  const ch = getChannel()
  if (!ch) return
  try {
    ch.postMessage({ from: SELF, data })
  } catch {
    /* structured clone failure — state stays local to this window */
  }
}

export function onRemoteData(handler: (data: TripData) => void): () => void {
  const ch = getChannel()
  if (!ch) return () => {}
  const listener = (event: MessageEvent) => {
    const payload = event.data as { from?: string; data?: TripData } | null
    if (!payload || payload.from === SELF || !payload.data) return
    handler(payload.data)
  }
  ch.addEventListener('message', listener)
  return () => ch.removeEventListener('message', listener)
}
