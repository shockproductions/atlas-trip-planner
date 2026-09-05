import { useState } from 'react'
import type { Day, ID, TripData } from '@/domain/types'
import { accommodationForDate, activitiesForDay } from '@/domain/selectors'
import { categoryMeta } from '@/domain/categories'
import { dayOfMonth, monthShort, todayStr, weekdayShort } from '@/domain/time'
import type { Warning } from '@/domain/warnings'
import { useTripStore } from '@/store/tripStore'
import { isActivityDrag, readDrop } from '@/app/dnd'
import { Icon } from '@/ui/Icon'

/**
 * The trip's spine. Every day of the trip, always visible while planning, and
 * a drop target so an activity can be thrown at a day without opening it.
 */
export function DayRail({
  days,
  selectedDayId,
  onSelect,
  warningsByDay,
}: {
  days: Day[]
  selectedDayId: ID | null
  onSelect: (id: ID) => void
  warningsByDay: Map<ID, Warning[]>
}) {
  const data = useTripStore((s) => s.data)
  const moveActivity = useTripStore((s) => s.moveActivity)
  const [dropDayId, setDropDayId] = useState<ID | null>(null)
  const today = todayStr()

  return (
    <div className="rail">
      {days.map((day) => (
        <RailDay
          key={day.id}
          day={day}
          active={day.id === selectedDayId}
          isToday={day.date === today}
          dropping={dropDayId === day.id}
          warnings={warningsByDay.get(day.id) ?? []}
          onSelect={() => onSelect(day.id)}
          onDragOver={(e) => {
            if (!isActivityDrag(e)) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setDropDayId(day.id)
          }}
          onDragLeave={() => setDropDayId((id) => (id === day.id ? null : id))}
          onDrop={(e) => {
            e.preventDefault()
            setDropDayId(null)
            const payload = readDrop(e)
            if (!payload) return
            moveActivity(payload.activityId, day.id)
            onSelect(day.id)
          }}
          activityCount={
            activitiesForDay(data, day.id).filter(
              (a) => a.status !== 'skipped' && a.category !== 'freeTime',
            ).length
          }
          dots={dots(data, day.id)}
          stayName={accommodationForDate(data, day.tripId, day.date)?.name}
        />
      ))}
    </div>
  )
}

/** Up to five category dots — a glance-level fingerprint of the day. */
function dots(data: TripData, dayId: ID): string[] {
  return activitiesForDay(data, dayId)
    .filter((a) => a.status !== 'skipped')
    .slice(0, 5)
    .map((a) => categoryMeta(a.category).tone)
}

interface RailDayProps {
  day: Day
  active: boolean
  isToday: boolean
  dropping: boolean
  warnings: Warning[]
  activityCount: number
  dots: string[]
  stayName?: string
  onSelect: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
}

function RailDay({
  day,
  active,
  isToday,
  dropping,
  warnings,
  activityCount,
  dots,
  stayName,
  onSelect,
  onDragOver,
  onDragLeave,
  onDrop,
}: RailDayProps) {
  const realWarnings = warnings.filter((w) => w.severity === 'warning')
  return (
    <button
      className={`rail__day${active ? ' is-active' : ''}${dropping ? ' is-drop' : ''}`}
      onClick={onSelect}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      title={stayName ? `Staying at ${stayName}` : undefined}
    >
      {isToday ? <span className="rail__today" aria-label="Today" /> : null}
      <div className="rail__date">
        <div className="rail__dow">{weekdayShort(day.date)}</div>
        <div className="rail__dom">{dayOfMonth(day.date)}</div>
      </div>
      <div className="rail__main">
        <div className="rail__place">{day.locationLabel || monthShort(day.date)}</div>
        <div className="rail__headline">
          {day.headline || (activityCount ? `${activityCount} planned` : 'Open day')}
        </div>
        <div className="rail__meta">
          <span className="rail__dots">
            {dots.map((tone, i) => (
              <span key={i} className="rail__dot" style={{ '--tone': `var(--cat-${tone})` } as React.CSSProperties} />
            ))}
          </span>
          {realWarnings.length ? (
            <span style={{ color: 'var(--warn)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <Icon name="alert" size={11} />
              {realWarnings.length}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  )
}
