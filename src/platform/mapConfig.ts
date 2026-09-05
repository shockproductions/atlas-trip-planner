/**
 * Map tile configuration.
 *
 * Defaults to OpenStreetMap, which needs no key and is fine for development
 * and light use. For production, point these at a provider you have a plan
 * with (MapTiler, Stadia, Mapbox…) via a `.env.local` file — see `.env.example`.
 * Nothing here is ever committed with a real key, and the app degrades to a
 * blank canvas (itinerary intact) when tiles cannot load.
 */

interface MapTileConfig {
  url: string
  attribution: string
  maxZoom: number
  /** True when the tiles come from the keyless OSM default. */
  isDefault: boolean
}

const env = import.meta.env as Record<string, string | undefined>

const OSM: MapTileConfig = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© OpenStreetMap contributors',
  maxZoom: 19,
  isDefault: true,
}

export function getTileConfig(): MapTileConfig {
  const url = env.VITE_MAP_TILE_URL
  if (!url) return OSM
  const key = env.VITE_MAP_API_KEY
  return {
    url: key ? url.replace('{key}', key) : url,
    attribution: env.VITE_MAP_ATTRIBUTION ?? '',
    maxZoom: Number(env.VITE_MAP_MAX_ZOOM ?? 20),
    isDefault: false,
  }
}

/** Deep link that opens the platform's own maps app for navigation. */
export function navigationUrl(lat: number, lng: number, label?: string): string {
  const query = encodeURIComponent(label ? `${label}` : `${lat},${lng}`)
  const isApple =
    typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)
  return isApple
    ? `https://maps.apple.com/?ll=${lat},${lng}&q=${query}`
    : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
}
