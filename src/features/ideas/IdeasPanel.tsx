import { useState } from 'react'
import type { ActivityCategory, ID } from '@/domain/types'
import { ACTIVITY_CATEGORIES } from '@/domain/types'
import { categoryMeta, DEFAULT_DURATION } from '@/domain/categories'
import { formatDuration } from '@/domain/time'
import { useIdeas, useTripStore } from '@/store/tripStore'
import { useUiStore } from '@/store/uiStore'
import { beginDrag, endDrag, isActivityDrag, readDrop } from '@/app/dnd'
import { CategoryIcon, EmptyState } from '@/ui/primitives'
import { Icon } from '@/ui/Icon'

/**
 * The research inbox: things worth doing that have no slot yet. They are
 * ordinary activities with `dayId === null`, so scheduling one is a move, not
 * a conversion.
 */
export function IdeasPanel({ tripId }: { tripId: ID }) {
  const ideas = useIdeas(tripId)
  const data = useTripStore((s) => s.data)
  const addActivity = useTripStore((s) => s.addActivity)
  const moveActivity = useTripStore((s) => s.moveActivity)
  const selectedActivityId = useUiStore((s) => s.selectedActivityId)
  const selectActivity = useUiStore((s) => s.selectActivity)
  const hoverActivity = useUiStore((s) => s.hoverActivity)

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<ActivityCategory>('activity')
  const [draggingId, setDraggingId] = useState<ID | null>(null)
  const [dropActive, setDropActive] = useState(false)

  function add() {
    const trimmed = title.trim()
    if (!trimmed) return
    const id = addActivity({
      tripId,
      dayId: null,
      title: trimmed,
      category,
      timePrecision: 'unscheduled',
      durationMin: DEFAULT_DURATION[category],
    })
    setTitle('')
    selectActivity(id)
  }

  return (
    <div className="panel">
      <div
        className="panel__body"
        onDragOver={(e) => {
          if (!isActivityDrag(e)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setDropActive(true)
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDropActive(false)
          const payload = readDrop(e)
          if (payload) moveActivity(payload.activityId, null)
        }}
      >
        {ideas.length === 0 ? (
          <EmptyState
            icon="bulb"
            title="No ideas saved"
            body="Park anything you find here — a restaurant, a viewpoint, a maybe. Schedule it later by dragging it onto a day."
          />
        ) : (
          <div className="ideas">
            {ideas.map((idea) => {
              const location = idea.locationId ? data.locations[idea.locationId] : undefined
              return (
                <div
                  key={idea.id}
                  className={`idea${selectedActivityId === idea.id ? ' is-selected' : ''}${draggingId === idea.id ? ' is-dragging' : ''}`}
                  draggable
                  onDragStart={(e) => {
                    setDraggingId(idea.id)
                    beginDrag({ kind: 'activity', activityId: idea.id, fromDayId: null }, e)
                  }}
                  onDragEnd={() => {
                    setDraggingId(null)
                    endDrag()
                  }}
                  onClick={() => selectActivity(idea.id)}
                  onMouseEnter={() => hoverActivity(idea.id)}
                  onMouseLeave={() => hoverActivity(null)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') selectActivity(idea.id)
                  }}
                >
                  <CategoryIcon category={idea.category} />
                  <div className="idea__body">
                    <div className="idea__title truncate">{idea.title}</div>
                    <div className="idea__meta">
                      {location ? (
                        <span className="act__sub-item">
                          <Icon name="pin" size={11} />
                          <span className="truncate">{location.name}</span>
                        </span>
                      ) : null}
                      {idea.durationMin ? (
                        <span className="act__sub-item tabular">
                          <Icon name="clock" size={11} />
                          <span>{formatDuration(idea.durationMin)}</span>
                        </span>
                      ) : null}
                      {idea.cost ? (
                        <span className="act__sub-item tabular">
                          <Icon name="wallet" size={11} />
                          <span>
                            {idea.cost.toLocaleString()} {idea.currency ?? ''}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className={`ideas-drop${dropActive ? ' is-drop' : ''}`}>
          Drop an activity here to unschedule it
        </div>
      </div>

      <div
        className="row"
        style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}
      >
        <select
          className="select"
          style={{ width: 116, flex: 'none' }}
          value={category}
          aria-label="Idea category"
          onChange={(e) => setCategory(e.target.value as ActivityCategory)}
        >
          {ACTIVITY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryMeta(c).label}
            </option>
          ))}
        </select>
        <input
          className="input"
          value={title}
          placeholder="Save an idea…"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
        />
        <button className="btn btn--primary btn--icon" onClick={add} disabled={!title.trim()} aria-label="Save idea">
          <Icon name="plus" size={14} />
        </button>
      </div>
    </div>
  )
}
