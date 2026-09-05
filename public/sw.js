/**
 * Offline shell for the web build.
 *
 * The itinerary itself lives in IndexedDB and never needs the network; this
 * only makes sure the app *code* is available offline too. Map tiles are
 * cached opportunistically, so areas already looked at keep working — the
 * groundwork for explicit offline map downloads later.
 *
 * Not used by the Electron or Capacitor builds, which load from local files.
 */

const SHELL = 'atlas-shell-v1'
const TILES = 'atlas-tiles-v1'
const TILE_LIMIT = 600

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(['./', './index.html']))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL && k !== TILES).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

/** Keep the tile cache from growing without bound. */
async function trimTiles() {
  const cache = await caches.open(TILES)
  const keys = await cache.keys()
  if (keys.length <= TILE_LIMIT) return
  await Promise.all(keys.slice(0, keys.length - TILE_LIMIT).map((k) => cache.delete(k)))
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      // Fresh code when online, the cached shell when not.
      event.respondWith(
        fetch(request)
          .then((response) => {
            const copy = response.clone()
            void caches.open(SHELL).then((c) => c.put('./index.html', copy))
            return response
          })
          .catch(() => caches.match('./index.html').then((hit) => hit ?? Response.error())),
      )
      return
    }
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok && response.type === 'basic') {
              const copy = response.clone()
              void caches.open(SHELL).then((c) => c.put(request, copy))
            }
            return response
          }),
      ),
    )
    return
  }

  // Map tiles: serve what we have, fetch and remember what we don't.
  if (/tile|maptiler|basemaps/i.test(url.host)) {
    event.respondWith(
      caches.match(request).then((hit) => {
        if (hit) return hit
        return fetch(request)
          .then((response) => {
            if (response.ok || response.type === 'opaque') {
              const copy = response.clone()
              void caches.open(TILES).then(async (c) => {
                await c.put(request, copy)
                await trimTiles()
              })
            }
            return response
          })
          .catch(() => Response.error())
      }),
    )
  }
})
