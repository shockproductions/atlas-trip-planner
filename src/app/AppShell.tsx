import { useEffect, useMemo } from 'react'
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useLocation,
} from 'react-router-dom'
import type { ID } from '@/domain/types'
import { computeWarnings, groupWarningsByDay } from '@/domain/warnings'
import { ideasForTrip, listDays } from '@/domain/selectors'
import { formatDateSpan, dayOfMonth, monthShort, weekdayLong } from '@/domain/time'
import { useTripStore } from '@/store/tripStore'
import { useUiStore } from '@/store/uiStore'
import { useMediaQuery } from '@/ui/primitives'
import { Icon, type IconName } from '@/ui/Icon'
import { OverviewView } from '@/features/overview/OverviewView'
import { PlanWorkspace } from '@/features/plan/PlanWorkspace'
import { WeeklyView } from '@/features/timeline/WeeklyView'
import { DayPanel } from '@/features/day/DayPanel'
import { IdeasPanel } from '@/features/ideas/IdeasPanel'
import { LazyMapPanel } from '@/features/map/LazyMap'
import { BookingsView } from '@/features/bookings/BookingsView'
import { TravelView } from '@/features/travel/TravelView'
import { SettingsView } from '@/features/settings/SettingsView'
import { TripsView } from '@/features/trips/TripsView'
import { ActivityInspector } from '@/features/activity/ActivityInspector'
import { PanelWindow } from './PanelWindow'
import { useKeyboardShortcuts } from './shortcuts'
import { UndoToast } from './UndoToast'

const MOBILE = '(max-width: 900px)'

export function App() {
  const init = useTripStore((s) => s.init)
  const ready = useTripStore((s) => s.ready)
  const theme = useUiStore((s) => s.theme)

  useEffect(() => {
    void init()
  }, [init])

  // Theme follows the OS unless the user has chosen otherwise.
  useEffect(() => {
    const root = document.documentElement
    const apply = () => {
      if (theme === 'system') {
        const dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
        root.setAttribute('data-theme', dark ? 'dark' : 'light')
      } else {
        root.setAttribute('data-theme', theme)
      }
    }
    apply()
    if (theme !== 'system' || !window.matchMedia) return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [theme])

  if (!ready) {
    return (
      <div className="empty" style={{ height: '100%' }}>
        <div className="nav__mark">A</div>
        <div className="empty__title">Loading your trips…</div>
      </div>
    )
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/panel/:kind/:tripId/:dayId?" element={<PanelWindow />} />
        <Route path="/*" element={<Shell />} />
      </Routes>
    </HashRouter>
  )
}

/* ------------------------------------------------------------- shell */

function Shell() {
  const activeTripId = useTripStore((s) => s.activeTripId)

  return (
    <Routes>
      <Route path="/trips" element={<Chrome><TripsRoute /></Chrome>} />
      <Route path="/trip/:tripId/*" element={<Chrome><TripRoutes /></Chrome>} />
      <Route
        path="*"
        element={<Navigate to={activeTripId ? `/trip/${activeTripId}/overview` : '/trips'} replace />}
      />
    </Routes>
  )
}

/** Nav + header, shared by every route. */
function Chrome({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(MOBILE)
  return (
    <div className="app">
      {!isMobile ? <SideNav /> : null}
      <div className="app__body">{children}</div>
      {isMobile ? <TabBar /> : null}
    </div>
  )
}

function TripsRoute() {
  const navigate = useNavigate()
  return (
    <>
      <TopBar title="Trips" subtitle="Everything you are planning" />
      <TripsView onOpenTrip={(id) => navigate(`/trip/${id}/overview`)} />
    </>
  )
}

/* --------------------------------------------------------- trip routes */

function TripRoutes() {
  const { tripId = '' } = useParams()
  const data = useTripStore((s) => s.data)
  const setActiveTrip = useTripStore((s) => s.setActiveTrip)
  const activeTripId = useTripStore((s) => s.activeTripId)
  const warningsMuted = useUiStore((s) => s.warningsMuted)
  const selectDay = useUiStore((s) => s.selectDay)
  const selectedDayId = useUiStore((s) => s.selectedDayId)
  const navigate = useNavigate()
  const isMobile = useMediaQuery(MOBILE)

  const trip = data.trips[tripId]

  useEffect(() => {
    if (trip && activeTripId !== trip.id) setActiveTrip(trip.id)
  }, [trip, activeTripId, setActiveTrip])

  const warnings = useMemo(
    () => (trip && !warningsMuted ? computeWarnings(data, trip.id) : []),
    [data, trip, warningsMuted],
  )

  const days = useMemo(() => (trip ? listDays(data, trip.id) : []), [data, trip])

  useKeyboardShortcuts(trip?.id ?? null)

  if (!trip) return <Navigate to="/trips" replace />

  const goto = (route: string) => navigate(`/trip/${trip.id}/${route}`)
  const openDay = (dayId: ID) => {
    selectDay(dayId)
    if (isMobile) navigate(`/trip/${trip.id}/day/${dayId}`)
    else navigate(`/trip/${trip.id}/plan`)
  }

  return (
    <>
      <Routes>
        <Route
          path="overview"
          element={
            <>
              <TopBar title={trip.name} subtitle={formatDateSpan(trip.startDate, trip.endDate)} />
              <OverviewView trip={trip} warnings={warnings} onOpenDay={openDay} onGoto={goto} />
            </>
          }
        />

        <Route
          path="plan"
          element={
            isMobile ? (
              <Navigate to={`/trip/${trip.id}/timeline`} replace />
            ) : (
              <>
                <TopBar
                  title={trip.name}
                  subtitle={`${days.length} days · ${warnings.filter((w) => w.severity === 'warning').length} checks`}
                />
                <PlanWorkspace trip={trip} warnings={warnings} />
              </>
            )
          }
        />

        <Route
          path="timeline"
          element={
            <>
              <TopBar title="Timeline" subtitle={formatDateSpan(trip.startDate, trip.endDate)} />
              <div className="view view--pad">
                <div className="wrap--wide">
                  <WeeklyView
                    days={days}
                    warnings={warnings}
                    selectedDayId={selectedDayId}
                    onOpenDay={openDay}
                  />
                </div>
              </div>
            </>
          }
        />

        <Route path="day/:dayId" element={<DayRoute warnings={warnings} />} />

        <Route
          path="map"
          element={
            <>
              <TopBar title="Map" subtitle="Everything with a location" />
              <div className="split" style={{ flex: 1 }}>
                <LazyMapPanel tripId={trip.id} />
              </div>
            </>
          }
        />

        <Route
          path="ideas"
          element={
            <>
              <TopBar title="Ideas" subtitle="Saved, not yet scheduled" />
              <IdeasPanel tripId={trip.id} />
            </>
          }
        />

        <Route
          path="bookings"
          element={
            <>
              <TopBar title="Bookings" subtitle="Stays, journeys and references" />
              <BookingsView trip={trip} onOpenDay={openDay} />
            </>
          }
        />

        <Route
          path="today"
          element={
            <>
              <TopBar title="Travel mode" subtitle={trip.name} />
              <TravelView trip={trip} onOpenDay={openDay} onGoto={goto} />
            </>
          }
        />

        <Route
          path="more"
          element={
            <>
              <TopBar title="More" subtitle={trip.name} />
              <MoreMenu tripId={trip.id} />
            </>
          }
        />

        <Route
          path="settings"
          element={
            <>
              <TopBar title="Settings" subtitle={trip.name} />
              <SettingsView trip={trip} />
            </>
          }
        />

        <Route path="*" element={<Navigate to={`/trip/${trip.id}/overview`} replace />} />
      </Routes>

      <MobileInspector warnings={warnings} />
      <UndoToast />
    </>
  )
}

/** Full-day view. On desktop it also carries the inspector beside it. */
function DayRoute({ warnings }: { warnings: ReturnType<typeof computeWarnings> }) {
  const { tripId = '', dayId = '' } = useParams()
  const data = useTripStore((s) => s.data)
  const selectDay = useUiStore((s) => s.selectDay)
  const day = data.days[dayId]

  useEffect(() => {
    if (day) selectDay(day.id)
  }, [day, selectDay])

  const byDay = useMemo(() => groupWarningsByDay(warnings), [warnings])
  if (!day) return <Navigate to={`/trip/${tripId}/timeline`} replace />

  return (
    <>
      <TopBar
        title={`${weekdayLong(day.date)} ${dayOfMonth(day.date)} ${monthShort(day.date)}`}
        subtitle={day.locationLabel ?? ''}
      />
      <DayPanel day={day} warnings={byDay.get(day.id) ?? []} />
    </>
  )
}

/* -------------------------------------------------------------- chrome */

function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const undo = useTripStore((s) => s.undo)
  const redo = useTripStore((s) => s.redo)
  const canUndo = useTripStore((s) => s.past.length > 0)
  const canRedo = useTripStore((s) => s.future.length > 0)
  const isMobile = useMediaQuery(MOBILE)

  return (
    <header className="topbar">
      <div style={{ minWidth: 0 }}>
        <div className="topbar__title">{title}</div>
        {subtitle ? <div className="topbar__sub">{subtitle}</div> : null}
      </div>
      <div className="topbar__spacer" />
      {!isMobile ? (
        <>
          <button
            className="btn btn--ghost btn--icon"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Icon name="undo" size={15} />
          </button>
          <button
            className="btn btn--ghost btn--icon"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            <Icon name="redo" size={15} />
          </button>
        </>
      ) : null}
    </header>
  )
}

interface NavEntry {
  to: string
  label: string
  icon: IconName
  count?: number
  warn?: boolean
}

function useNavEntries(tripId: ID | null): NavEntry[] {
  const data = useTripStore((s) => s.data)
  const warningsMuted = useUiStore((s) => s.warningsMuted)
  return useMemo(() => {
    if (!tripId || !data.trips[tripId]) return []
    const ideas = ideasForTrip(data, tripId).length
    const warnings = warningsMuted
      ? 0
      : computeWarnings(data, tripId).filter((w) => w.severity === 'warning').length
    return [
      { to: 'overview', label: 'Overview', icon: 'home' },
      { to: 'plan', label: 'Plan', icon: 'layers', count: warnings || undefined, warn: true },
      { to: 'timeline', label: 'Timeline', icon: 'calendar' },
      { to: 'map', label: 'Map', icon: 'pin' },
      { to: 'ideas', label: 'Ideas', icon: 'bulb', count: ideas || undefined },
      { to: 'bookings', label: 'Bookings', icon: 'ticket' },
      { to: 'today', label: 'Travel mode', icon: 'play' },
    ]
  }, [data, tripId, warningsMuted])
}

function SideNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const activeTripId = useTripStore((s) => s.activeTripId)
  const trip = useTripStore((s) => (s.activeTripId ? s.data.trips[s.activeTripId] : undefined))
  const entries = useNavEntries(activeTripId)
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)

  const isActive = (to: string) => location.pathname.includes(`/${to}`)

  return (
    <nav className="nav">
      <div className="nav__brand">
        <span className="nav__mark">A</span>
        <span className="nav__wordmark">Atlas</span>
      </div>

      <button className="nav__trip" onClick={() => navigate('/trips')} title="Switch trip">
        <div className="nav__trip-label">Trip</div>
        <div className="nav__trip-name">{trip?.name ?? 'No trip'}</div>
        {trip ? (
          <div className="nav__trip-dates">{formatDateSpan(trip.startDate, trip.endDate)}</div>
        ) : null}
      </button>

      {entries.map((entry) => (
        <button
          key={entry.to}
          className={`nav__item${isActive(entry.to) ? ' is-active' : ''}`}
          onClick={() => navigate(`/trip/${activeTripId}/${entry.to}`)}
          title={entry.label}
        >
          <Icon name={entry.icon} size={16} />
          <span className="nav__label">{entry.label}</span>
          {entry.count ? (
            <span className={`nav__count${entry.warn ? ' is-warn' : ''}`}>{entry.count}</span>
          ) : null}
        </button>
      ))}

      <div className="nav__spacer" />

      <div className="nav__foot">
        <button
          className="btn btn--ghost btn--icon"
          title="Switch theme"
          aria-label="Switch theme"
          onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
        >
          <Icon name={theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'settings'} size={15} />
        </button>
        <button
          className="btn btn--ghost btn--icon"
          title="Trips"
          aria-label="Trips"
          onClick={() => navigate('/trips')}
        >
          <Icon name="grid" size={15} />
        </button>
        <button
          className="btn btn--ghost btn--icon"
          title="Settings"
          aria-label="Settings"
          onClick={() => navigate(`/trip/${activeTripId}/settings`)}
        >
          <Icon name="settings" size={15} />
        </button>
      </div>
    </nav>
  )
}

function TabBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const activeTripId = useTripStore((s) => s.activeTripId)

  const tabs: { to: string; label: string; icon: IconName }[] = [
    { to: 'today', label: 'Today', icon: 'play' },
    { to: 'timeline', label: 'Trip', icon: 'calendar' },
    { to: 'map', label: 'Map', icon: 'pin' },
    { to: 'ideas', label: 'Ideas', icon: 'bulb' },
    { to: 'more', label: 'More', icon: 'grid' },
  ]

  if (!activeTripId) return null

  return (
    <nav className="tabbar">
      {tabs.map((tab) => (
        <button
          key={tab.to}
          className={`tabbar__item${location.pathname.includes(`/${tab.to}`) ? ' is-active' : ''}`}
          onClick={() => navigate(`/trip/${activeTripId}/${tab.to}`)}
        >
          <Icon name={tab.icon} size={19} />
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

function MoreMenu({ tripId }: { tripId: ID }) {
  const navigate = useNavigate()
  const items: { to: string; label: string; icon: IconName; hint: string }[] = [
    { to: 'overview', label: 'Trip overview', icon: 'home', hint: 'Stats, stays and checks' },
    { to: 'bookings', label: 'Bookings', icon: 'ticket', hint: 'Stays, journeys, references' },
    { to: 'settings', label: 'Settings', icon: 'settings', hint: 'Dates, theme, data' },
  ]
  return (
    <div className="view view--pad">
      <div className="panel-card">
        <div className="panel-card__body panel-card__body--flush">
          {items.map((item) => (
            <button
              key={item.to}
              className="list-row"
              onClick={() => navigate(`/trip/${tripId}/${item.to}`)}
            >
              <Icon name={item.icon} size={16} />
              <span className="list-row__main">
                <span className="list-row__title">{item.label}</span>
                <span className="list-row__sub">{item.hint}</span>
              </span>
              <Icon name="chevronRight" size={14} />
            </button>
          ))}
          <button className="list-row" onClick={() => navigate('/trips')}>
            <Icon name="grid" size={16} />
            <span className="list-row__main">
              <span className="list-row__title">All trips</span>
              <span className="list-row__sub">Switch or create a trip</span>
            </span>
            <Icon name="chevronRight" size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

/** On phones the inspector is a full-screen sheet rather than a panel. */
function MobileInspector({ warnings }: { warnings: ReturnType<typeof computeWarnings> }) {
  const isMobile = useMediaQuery(MOBILE)
  const selectedActivityId = useUiStore((s) => s.selectedActivityId)
  const selectActivity = useUiStore((s) => s.selectActivity)
  const exists = useTripStore((s) => (selectedActivityId ? !!s.data.activities[selectedActivityId] : false))

  const activityWarnings = useMemo(
    () => (selectedActivityId ? warnings.filter((w) => w.activityIds.includes(selectedActivityId)) : []),
    [warnings, selectedActivityId],
  )

  if (!isMobile || !selectedActivityId || !exists) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 700,
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <ActivityInspector
        activityId={selectedActivityId}
        warnings={activityWarnings}
        onClose={() => selectActivity(null)}
      />
    </div>
  )
}

