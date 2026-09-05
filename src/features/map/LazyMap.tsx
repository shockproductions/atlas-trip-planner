import { Suspense, lazy } from 'react'
import type { ComponentProps } from 'react'
import type { MapPanel as MapPanelType } from './MapPanel'

const MapPanel = lazy(() => import('./MapPanel').then((m) => ({ default: m.MapPanel })))

/**
 * Leaflet is the largest dependency in the app and the itinerary does not need
 * it, so the map loads on demand. Everything else stays usable meanwhile.
 */
export function LazyMapPanel(props: ComponentProps<typeof MapPanelType>) {
  return (
    <Suspense
      fallback={
        <div className="map">
          <div className="empty" style={{ height: '100%' }}>
            Loading map…
          </div>
        </div>
      }
    >
      <MapPanel {...props} />
    </Suspense>
  )
}
