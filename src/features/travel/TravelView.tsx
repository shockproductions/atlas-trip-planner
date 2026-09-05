import { useEffect, useMemo, useState } from 'react'
import type { Activity, Day, ID, Trip, TripData } from '@/domain/types'
import { accommodationForDate, activitiesForDay } from '@/domain/selectors'
import {
  dayOfMonth,
  endMinutes,
  formatTimeRange,
  monthShort,
  nowMinutes,
  todayStr,
  toMinutes,
  weekdayLong,
} from '@/domain/time'
import { TRANSPORT_META } from '@/domain/categories'
import { useTripStore } from '@/store/tripStore'
import { useUiStore } from '@/store/uiStore'
import { navigationUrl } from '@/platform/mapConfig'
import { Icon } from '@/ui/Icon'
import { CategoryIcon } from '@/ui/primitives'

/**
 * Travel mode. One question at a time: what am I doing now, what is next, and
 * what do I need in my hand to do it (address, reference, phone number).
 * No planning affordances, big targets, everything available offline.
 */
export function TravelView({
  trip,
  onOpenDay,
  onGoto,
}: {
  trip: Trip
  onOpenDay: (dayId: ID) => void
  onGoto: (route: string) => void
}) {
  const data = useTripStore((s) => s.data)
  const setStatus = useTripStore((s) => s.setActivityStatus)
  const addActivity = useTripStore((s) => s.addActivity)
  const updateActivity = useTripStore((s) => s.updateActivity)
  const selectActivity = useUiStore((s) => s.selectActivity)

  const days = useMemo(
    () =>
      Object.values(data.days)
        .filter((d) => d.tripId === trip.id)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [data.days, trip.id],
  )

  const today = todayStr()
  const todayIndex = days.findIndex((d) => d.date === today)
  const [index, setIndex] = useState(() => (todayIndex >= 0 ? todayIndex : 0))
  const day: Day | undefined = days[Math.min(index, days.length - 1)]
  const isToday = day?.date === today

  const [noteFor, setNoteFor] = useState<ID | null>(null)
  const [spontaneous, setSpontaneous] = useState('')
  // Re-render every minute so "now" stays honest without a heavy timer.
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  if (!day) {
    return (
      <div className="view view--pad">
        <div className="empty">This trip has no days yet.</div>
      </div>
    )
  }

  const activities = activitiesForDay(data, day.id).filter((a) => a.status !== 'skipped')
  const minute = isToday ? nowMinutes() : -1
  const stay = accommodationForDate(data, trip.id, day.date)

  const current = activities.find((a) => {
    const start = toMinutes(a.startTime)
    const end = endMinutes(a)
    return start !== undefined && end !== undefined && start <= minute && minute < end
  })

  const upcoming = activities.filter((a) => {
    if (a.id === current?.id) return false
    const start = toMinutes(a.startTime)
    if (start === undefined) return a.status !== 'completed'
    return start >= minute
  })
  const next = upcoming[0]
  const later = upcoming.slice(1)
  const done = activities.filter((a) => a.status === 'completed' && a.id !== current?.id)

  function addNow() {
    const title = spontaneous.trim()
    if (!title) return
    const start = isToday ? nowMinutes() : 12 * 60
    const id = addActivity({
      tripId: trip.id,
      dayId: day!.id,
      title,
      category: 'activity',
      timePrecision: 'approximate',
      startTime: `${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`,
      durationMin: 60,
    })
    setSpontaneous('')
    selectActivity(id)
  }

  return (
    <div className="view">
      <div className="travel">
        <div className="travel__head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="travel__date">
              {isToday ? 'Today' : `${weekdayLong(day.date)}`} · {dayOfMonth(day.date)} {monthShort(day.date)}
            </div>
            <div className="travel__title">{day.locationLabel || trip.name}</div>
            {day.headline ? <div className="muted">{day.headline}</div> : null}
          </div>
          <div className="row gap-sm">
            <button
              className="btn btn--icon"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              aria-label="Previous day"
            >
              <Icon name="chevronLeft" size={15} />
            </button>
            <button
              className="btn btn--icon"
              onClick={() => setIndex((i) => Math.min(days.length - 1, i + 1))}
              disabled={index >= days.length - 1}
              aria-label="Next day"
            >
              <Icon name="chevronRight" size={15} />
            </button>
          </div>
        </div>

        {!isToday && todayIndex < 0 ? (
          <div className="travel__section">
            <div className="warn warn--info">
              <span className="warn__icon">
                <Icon name="calendar" size={14} />
              </span>
              <span>
                Today is outside this trip. Showing {weekdayLong(day.date)} {dayOfMonth(day.date)}{' '}
                {monthShort(day.date)}.
              </span>
            </div>
          </div>
        ) : null}

        {/* --------------------------------------------------- now */}
        {current ? (
          <div className="travel__section">
            <FocusCard
              tag="Now"
              activity={current}
              data={data}
              highlight
              onStatus={setStatus}
              onNote={() => setNoteFor((id) => (id === current.id ? null : current.id))}
              noteOpen={noteFor === current.id}
              onNoteChange={(notes) => updateActivity(current.id, { notes }, 'Add note')}
            />
          </div>
        ) : null}

        {/* -------------------------------------------------- next */}
        {next ? (
          <div className="travel__section">
            <FocusCard
              tag={current ? 'Next' : isToday ? 'Up next' : 'First up'}
              activity={next}
              data={data}
              onStatus={setStatus}
              onNote={() => setNoteFor((id) => (id === next.id ? null : next.id))}
              noteOpen={noteFor === next.id}
              onNoteChange={(notes) => updateActivity(next.id, { notes }, 'Add note')}
            />
          </div>
        ) : null}

        {/* ------------------------------------------------- later */}
        {later.length ? (
          <div className="travel__section">
            <div className="eyebrow mb-sm">Later</div>
            <div className="up-next">
              {later.map((a) => (
                <UpRow key={a.id} activity={a} data={data} onOpen={() => onOpenDay(day.id)} />
              ))}
            </div>
          </div>
        ) : null}

        {!current && !next && !later.length ? (
          <div className="travel__section">
            <div className="now-card">
              <div className="now-card__body empty">
                <Icon name="check" size={20} />
                <div className="empty__title">Nothing left today</div>
                <div className="empty__body">
                  {activities.length ? 'Everything is done or behind you.' : 'This day is deliberately open.'}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* --------------------------------------------------- stay */}
        {stay ? (
          <div className="travel__section">
            <div className="eyebrow mb-sm">Tonight</div>
            <div className="now-card">
              <div className="now-card__body">
                <div className="row">
                  <CategoryIcon category="accommodation" size="lg" />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{stay.name}</div>
                    {stay.address ? <div className="muted" style={{ fontSize: 12.5 }}>{stay.address}</div> : null}
                  </div>
                </div>
                {stay.bookingId && data.bookings[stay.bookingId]?.reference ? (
                  <div className="now-card__meta">
                    <span>
                      <Icon name="ticket" size={13} /> {data.bookings[stay.bookingId]!.reference}
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="now-card__actions">
                {stay.locationId && data.locations[stay.locationId]?.lat != null ? (
                  <a
                    className="big-btn"
                    href={navigationUrl(
                      data.locations[stay.locationId]!.lat!,
                      data.locations[stay.locationId]!.lng!,
                      stay.name,
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon name="route" size={15} /> Navigate
                  </a>
                ) : null}
                {stay.phone ? (
                  <a className="big-btn" href={`tel:${stay.phone.replace(/\s/g, '')}`}>
                    <Icon name="phone" size={15} /> Call
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* --------------------------------------------------- done */}
        {done.length ? (
          <div className="travel__section">
            <div className="eyebrow mb-sm">Done</div>
            <div className="up-next">
              {done.map((a) => (
                <UpRow key={a.id} activity={a} data={data} onOpen={() => onOpenDay(day.id)} />
              ))}
            </div>
          </div>
        ) : null}

        {/* ------------------------------------------------ actions */}
        <div className="travel__section">
          <div className="row gap-sm mb-md">
            <input
              className="input"
              value={spontaneous}
              placeholder="Add something you just found…"
              onChange={(e) => setSpontaneous(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addNow()
              }}
            />
            <button className="btn btn--primary" onClick={addNow} disabled={!spontaneous.trim()}>
              <Icon name="plus" size={14} /> Add
            </button>
          </div>
          <div className="row gap-sm row--wrap">
            <button className="big-btn" onClick={() => onGoto('map')}>
              <Icon name="pin" size={15} /> Map
            </button>
            <button className="big-btn" onClick={() => onGoto('bookings')}>
              <Icon name="ticket" size={15} /> Bookings
            </button>
            <button className="big-btn" onClick={() => onOpenDay(day.id)}>
              <Icon name="list" size={15} /> Full day
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- cards */

function FocusCard({
  tag,
  activity,
  data,
  highlight,
  onStatus,
  onNote,
  noteOpen,
  onNoteChange,
}: {
  tag: string
  activity: Activity
  data: TripData
  highlight?: boolean
  onStatus: (id: ID, status: Activity['status']) => void
  onNote: () => void
  noteOpen: boolean
  onNoteChange: (notes: string) => void
}) {
  const location = activity.locationId ? data.locations[activity.locationId] : undefined
  const transport = activity.transportId ? data.transports[activity.transportId] : undefined
  const booking = activity.bookingId ? data.bookings[activity.bookingId] : undefined
  const phone = activity.phone ?? location?.phone

  return (
    <div className={`now-card${highlight ? ' now-card--now' : ''}`}>
      <div className="now-card__tag">
        {highlight ? <Icon name="play" size={12} /> : null}
        {tag}
      </div>
      <div className="now-card__body">
        <div className="now-card__time tabular">{formatTimeRange(activity)}</div>
        <div className="now-card__title">
          <CategoryIcon category={activity.category} size="lg" />
          <span>{activity.title}</span>
        </div>

        <div className="now-card__meta">
          {transport ? (
            <>
              <span>
                <Icon name="route" size={13} /> {transport.fromLabel} → {transport.toLabel}
              </span>
              <span>
                <Icon name={TRANSPORT_META[transport.mode].icon} size={13} />{' '}
                {[transport.carrier, transport.vehicleNumber].filter(Boolean).join(' ')}
              </span>
              {transport.platform ? (
                <span>
                  <Icon name="pin" size={13} /> Platform {transport.platform}
                  {transport.terminal ? ` · ${transport.terminal}` : ''}
                </span>
              ) : null}
              {transport.seat ? (
                <span>
                  <Icon name="ticket" size={13} /> Seat {transport.seat}
                </span>
              ) : null}
            </>
          ) : location ? (
            <span>
              <Icon name="pin" size={13} /> {location.address ?? location.name}
            </span>
          ) : null}
          {booking?.reference ? (
            <span>
              <Icon name="ticket" size={13} /> {booking.reference}
              {booking.provider ? ` · ${booking.provider}` : ''}
            </span>
          ) : null}
          {activity.notes ? (
            <span style={{ color: 'var(--ink-3)' }}>
              <Icon name="note" size={13} /> {activity.notes}
            </span>
          ) : null}
        </div>

        {noteOpen ? (
          <textarea
            className="textarea mt-sm"
            autoFocus
            value={activity.notes ?? ''}
            placeholder="Note to self…"
            onChange={(e) => onNoteChange(e.target.value)}
          />
        ) : null}
      </div>

      <div className="now-card__actions">
        {location?.lat != null && location.lng != null ? (
          <a
            className="big-btn big-btn--primary"
            href={navigationUrl(location.lat, location.lng, location.name)}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="route" size={15} /> Navigate
          </a>
        ) : null}
        {booking?.url ? (
          <a className="big-btn" href={booking.url} target="_blank" rel="noreferrer">
            <Icon name="ticket" size={15} /> Booking
          </a>
        ) : null}
        {phone ? (
          <a className="big-btn" href={`tel:${phone.replace(/\s/g, '')}`}>
            <Icon name="phone" size={15} /> Call
          </a>
        ) : null}
        <button
          className="big-btn"
          onClick={() => onStatus(activity.id, activity.status === 'completed' ? 'planned' : 'completed')}
        >
          <Icon name="check" size={15} />
          {activity.status === 'completed' ? 'Undo' : 'Done'}
        </button>
        <button className="big-btn" onClick={() => onStatus(activity.id, 'skipped')}>
          <Icon name="skip" size={15} /> Skip
        </button>
        <button className="big-btn" onClick={onNote}>
          <Icon name="note" size={15} /> Note
        </button>
      </div>
    </div>
  )
}

function UpRow({
  activity,
  data,
  onOpen,
}: {
  activity: Activity
  data: TripData
  onOpen: () => void
}) {
  const location = activity.locationId ? data.locations[activity.locationId] : undefined
  return (
    <button className={`up-row${activity.status === 'completed' ? ' is-done' : ''}`} onClick={onOpen}>
      <span className="up-row__time tabular">{activity.startTime ?? '—'}</span>
      <CategoryIcon category={activity.category} />
      <span className="up-row__main">
        <span className="up-row__title">{activity.title}</span>
        {location ? <span className="up-row__sub">{location.name}</span> : null}
      </span>
      {activity.optional ? <span className="chip chip--quiet">optional</span> : null}
    </button>
  )
}
