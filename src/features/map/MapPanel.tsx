import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Activity, ActivityCategory, ID, Location, TripData } from '@/domain/types'
import { categoryMeta } from '@/domain/categories'
import { activitiesForDay, listDays } from '@/domain/selectors'
import { compareActivities, dayOfMonth, monthShort, weekdayShort } from '@/domain/time'
import { useTripStore } from '@/store/tripStore'
import { useUiStore } from '@/store/uiStore'
import { getTileConfig } from '@/platform/mapConfig'
import { Icon } from '@/ui/Icon'

export interface MapItem {
  location: Location
  activities: Activity[]
  /** Position within the selected day, shown in the pin. */
  index?: number
}

/** Everything on the trip that has coordinates, grouped by place. */
export function collectMapItems(
  data: TripData,
  tripId: ID,
  opts: { dayId?: ID | 'all'; categories?: ActivityCategory[] | null } = {},
): MapItem[] {
  const dayFilter = opts.dayId ?? 'all'
  const byLocation = new Map<ID, MapItem>()

  const activities = Object.values(data.activities)
    .filter((a) => a.tripId === tripId && a.locationId)
    .filter((a) => (dayFilter === 'all' ? true : a.dayId === dayFilter))
    .filter((a) => (opts.categories?.length ? opts.categories.includes(a.category) : true))
    .sort(compareActivities)

  for (const activity of activities) {
    const location = data.locations[activity.locationId!]
    if (!location || location.lat == null || location.lng == null) continue
    const entry = byLocation.get(location.id) ?? { location, activities: [] }
    entry.activities.push(activity)
    byLocation.set(location.id, entry)
  }

  // Stays are shown even on days where no activity references them.
  if (!opts.categories?.length || opts.categories.includes('accommodation')) {
    for (const stay of Object.values(data.accommodations)) {
      if (stay.tripId !== tripId || !stay.locationId) continue
      const location = data.locations[stay.locationId]
      if (!location || location.lat == null || location.lng == null) continue
      if (byLocation.has(location.id)) continue
      if (dayFilter !== 'all') {
        const day = data.days[dayFilter]
        if (!day || !(stay.checkInDate <= day.date && day.date < stay.checkOutDate)) continue
      }
      byLocation.set(location.id, { location, activities: [] })
    }
  }

  const items = [...byLocation.values()]
  if (dayFilter !== 'all') items.forEach((item, i) => (item.index = i + 1))
  return items
}

function pinHtml(item: MapItem, active: boolean, dimmed: boolean): string {
  const primary = item.activities[0]
  const tone = primary ? categoryMeta(primary.category).tone : 'stay'
  const label = item.index != null ? String(item.index) : item.activities.length > 1 ? String(item.activities.length) : ''
  return `<div class="pin-wrap${active ? ' is-active' : ''}${dimmed ? ' is-dim' : ''}"><div class="pin cat--${tone}" style="--tone: var(--cat-${tone})"><span class="pin__inner">${label}</span></div></div>`
}

interface Props {
  tripId: ID
}

/**
 * The map is a view of the same trip data as the itinerary — never a separate
 * copy. Selecting an activity anywhere highlights it here, and vice versa.
 */
export function MapPanel({ tripId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const markersRef = useRef<Map<ID, L.Marker>>(new Map())
  const routeRef = useRef<L.Polyline | null>(null)
  const fittedRef = useRef<string>('')

  const data = useTripStore((s) => s.data)
  const dayFilter = useUiStore((s) => s.mapDayFilter)
  const setDayFilter = useUiStore((s) => s.setMapDayFilter)
  const categories = useUiStore((s) => s.mapCategories)
  const toggleCategory = useUiStore((s) => s.toggleMapCategory)
  const clearCategories = useUiStore((s) => s.clearMapCategories)
  const showRoutes = useUiStore((s) => s.showRoutes)
  const toggleRoutes = useUiStore((s) => s.toggleRoutes)
  const selectedActivityId = useUiStore((s) => s.selectedActivityId)
  const hoveredActivityId = useUiStore((s) => s.hoveredActivityId)
  const selectActivity = useUiStore((s) => s.selectActivity)
  const selectDay = useUiStore((s) => s.selectDay)

  const days = useMemo(() => listDays(data, tripId), [data, tripId])
  const items = useMemo(
    () => collectMapItems(data, tripId, { dayId: dayFilter, categories }),
    [data, tripId, dayFilter, categories],
  )

  const presentCategories = useMemo(() => {
    const set = new Set<ActivityCategory>()
    for (const a of Object.values(data.activities)) {
      if (a.tripId === tripId && a.locationId && data.locations[a.locationId]?.lat != null) {
        set.add(a.category)
      }
    }
    return [...set]
  }, [data, tripId])

  /* ------------------------------------------------------ init map */

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const tiles = getTileConfig()
    const map = L.map(containerRef.current, {
      // The filter bar owns the top of the map, so zoom sits bottom-left.
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
    }).setView([35.68, 139.76], 5)
    L.control.zoom({ position: 'bottomleft' }).addTo(map)
    L.tileLayer(tiles.url, { attribution: tiles.attribution, maxZoom: tiles.maxZoom }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    const markers = markersRef.current

    // The dock pane is resizable; Leaflet needs a nudge when its box changes.
    const ro =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => map.invalidateSize())
        : null
    if (ro && containerRef.current) ro.observe(containerRef.current)

    return () => {
      ro?.disconnect()
      map.remove()
      mapRef.current = null
      layerRef.current = null
      markers.clear()
    }
  }, [])

  /* -------------------------------------------------- draw markers */

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return

    layer.clearLayers()
    markersRef.current.clear()

    for (const item of items) {
      const { lat, lng } = item.location
      if (lat == null || lng == null) continue
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: 'pin-icon',
          html: pinHtml(item, false, false),
          iconSize: [24, 24],
          iconAnchor: [12, 22],
        }),
        title: item.location.name,
        riseOnHover: true,
      })

      const lines = item.activities
        .map((a) => {
          const day = a.dayId ? data.days[a.dayId] : undefined
          const when = day ? `${weekdayShort(day.date)} ${dayOfMonth(day.date)}` : 'Idea'
          return `<div class="mappop__meta">${when} · ${escapeHtml(a.title)}</div>`
        })
        .join('')

      marker.bindPopup(
        `<div class="mappop__title">${escapeHtml(item.location.name)}</div>${
          lines || '<div class="mappop__meta">Accommodation</div>'
        }`,
      )

      marker.on('click', () => {
        const first = item.activities[0]
        if (first) {
          selectActivity(first.id)
          if (first.dayId) selectDay(first.dayId)
        }
      })

      marker.addTo(layer)
      markersRef.current.set(item.location.id, marker)
    }

    // Fit once per distinct set of places so the user's pan/zoom is respected.
    const signature = items.map((i) => i.location.id).join('|')
    if (signature && signature !== fittedRef.current) {
      fittedRef.current = signature
      const bounds = L.latLngBounds(
        items.map((i) => [i.location.lat as number, i.location.lng as number] as [number, number]),
      )
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [42, 42], maxZoom: 14 })
    }
  }, [items, data.days, selectActivity, selectDay])

  /* ---------------------------------------------------- draw route */

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    routeRef.current?.remove()
    routeRef.current = null
    if (!showRoutes || dayFilter === 'all') return

    const ordered = activitiesForDay(data, dayFilter)
      .map((a) => (a.locationId ? data.locations[a.locationId] : undefined))
      .filter((l): l is Location => !!l && l.lat != null && l.lng != null)
    if (ordered.length < 2) return

    routeRef.current = L.polyline(
      ordered.map((l) => [l.lat as number, l.lng as number] as [number, number]),
      {
        color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#146b60',
        weight: 2.5,
        opacity: 0.65,
        dashArray: '5 6',
      },
    ).addTo(map)
  }, [data, dayFilter, showRoutes])

  /* ------------------------------------------------- highlighting */

  useEffect(() => {
    const activeId = hoveredActivityId ?? selectedActivityId
    const activeActivity = activeId ? data.activities[activeId] : undefined
    const activeLocationId = activeActivity?.locationId

    for (const item of items) {
      const marker = markersRef.current.get(item.location.id)
      if (!marker) continue
      const isActive = !!activeLocationId && item.location.id === activeLocationId
      marker.setIcon(
        L.divIcon({
          className: 'pin-icon',
          html: pinHtml(item, isActive, Boolean(activeLocationId) && !isActive),
          iconSize: [24, 24],
          iconAnchor: [12, 22],
        }),
      )
      if (isActive && mapRef.current) {
        const map = mapRef.current
        const latlng = marker.getLatLng()
        if (!map.getBounds().pad(-0.15).contains(latlng)) map.panTo(latlng, { animate: true })
      }
    }
  }, [hoveredActivityId, selectedActivityId, items, data.activities])

  const tiles = getTileConfig()

  return (
    <div className="map">
      <div className="map__canvas" ref={containerRef} />

      <div className="map__bar">
          <div className="map__panel map__panel--fixed">
            <select
              className="select"
              style={{ width: 170, minWidth: 110 }}
              value={dayFilter}
              aria-label="Filter map by day"
              onChange={(e) => setDayFilter(e.target.value as ID | 'all')}
            >
              <option value="all">Whole trip</option>
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  {weekdayShort(d.date)} {dayOfMonth(d.date)} {monthShort(d.date)}
                  {d.locationLabel ? ` · ${d.locationLabel}` : ''}
                </option>
              ))}
            </select>
            <button
              className={`btn btn--sm${showRoutes ? ' is-on' : ''}`}
              onClick={toggleRoutes}
              title="Show the day's route"
              disabled={dayFilter === 'all'}
            >
              <Icon name="route" size={13} /> Route
            </button>
          </div>

          <div className="map__panel map__panel--scroll">
            <button
              className={`chip chip--button${categories ? '' : ' is-on'}`}
              onClick={clearCategories}
            >
              All
            </button>
            {presentCategories.map((c) => (
              <button
                key={c}
                className={`chip chip--button${categories?.includes(c) ? ' is-on' : ''}`}
                onClick={() => toggleCategory(c)}
              >
                <Icon name={categoryMeta(c).icon} size={11} />
                {categoryMeta(c).label}
              </button>
            ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="map__note">
          Nothing to show here yet. Add coordinates to a place in the activity inspector and it will
          appear on the map.
        </div>
      ) : tiles.isDefault ? null : null}
    </div>
  )
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  )
}
