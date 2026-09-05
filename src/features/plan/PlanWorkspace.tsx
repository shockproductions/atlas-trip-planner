import { useEffect, useMemo } from 'react'
import type { Trip } from '@/domain/types'
import { groupWarningsByDay, type Warning } from '@/domain/warnings'
import { listDays } from '@/domain/selectors'
import { useTripStore } from '@/store/tripStore'
import { useUiStore, type DockView } from '@/store/uiStore'
import { DayRail } from '@/features/timeline/DayRail'
import { DayPanel } from '@/features/day/DayPanel'
import { IdeasPanel } from '@/features/ideas/IdeasPanel'
import { LazyMapPanel } from '@/features/map/LazyMap'
import { ActivityInspector } from '@/features/activity/ActivityInspector'
import { WarningList } from '@/features/warnings/WarningList'
import { Split } from '@/ui/primitives'
import { Icon } from '@/ui/Icon'
import { openPanelWindow } from '@/platform/windows'

/**
 * The desktop planning workspace: the trip's days, the open day, and a dock
 * that holds the map, the ideas inbox, the warning list or the inspector.
 * Every pane is independently resizable and every pane can be torn off into
 * its own window.
 */
export function PlanWorkspace({ trip, warnings }: { trip: Trip; warnings: Warning[] }) {
  const data = useTripStore((s) => s.data)
  const panels = useUiStore((s) => s.panels)
  const setPanels = useUiStore((s) => s.setPanels)
  const dock = useUiStore((s) => s.dock)
  const setDock = useUiStore((s) => s.setDock)
  const dockOpen = useUiStore((s) => s.dockOpen)
  const toggleDock = useUiStore((s) => s.toggleDock)
  const selectedDayId = useUiStore((s) => s.selectedDayId)
  const selectDay = useUiStore((s) => s.selectDay)
  const selectedActivityId = useUiStore((s) => s.selectedActivityId)
  const selectActivity = useUiStore((s) => s.selectActivity)

  const days = useMemo(() => listDays(data, trip.id), [data, trip.id])
  const warningsByDay = useMemo(() => groupWarningsByDay(warnings), [warnings])
  const day = selectedDayId ? data.days[selectedDayId] : undefined
  const selectedActivity = selectedActivityId ? data.activities[selectedActivityId] : undefined

  // Keep a day open at all times; fall back to the first day of the trip.
  useEffect(() => {
    if ((!selectedDayId || !data.days[selectedDayId]) && days.length) selectDay(days[0].id)
  }, [selectedDayId, days, data.days, selectDay])

  const activityWarnings = useMemo(
    () => (selectedActivityId ? warnings.filter((w) => w.activityIds.includes(selectedActivityId)) : []),
    [warnings, selectedActivityId],
  )

  const dockTabs: { id: DockView; label: string; icon: 'pin' | 'bulb' | 'alert' }[] = [
    { id: 'map', label: 'Map', icon: 'pin' },
    { id: 'ideas', label: 'Ideas', icon: 'bulb' },
    { id: 'warnings', label: 'Checks', icon: 'alert' },
  ]

  const dockContent = (
    <div className="panel">
      <div className="panel__head">
        <div className="segmented">
          {dockTabs.map((tab) => (
            <button
              key={tab.id}
              className={dock === tab.id ? 'is-on' : ''}
              onClick={() => setDock(tab.id)}
            >
              <Icon name={tab.icon} size={13} />
              {tab.label}
              {tab.id === 'warnings' && warnings.some((w) => w.severity === 'warning') ? (
                <span className="nav__count is-warn">
                  {warnings.filter((w) => w.severity === 'warning').length}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="topbar__spacer" />
        <button
          className="btn btn--ghost btn--icon btn--sm"
          title={`Open ${dock === 'ideas' ? 'ideas' : 'map'} in its own window`}
          aria-label="Detach panel"
          onClick={() => openPanelWindow(dock === 'ideas' ? 'ideas' : 'map', trip.id)}
          disabled={dock === 'warnings'}
        >
          <Icon name="detach" size={14} />
        </button>
        <button
          className="btn btn--ghost btn--icon btn--sm"
          title="Hide this panel"
          aria-label="Hide panel"
          onClick={() => toggleDock(false)}
        >
          <Icon name="close" size={14} />
        </button>
      </div>
      <div className="panel__body panel__body--flush">
        {dock === 'map' ? (
          <LazyMapPanel tripId={trip.id} />
        ) : dock === 'ideas' ? (
          <IdeasPanel tripId={trip.id} />
        ) : (
          <div className="panel__body" style={{ padding: 10 }}>
            {warnings.length ? (
              <WarningList warnings={warnings} onPickDay={selectDay} />
            ) : (
              <div className="empty">
                <Icon name="check" size={20} />
                <div className="empty__title">No issues found</div>
                <div className="empty__body">
                  Timing, distances, opening hours and accommodation all look consistent.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  const dockPane = selectedActivity ? (
    <Split
      direction="column"
      size={panels.inspector}
      onSize={(inspector) => setPanels({ inspector })}
      min={0.2}
      max={0.8}
      className="panel"
    >
      {[
        dockContent,
        <ActivityInspector
          key="insp"
          activityId={selectedActivity.id}
          warnings={activityWarnings}
          onClose={() => selectActivity(null)}
        />,
      ]}
    </Split>
  ) : (
    dockContent
  )

  return (
    <Split
      size={panels.rail}
      onSize={(rail) => setPanels({ rail })}
      min={0.1}
      max={0.32}
      className="flex-1"
    >
      {[
        <div className="panel" key="rail">
          <div className="panel__head">
            <span className="panel__title">Days</span>
            <div className="topbar__spacer" />
            <span className="muted tabular" style={{ fontSize: 11 }}>
              {days.length}
            </span>
          </div>
          <div className="panel__body">
            <DayRail
              days={days}
              selectedDayId={selectedDayId}
              onSelect={selectDay}
              warningsByDay={warningsByDay}
            />
          </div>
        </div>,

        <Split
          key="right"
          size={dockOpen ? 1 - panels.dock : 0.999}
          onSize={(v) => setPanels({ dock: 1 - v })}
          min={0.3}
          max={dockOpen ? 0.85 : 0.999}
        >
          {[
            <div className="panel" key="day">
              <div className="panel__head">
                <span className="panel__title">Itinerary</span>
                <div className="topbar__spacer" />
                {day ? (
                  <button
                    className="btn btn--ghost btn--icon btn--sm"
                    title="Open this day in its own window"
                    aria-label="Detach day"
                    onClick={() => openPanelWindow('day', trip.id, day.id)}
                  >
                    <Icon name="detach" size={14} />
                  </button>
                ) : null}
                {!dockOpen ? (
                  <button className="btn btn--sm" onClick={() => toggleDock(true)}>
                    <Icon name="layers" size={13} /> Show panel
                  </button>
                ) : null}
              </div>
              <div className="panel__body panel__body--flush">
                {day ? (
                  <DayPanel day={day} warnings={warningsByDay.get(day.id) ?? []} />
                ) : (
                  <div className="empty">No day selected.</div>
                )}
              </div>
            </div>,

            dockOpen ? dockPane : <div key="empty" />,
          ]}
        </Split>,
      ]}
    </Split>
  )
}
