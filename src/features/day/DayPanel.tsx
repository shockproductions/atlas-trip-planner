import { useMemo, useRef, useState } from 'react'
import type { ActivityCategory, Day, ID } from '@/domain/types'
import { ACTIVITY_CATEGORIES } from '@/domain/types'
import {
  accommodationForDate,
  activitiesForDay,
  buildDayTimeline,
  dayLoadMinutes,
} from '@/domain/selectors'
import {
  dayOfMonth,
  endMinutes,
  formatDuration,
  fromMinutes,
  monthShort,
  snapMinutes,
  sortMinutes,
  toMinutes,
  weekdayLong,
} from '@/domain/time'
import { categoryMeta, DEFAULT_DURATION } from '@/domain/categories'
import type { Warning } from '@/domain/warnings'
import { useTripStore } from '@/store/tripStore'
import { useUiStore } from '@/store/uiStore'
import { getDrag, isActivityDrag, readDrop } from '@/app/dnd'
import { ActivityRow } from './ActivityRow'
import { Icon } from '@/ui/Icon'
import { EmptyState } from '@/ui/primitives'
import { WarningList } from '@/features/warnings/WarningList'

interface Props {
  day: Day
  warnings: Warning[]
}

type DropTarget = { id: ID; edge: 'before' | 'after' } | { id: 'end'; edge: 'after' } | null

export function DayPanel({ day, warnings }: Props) {
  const data = useTripStore((s) => s.data)
  const updateDay = useTripStore((s) => s.updateDay)
  const addActivity = useTripStore((s) => s.addActivity)
  const moveActivity = useTripStore((s) => s.moveActivity)
  const selectedActivityId = useUiStore((s) => s.selectedActivityId)
  const selectActivity = useUiStore((s) => s.selectActivity)

  const [dropTarget, setDropTarget] = useState<DropTarget>(null)
  const [draggingId, setDraggingId] = useState<ID | null>(null)
  const [quickTitle, setQuickTitle] = useState('')
  const [quickCategory, setQuickCategory] = useState<ActivityCategory>('activity')
  const quickRef = useRef<HTMLInputElement>(null)

  const activities = useMemo(() => activitiesForDay(data, day.id), [data, day.id])
  const slots = useMemo(() => buildDayTimeline(activities), [activities])
  const stay = accommodationForDate(data, day.tripId, day.date)
  const load = dayLoadMinutes(activities)

  const warningsById = useMemo(() => {
    const map = new Map<ID, Warning[]>()
    for (const w of warnings) {
      for (const id of w.activityIds) {
        const list = map.get(id) ?? []
        list.push(w)
        map.set(id, list)
      }
    }
    return map
  }, [warnings])

  /* ------------------------------------------------------------ drop */

  function acceptDrop(event: React.DragEvent, target: DropTarget) {
    event.preventDefault()
    event.stopPropagation()
    setDropTarget(null)
    setDraggingId(null)
    const payload = readDrop(event)
    if (!payload) return

    const dragged = data.activities[payload.activityId]
    if (!dragged) return

    if (!target || target.id === 'end') {
      moveActivity(dragged.id, day.id)
      selectActivity(dragged.id)
      return
    }

    const anchor = data.activities[target.id]
    if (!anchor || anchor.id === dragged.id) return

    // Give untimed activities a sensible time from where they landed; keep the
    // time of anything the user has already scheduled.
    const draggedHasTime = toMinutes(dragged.startTime) !== undefined
    let startTime: string | undefined
    if (!draggedHasTime) {
      const anchorStart = toMinutes(anchor.startTime)
      const anchorEnd = endMinutes(anchor)
      if (target.edge === 'before' && anchorStart !== undefined) {
        startTime = fromMinutes(Math.max(0, anchorStart - (dragged.durationMin ?? 60)))
      } else if (target.edge === 'after' && anchorEnd !== undefined) {
        startTime = fromMinutes(anchorEnd)
      }
    }

    moveActivity(dragged.id, day.id, {
      startTime,
      [target.edge === 'before' ? 'beforeId' : 'afterId']: anchor.id,
    })
    selectActivity(dragged.id)
  }

  function dropOnGap(event: React.DragEvent, startMin: number) {
    event.preventDefault()
    event.stopPropagation()
    setDropTarget(null)
    const payload = readDrop(event)
    if (!payload) return
    moveActivity(payload.activityId, day.id, {
      startTime: fromMinutes(snapMinutes(startMin, 15)),
      timePrecision: 'exact',
    })
    selectActivity(payload.activityId)
  }

  function rowDragOver(event: React.DragEvent, id: ID) {
    if (!isActivityDrag(event)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const rect = event.currentTarget.getBoundingClientRect()
    const edge = event.clientY - rect.top < rect.height / 2 ? 'before' : 'after'
    setDropTarget({ id, edge })
    const drag = getDrag()
    setDraggingId(drag?.activityId ?? null)
  }

  /* ------------------------------------------------------ quick add */

  function quickAdd() {
    const raw = quickTitle.trim()
    if (!raw) return
    // "09:30 Coffee" schedules directly; a bare title lands as flexible.
    const match = /^(\d{1,2})[:.h]?(\d{2})\s+(.*)$/.exec(raw)
    let startTime: string | undefined
    let title = raw
    if (match) {
      const h = Number(match[1])
      const m = Number(match[2])
      if (h < 24 && m < 60) {
        startTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        title = match[3]
      }
    }
    const duration = DEFAULT_DURATION[quickCategory]
    const id = addActivity({
      tripId: day.tripId,
      dayId: day.id,
      title,
      category: quickCategory,
      timePrecision: startTime ? 'exact' : 'flexible',
      startTime,
      endTime: startTime && duration ? fromMinutes(toMinutes(startTime)! + duration) : undefined,
      durationMin: duration,
    })
    setQuickTitle('')
    selectActivity(id)
    quickRef.current?.focus()
  }

  /* --------------------------------------------------------- render */

  // Activities with no time at all get a divider once, above the first of them.
  const firstFlexibleId = activities.find(
    (a) => sortMinutes(a) === Number.POSITIVE_INFINITY,
  )?.id

  return (
    <div className="panel">
      <div className="dayhead">
          <div className="dayhead__top">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="dayhead__date">
                {weekdayLong(day.date)} {dayOfMonth(day.date)} {monthShort(day.date)}
              </div>
              <div className="dayhead__sub">
                {stay ? (
                  <span className="act__sub-item">
                    <Icon name="bed" size={12} />
                    <span>{stay.name}</span>
                  </span>
                ) : (
                  <span className="act__sub-item" style={{ color: 'var(--warn)' }}>
                    <Icon name="alert" size={12} />
                    <span>No accommodation</span>
                  </span>
                )}
                <span className="act__sub-item tabular">
                  <Icon name="clock" size={12} />
                  <span>{load > 0 ? `${formatDuration(load)} planned` : 'Open day'}</span>
                </span>
                <span className="act__sub-item">
                  <Icon name="list" size={12} />
                  <span>
                    {activities.length} {activities.length === 1 ? 'item' : 'items'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="dayhead__fields">
            <label className="field">
              <span className="field__label">Where</span>
              <input
                className="input"
                value={day.locationLabel ?? ''}
                placeholder="City or area"
                onChange={(e) => updateDay(day.id, { locationLabel: e.target.value })}
              />
            </label>
            <label className="field" style={{ flex: '2 1 260px' }}>
              <span className="field__label">Day headline</span>
              <input
                className="input"
                value={day.headline ?? ''}
                placeholder="One line for the weekly view"
                onChange={(e) => updateDay(day.id, { headline: e.target.value })}
              />
            </label>
          </div>

        {warnings.length ? (
          <div className="mt-md">
            <WarningList warnings={warnings} compact />
          </div>
        ) : null}
      </div>

      <div
        className="panel__body"
        onDragOver={(e) => {
          if (isActivityDrag(e)) e.preventDefault()
        }}
        onDrop={(e) => acceptDrop(e, null)}
      >
        <div className="timeline">
          {slots.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="Nothing planned yet"
              body="Add an activity below, or drag one in from Ideas."
            />
          ) : null}

          {slots.map((slot) => {
            if (slot.kind === 'gap') {
              return (
                <div
                  key={`gap-${slot.startMin}`}
                  className="gap"
                  onDragOver={(e) => {
                    if (isActivityDrag(e)) {
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                    }
                  }}
                  onDrop={(e) => dropOnGap(e, slot.startMin)}
                >
                  <div className="gap__time tabular">{fromMinutes(slot.startMin)}</div>
                  <div className="gap__line">
                    <button
                      type="button"
                      className="gap__btn"
                      title="Add something in this window"
                      onClick={() => {
                        const id = addActivity({
                          tripId: day.tripId,
                          dayId: day.id,
                          title: 'Free time',
                          category: 'freeTime',
                          timePrecision: 'exact',
                          startTime: fromMinutes(slot.startMin),
                          endTime: fromMinutes(slot.endMin),
                          durationMin: slot.minutes,
                        })
                        selectActivity(id)
                      }}
                    >
                      Free · {formatDuration(slot.minutes)}
                    </button>
                  </div>
                </div>
              )
            }

            const activity = slot.activity
            const showLabel = activity.id === firstFlexibleId
            const target = dropTarget && 'id' in dropTarget && dropTarget.id === activity.id ? dropTarget : null

            return (
              <div key={activity.id}>
                {showLabel ? <div className="section-label">Any time</div> : null}
                <div
                  className={`slot${target ? (target.edge === 'before' ? ' is-drop-before' : ' is-drop-after') : ''}`}
                  onDragOver={(e) => rowDragOver(e, activity.id)}
                  onDragLeave={() => setDropTarget((t) => (t && 'id' in t && t.id === activity.id ? null : t))}
                  onDrop={(e) => acceptDrop(e, dropTarget)}
                >
                  <ActivityRow
                    activity={activity}
                    data={data}
                    warnings={warningsById.get(activity.id) ?? []}
                    selected={selectedActivityId === activity.id}
                    onSelect={selectActivity}
                    dragging={draggingId === activity.id}
                  />
                </div>
              </div>
            )
          })}

          <div
            className={`day-drop${dropTarget && dropTarget.id === 'end' ? ' is-drop' : ''}`}
            onDragOver={(e) => {
              if (!isActivityDrag(e)) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setDropTarget({ id: 'end', edge: 'after' })
            }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(e) => acceptDrop(e, null)}
          >
            Drop here to add to this day
          </div>
        </div>
      </div>

      <div className="row" style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
        <select
          className="select"
          style={{ width: 132, flex: 'none' }}
          value={quickCategory}
          aria-label="Category for the new activity"
          onChange={(e) => setQuickCategory(e.target.value as ActivityCategory)}
        >
          {ACTIVITY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryMeta(c).label}
            </option>
          ))}
        </select>
        <input
          ref={quickRef}
          className="input"
          value={quickTitle}
          placeholder="Add to this day — try “09:30 Coffee at Blue Bottle”"
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') quickAdd()
          }}
        />
        <button className="btn btn--primary" onClick={quickAdd} disabled={!quickTitle.trim()}>
          <Icon name="plus" size={14} />
          Add
        </button>
      </div>
    </div>
  )
}
