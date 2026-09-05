import { memo, useState } from 'react'
import type { Activity, TripData } from '@/domain/types'
import type { Warning } from '@/domain/warnings'
import { formatDuration, formatTimeRange, occupiedMinutes, toMinutes } from '@/domain/time'
import { CategoryIcon } from '@/ui/primitives'
import { Icon } from '@/ui/Icon'
import { useTripStore } from '@/store/tripStore'
import { useUiStore } from '@/store/uiStore'
import { beginDrag, endDrag } from '@/app/dnd'

interface Props {
  activity: Activity
  data: TripData
  warnings: Warning[]
  selected: boolean
  onSelect: (id: string) => void
  dragging: boolean
}

/**
 * One line of the day. Dense by design: time, category, title and the few
 * facts that matter at a glance. Everything else lives in the inspector.
 */
function ActivityRowBase({ activity, data, warnings, selected, onSelect, dragging }: Props) {
  const updateActivity = useTripStore((s) => s.updateActivity)
  const duplicateActivity = useTripStore((s) => s.duplicateActivity)
  const setStatus = useTripStore((s) => s.setActivityStatus)
  const hovered = useUiStore((s) => s.hoveredActivityId === activity.id)
  const hoverActivity = useUiStore((s) => s.hoverActivity)
  const [editingTime, setEditingTime] = useState(false)

  const location = activity.locationId ? data.locations[activity.locationId] : undefined
  const booking = activity.bookingId ? data.bookings[activity.bookingId] : undefined
  const transport = activity.transportId ? data.transports[activity.transportId] : undefined
  const minutes = occupiedMinutes(activity)
  const hasClock = activity.timePrecision === 'exact' || activity.timePrecision === 'approximate'

  const classes = [
    'act',
    selected ? 'is-selected' : '',
    hovered && !selected ? 'is-highlighted' : '',
    dragging ? 'is-dragging' : '',
    activity.status === 'skipped' ? 'is-skipped' : '',
    activity.status === 'completed' ? 'is-completed' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const commitTime = (raw: string) => {
    const value = raw.trim()
    if (!value) {
      updateActivity(activity.id, { startTime: undefined, timePrecision: 'flexible' }, 'Clear time')
      return
    }
    const normalised = /^\d{1,2}:\d{2}$/.test(value)
      ? value.padStart(5, '0')
      : /^\d{3,4}$/.test(value)
        ? `${value.slice(0, value.length - 2).padStart(2, '0')}:${value.slice(-2)}`
        : null
    if (!normalised || toMinutes(normalised) === undefined) return
    const previousStart = toMinutes(activity.startTime)
    const previousEnd = toMinutes(activity.endTime)
    const patch: Partial<Activity> = { startTime: normalised }
    // Dragging the start time keeps the duration intact.
    if (previousStart !== undefined && previousEnd !== undefined && previousEnd > previousStart) {
      const shift = toMinutes(normalised)! - previousStart
      const end = previousEnd + shift
      patch.endTime = `${String(Math.floor((end % 1440) / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
    }
    if (activity.timePrecision !== 'approximate') patch.timePrecision = 'exact'
    updateActivity(activity.id, patch, 'Change time')
  }

  return (
    <div
      className={classes}
      onClick={() => onSelect(activity.id)}
      onMouseEnter={() => hoverActivity(activity.id)}
      onMouseLeave={() => hoverActivity(null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(activity.id)
        }
      }}
      role="button"
      tabIndex={0}
      draggable={!editingTime}
      onDragStart={(e) => beginDrag({ kind: 'activity', activityId: activity.id, fromDayId: activity.dayId }, e)}
      onDragEnd={endDrag}
      aria-current={selected}
    >
      <div className="act__time">
        {hasClock ? (
          <>
            <input
              className="inline-edit tabular"
              style={{ textAlign: 'right', padding: '0 3px', margin: 0 }}
              defaultValue={activity.startTime ?? ''}
              key={activity.startTime}
              aria-label={`Start time for ${activity.title}`}
              onFocus={() => setEditingTime(true)}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => {
                setEditingTime(false)
                commitTime(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLElement).blur()
                if (e.key === 'Escape') {
                  ;(e.target as HTMLInputElement).value = activity.startTime ?? ''
                  ;(e.target as HTMLElement).blur()
                }
              }}
            />
            {activity.endTime ? <span className="act__time-end">{activity.endTime}</span> : null}
          </>
        ) : (
          <span className="act__time--soft">{formatTimeRange(activity)}</span>
        )}
      </div>

      <div className="act__main">
        <span className="act__grip" aria-hidden="true">
          <Icon name="grip" size={13} />
        </span>
        <CategoryIcon category={activity.category} />
        <div className="act__body">
          <div className="act__title">
            <span className="truncate">{activity.title}</span>
            {activity.optional ? (
              <span className="chip chip--quiet" title="Optional — only if there is time">
                optional
              </span>
            ) : null}
            {warnings.length ? (
              <span className="act__warn" title={warnings.map((w) => w.message).join('\n')}>
                <Icon name="alert" size={13} />
              </span>
            ) : null}
            {activity.status === 'completed' ? (
              <span className="act__warn" style={{ color: 'var(--ok)' }} title="Completed">
                <Icon name="check" size={13} />
              </span>
            ) : null}
          </div>

          <div className="act__sub">
            {transport ? (
              <span className="act__sub-item">
                <Icon name="route" size={12} />
                <span>
                  {transport.fromLabel} → {transport.toLabel}
                </span>
              </span>
            ) : location ? (
              <span className="act__sub-item">
                <Icon name="pin" size={12} />
                <span>{location.name}</span>
              </span>
            ) : null}
            {minutes > 0 ? (
              <span className="act__sub-item tabular">
                <Icon name="clock" size={12} />
                <span>{formatDuration(minutes)}</span>
              </span>
            ) : null}
            {booking?.reference ? (
              <span className="act__sub-item">
                <Icon name="ticket" size={12} />
                <span>{booking.reference}</span>
              </span>
            ) : null}
            {activity.cost ? (
              <span className="act__sub-item tabular">
                <Icon name="wallet" size={12} />
                <span>
                  {activity.cost.toLocaleString()} {activity.currency ?? ''}
                </span>
              </span>
            ) : null}
          </div>
        </div>

        <div className="act__tools" onClick={(e) => e.stopPropagation()}>
          <button
            className="btn btn--ghost btn--icon btn--sm"
            title={activity.status === 'completed' ? 'Mark as planned' : 'Mark complete'}
            aria-label={activity.status === 'completed' ? 'Mark as planned' : 'Mark complete'}
            onClick={() => setStatus(activity.id, activity.status === 'completed' ? 'planned' : 'completed')}
          >
            <Icon name="check" size={14} />
          </button>
          <button
            className="btn btn--ghost btn--icon btn--sm"
            title={activity.status === 'skipped' ? 'Un-skip' : 'Skip'}
            aria-label={activity.status === 'skipped' ? 'Un-skip' : 'Skip'}
            onClick={() => setStatus(activity.id, activity.status === 'skipped' ? 'planned' : 'skipped')}
          >
            <Icon name="skip" size={14} />
          </button>
          <button
            className="btn btn--ghost btn--icon btn--sm"
            title="Duplicate"
            aria-label="Duplicate"
            onClick={() => duplicateActivity(activity.id)}
          >
            <Icon name="copy" size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

export const ActivityRow = memo(ActivityRowBase)
