import { useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { computeWarnings, groupWarningsByDay } from '@/domain/warnings'
import { dayOfMonth, monthShort, weekdayLong } from '@/domain/time'
import { useTripStore } from '@/store/tripStore'
import { useUiStore } from '@/store/uiStore'
import { LazyMapPanel } from '@/features/map/LazyMap'
import { IdeasPanel } from '@/features/ideas/IdeasPanel'
import { DayPanel } from '@/features/day/DayPanel'
import { TravelView } from '@/features/travel/TravelView'
import type { PanelKind } from '@/platform/windows'

/**
 * A single panel rendered as its own window (second monitor, or just a
 * separate window). It reads the same store and receives live updates through
 * the BroadcastChannel, so edits here and in the main window stay in step.
 */
export function PanelWindow() {
  const { kind, tripId = '', dayId } = useParams<{ kind: PanelKind; tripId: string; dayId?: string }>()
  const data = useTripStore((s) => s.data)
  const setActiveTrip = useTripStore((s) => s.setActiveTrip)
  const theme = useUiStore((s) => s.theme)

  const trip = data.trips[tripId]

  useEffect(() => {
    if (trip) setActiveTrip(trip.id)
  }, [trip, setActiveTrip])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      root.setAttribute(
        'data-theme',
        window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      )
    } else {
      root.setAttribute('data-theme', theme)
    }
  }, [theme])

  const warnings = useMemo(() => (trip ? computeWarnings(data, trip.id) : []), [data, trip])
  const byDay = useMemo(() => groupWarningsByDay(warnings), [warnings])

  useEffect(() => {
    const titles: Record<string, string> = {
      map: 'Map',
      ideas: 'Ideas',
      day: 'Day',
      travel: 'Travel mode',
    }
    document.title = `${titles[kind ?? ''] ?? 'Panel'} — ${trip?.name ?? 'Atlas'}`
  }, [kind, trip])

  if (!trip) {
    return <div className="empty" style={{ height: '100%' }}>That trip is no longer available.</div>
  }

  const day = dayId ? data.days[dayId] : undefined

  return (
    <div className="app">
      <div className="app__body">
        <header className="topbar">
          <div style={{ minWidth: 0 }}>
            <div className="topbar__title">
              {kind === 'day' && day
                ? `${weekdayLong(day.date)} ${dayOfMonth(day.date)} ${monthShort(day.date)}`
                : kind === 'map'
                  ? 'Map'
                  : kind === 'ideas'
                    ? 'Ideas'
                    : 'Travel mode'}
            </div>
            <div className="topbar__sub">{trip.name}</div>
          </div>
        </header>

        {kind === 'map' ? (
          <div className="split" style={{ flex: 1 }}>
            <LazyMapPanel tripId={trip.id} />
          </div>
        ) : kind === 'ideas' ? (
          <IdeasPanel tripId={trip.id} />
        ) : kind === 'day' && day ? (
          <DayPanel day={day} warnings={byDay.get(day.id) ?? []} />
        ) : kind === 'travel' ? (
          <TravelView trip={trip} onOpenDay={() => {}} onGoto={() => {}} />
        ) : (
          <div className="empty">Unknown panel.</div>
        )}
      </div>
    </div>
  )
}
