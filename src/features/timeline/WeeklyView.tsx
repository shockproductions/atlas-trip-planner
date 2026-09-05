import { useMemo, useState } from 'react'
import type { Activity, Day, ID, TripData } from '@/domain/types'
import { accommodationForDate, activitiesForDay } from '@/domain/selectors'
import { categoryMeta } from '@/domain/categories'
import { dayOfMonth, formatShortDate, monthShort, parseDate, todayStr, weekdayShort } from '@/domain/time'
import type { Warning } from '@/domain/warnings'
import { groupWarningsByDay } from '@/domain/warnings'
import { useTripStore } from '@/store/tripStore'
import { isActivityDrag, readDrop } from '@/app/dnd'
import { CategoryIcon } from '@/ui/primitives'
import { Icon } from '@/ui/Icon'

/**
 * The high-level view: what is happening during this part of the trip.
 * Deliberately concise — a day shows its headline, the two or three things
 * that define it, and where you sleep. Detail lives one click away.
 */
export function WeeklyView({
  days,
  warnings,
  selectedDayId,
  onOpenDay,
}: {
  days: Day[]
  warnings: Warning[]
  selectedDayId: ID | null
  onOpenDay: (dayId: ID) => void
}) {
  const data = useTripStore((s) => s.data)
  const moveActivity = useTripStore((s) => s.moveActivity)
  const [dropDayId, setDropDayId] = useState<ID | null>(null)
  const warningsByDay = useMemo(() => groupWarningsByDay(warnings), [warnings])
  const today = todayStr()

  const weeks = useMemo(() => groupIntoWeeks(days), [days])

  return (
    <div className="weeks">
      {weeks.map((week) => (
        <section key={week[0].id}>
          <div className="week__label">
            <span className="eyebrow">
              {formatShortDate(week[0].date)} – {formatShortDate(week[week.length - 1].date)}
            </span>
            <span className="muted" style={{ fontSize: 12 }}>
              {summariseWeek(data, week)}
            </span>
          </div>
          <div className="week__grid">
            {week.map((day) => (
              <WeekDayCard
                key={day.id}
                day={day}
                data={data}
                isToday={day.date === today}
                selected={day.id === selectedDayId}
                dropping={dropDayId === day.id}
                warnings={warningsByDay.get(day.id) ?? []}
                onOpen={() => onOpenDay(day.id)}
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
                  if (payload) moveActivity(payload.activityId, day.id)
                }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function WeekDayCard({
  day,
  data,
  isToday,
  selected,
  dropping,
  warnings,
  onOpen,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  day: Day
  data: TripData
  isToday: boolean
  selected: boolean
  dropping: boolean
  warnings: Warning[]
  onOpen: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
}) {
  const activities = activitiesForDay(data, day.id)
  const stay = accommodationForDate(data, day.tripId, day.date)
  // Free time and skipped items are not "things happening", so they are
  // neither highlighted nor counted in the overflow.
  const substantive = activities.filter(
    (a) => a.status !== 'skipped' && a.category !== 'freeTime',
  )
  const highlights = pickHighlights(activities)
  const realWarnings = warnings.filter((w) => w.severity === 'warning')

  return (
    <button
      className={[
        'wday',
        selected ? 'is-active' : '',
        dropping ? 'is-drop' : '',
        isToday ? 'is-today' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={onOpen}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="wday__top">
        <span className="wday__dow">{weekdayShort(day.date)}</span>
        <span className="wday__dom">{dayOfMonth(day.date)}</span>
        {day.locationLabel ? <span className="wday__place">{day.locationLabel}</span> : null}
      </div>

      <div className={`wday__headline${day.headline ? '' : ' is-placeholder'}`}>
        {day.headline ||
          (substantive.length ? `${substantive.length} planned` : 'Open day')}
      </div>

      <div className="wday__list">
        {highlights.map((a) => (
          <div className="wday__row" key={a.id}>
            <CategoryIcon category={a.category} size="sm" />
            <span>{a.title}</span>
          </div>
        ))}
        {substantive.length > highlights.length ? (
          <div className="wday__more">+{substantive.length - highlights.length} more</div>
        ) : null}
      </div>

      <div className="wday__foot">
        {stay ? (
          <span className="wday__stay">
            <Icon name="bed" size={11} />
            {stay.name}
          </span>
        ) : (
          <span className="wday__stay" style={{ color: 'var(--warn)' }}>
            <Icon name="bed" size={11} />
            No stay
          </span>
        )}
        {realWarnings.length ? (
          <span className="wday__warn" title={realWarnings.map((w) => w.message).join('\n')}>
            <Icon name="alert" size={11} />
            {realWarnings.length}
          </span>
        ) : null}
      </div>
    </button>
  )
}

/* --------------------------------------------------------------- utils */

function groupIntoWeeks(days: Day[]): Day[][] {
  const weeks: Day[][] = []
  let current: Day[] = []
  for (const day of days) {
    // Weeks break on Monday, so the grid lines up with a calendar.
    if (current.length && parseDate(day.date).getDay() === 1) {
      weeks.push(current)
      current = []
    }
    current.push(day)
  }
  if (current.length) weeks.push(current)
  return weeks
}

/**
 * The few activities that define a day: transport and bookings first, then
 * the longest items. Never the whole list — that is what the day view is for.
 */
function pickHighlights(activities: Activity[], limit = 3): Activity[] {
  const scored = activities
    .filter((a) => a.status !== 'skipped' && a.category !== 'freeTime')
    .map((a) => {
      let score = 0
      if (categoryMeta(a.category).isTransport) score += 100
      if (a.bookingId) score += 40
      if (a.category === 'accommodation') score -= 20 // shown separately in the footer
      score += Math.min(30, (a.durationMin ?? 0) / 6)
      if (a.optional) score -= 15
      return { a, score }
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((x) => x.a)

  // Preserve chronological order for readability.
  return activities.filter((a) => scored.includes(a))
}

function summariseWeek(data: TripData, week: Day[]): string {
  const places: string[] = []
  for (const day of week) {
    const place = day.locationLabel?.split('→').pop()?.trim()
    if (place && places.at(-1) !== place) places.push(place)
  }
  const count = week.reduce((sum, d) => sum + activitiesForDay(data, d.id).length, 0)
  const where = places.length ? places.join(' · ') : monthShort(week[0].date)
  return `${where} — ${count} ${count === 1 ? 'activity' : 'activities'}`
}
