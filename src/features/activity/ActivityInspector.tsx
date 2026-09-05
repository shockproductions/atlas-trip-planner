import { useMemo, useState } from 'react'
import type {
  Activity,
  ActivityCategory,
  DayPart,
  ID,
  TimePrecision,
  TransportMode,
} from '@/domain/types'
import { ACTIVITY_CATEGORIES, TRANSPORT_MODES } from '@/domain/types'
import { categoryMeta, TRANSPORT_META } from '@/domain/categories'
import { formatDuration, fromMinutes, toMinutes, weekdayShort, dayOfMonth, monthShort } from '@/domain/time'
import { listDays } from '@/domain/selectors'
import { useTripStore } from '@/store/tripStore'
import { useUiStore } from '@/store/uiStore'
import { Icon } from '@/ui/Icon'
import { CategoryIcon, ConfirmDialog, Field, Switch } from '@/ui/primitives'
import type { Warning } from '@/domain/warnings'
import { WarningList } from '@/features/warnings/WarningList'

const PRECISIONS: { value: TimePrecision; label: string }[] = [
  { value: 'exact', label: 'Exact' },
  { value: 'approximate', label: 'About' },
  { value: 'dayPart', label: 'Part of day' },
  { value: 'relative', label: 'Relative' },
  { value: 'flexible', label: 'Flexible' },
]

const DAY_PARTS: DayPart[] = ['morning', 'afternoon', 'evening']

/**
 * The activity detail editor. Every field writes straight through to the
 * store — there is no save button and no separate draft copy, so the day view,
 * map and warnings all update as you type.
 */
export function ActivityInspector({
  activityId,
  warnings,
  onClose,
}: {
  activityId: ID
  warnings: Warning[]
  onClose: () => void
}) {
  const data = useTripStore((s) => s.data)
  const update = useTripStore((s) => s.updateActivity)
  const remove = useTripStore((s) => s.deleteActivity)
  const duplicate = useTripStore((s) => s.duplicateActivity)
  const move = useTripStore((s) => s.moveActivity)
  const upsertLocation = useTripStore((s) => s.upsertLocation)
  const upsertTransport = useTripStore((s) => s.upsertTransport)
  const upsertBooking = useTripStore((s) => s.upsertBooking)
  const selectActivity = useUiStore((s) => s.selectActivity)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const activity = data.activities[activityId]
  const days = useMemo(
    () => (activity ? listDays(data, activity.tripId) : []),
    [data, activity],
  )
  const locations = useMemo(
    () =>
      activity
        ? Object.values(data.locations)
            .filter((l) => l.tripId === activity.tripId)
            .sort((a, b) => a.name.localeCompare(b.name))
        : [],
    [data.locations, activity],
  )

  if (!activity) {
    return (
      <div className="insp">
        <div className="empty">Nothing selected.</div>
      </div>
    )
  }

  const location = activity.locationId ? data.locations[activity.locationId] : undefined
  const transport = activity.transportId ? data.transports[activity.transportId] : undefined
  const booking = activity.bookingId ? data.bookings[activity.bookingId] : undefined
  const accommodations = Object.values(data.accommodations).filter((h) => h.tripId === activity.tripId)

  const patch = (p: Partial<Activity>, label?: string) => update(activity.id, p, label)

  /** Keep end time and duration consistent whichever the user edits. */
  function setStart(value: string) {
    const start = toMinutes(value)
    if (start === undefined) {
      patch({ startTime: undefined })
      return
    }
    const p: Partial<Activity> = { startTime: value }
    if (activity.durationMin) p.endTime = fromMinutes(start + activity.durationMin)
    else {
      const end = toMinutes(activity.endTime)
      if (end !== undefined && end > start) p.durationMin = end - start
    }
    patch(p, 'Change time')
  }

  function setEnd(value: string) {
    const end = toMinutes(value)
    const start = toMinutes(activity.startTime)
    if (end === undefined) {
      patch({ endTime: undefined })
      return
    }
    patch(
      { endTime: value, durationMin: start !== undefined && end > start ? end - start : activity.durationMin },
      'Change time',
    )
  }

  function setDuration(minutes: number | undefined) {
    const start = toMinutes(activity.startTime)
    patch({
      durationMin: minutes,
      endTime: start !== undefined && minutes ? fromMinutes(start + minutes) : activity.endTime,
    })
  }

  function setPrecision(next: TimePrecision) {
    const p: Partial<Activity> = { timePrecision: next }
    if (next === 'dayPart' && !activity.dayPart) p.dayPart = 'morning'
    if (next === 'exact' && !activity.startTime) p.startTime = '09:00'
    if (next === 'flexible' || next === 'dayPart' || next === 'relative') {
      p.startTime = undefined
      p.endTime = undefined
    }
    patch(p, 'Change timing')
  }

  /** Link to an existing location by name, or create one on the fly. */
  function commitLocationName(name: string) {
    const trimmed = name.trim()
    if (!trimmed) {
      patch({ locationId: undefined }, 'Clear location')
      return
    }
    const existing = locations.find((l) => l.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) {
      patch({ locationId: existing.id }, 'Set location')
      return
    }
    if (location) {
      upsertLocation({ ...location, name: trimmed })
      return
    }
    const id = upsertLocation({ tripId: activity.tripId, name: trimmed })
    patch({ locationId: id }, 'Set location')
  }

  function ensureTransport(): ID {
    if (activity.transportId) return activity.transportId
    const mode: TransportMode =
      activity.category === 'flight'
        ? 'flight'
        : activity.category === 'train'
          ? 'train'
          : activity.category === 'driving'
            ? 'car'
            : 'publicTransport'
    const id = upsertTransport({
      tripId: activity.tripId,
      mode,
      fromLabel: '',
      toLabel: '',
    })
    patch({ transportId: id }, 'Add transport detail')
    return id
  }

  function ensureBooking(): ID {
    if (activity.bookingId) return activity.bookingId
    const id = upsertBooking({ tripId: activity.tripId, status: 'confirmed' })
    patch({ bookingId: id }, 'Add booking')
    return id
  }

  const isTransportish = categoryMeta(activity.category).isTransport || Boolean(transport)

  return (
    <div className="insp">
      <div className="insp__head">
        <CategoryIcon category={activity.category} size="lg" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            className="inline-edit insp__title"
            value={activity.title}
            aria-label="Activity title"
            onChange={(e) => patch({ title: e.target.value })}
          />
          <div className="muted" style={{ fontSize: 12, paddingLeft: 5 }}>
            {activity.dayId
              ? (() => {
                  const day = data.days[activity.dayId]
                  return day
                    ? `${weekdayShort(day.date)} ${dayOfMonth(day.date)} ${monthShort(day.date)}`
                    : 'Scheduled'
                })()
              : 'Unscheduled idea'}
          </div>
        </div>
        <button className="btn btn--ghost btn--icon btn--sm" onClick={onClose} aria-label="Close inspector">
          <Icon name="close" size={15} />
        </button>
      </div>

      <div className="insp__body">
        {warnings.length ? (
          <div className="insp__section">
            <WarningList warnings={warnings} />
          </div>
        ) : null}

        {/* ------------------------------------------------ placement */}
        <div className="insp__section">
          <div className="insp__section-title">Placement</div>
          <div className="grid2">
            <Field label="Day">
              <select
                className="select"
                value={activity.dayId ?? ''}
                onChange={(e) => move(activity.id, e.target.value || null)}
              >
                <option value="">Ideas (unscheduled)</option>
                {days.map((d) => (
                  <option key={d.id} value={d.id}>
                    {weekdayShort(d.date)} {dayOfMonth(d.date)} {monthShort(d.date)}
                    {d.locationLabel ? ` · ${d.locationLabel}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select
                className="select"
                value={activity.category}
                onChange={(e) => patch({ category: e.target.value as ActivityCategory }, 'Change category')}
              >
                {ACTIVITY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryMeta(c).label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="row row--wrap mt-md">
            <Switch
              checked={activity.optional}
              onChange={(v) => patch({ optional: v }, v ? 'Mark optional' : 'Mark required')}
              label="Optional"
            />
            <div className="topbar__spacer" />
            <div className="segmented">
              {(['planned', 'completed', 'skipped'] as const).map((s) => (
                <button
                  key={s}
                  className={activity.status === s ? 'is-on' : ''}
                  onClick={() => patch({ status: s }, 'Change status')}
                >
                  {s === 'planned' ? 'Planned' : s === 'completed' ? 'Done' : 'Skipped'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* --------------------------------------------------- timing */}
        <div className="insp__section">
          <div className="insp__section-title">Timing</div>
          <div className="segmented" style={{ flexWrap: 'wrap' }}>
            {PRECISIONS.map((p) => (
              <button
                key={p.value}
                className={activity.timePrecision === p.value ? 'is-on' : ''}
                onClick={() => setPrecision(p.value)}
                disabled={!activity.dayId}
                title={!activity.dayId ? 'Schedule this on a day first' : undefined}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="mt-md">
            {activity.timePrecision === 'exact' || activity.timePrecision === 'approximate' ? (
              <div className="grid3">
                <Field label={activity.timePrecision === 'approximate' ? 'Around' : 'Start'}>
                  <input
                    className="input tabular"
                    type="time"
                    value={activity.startTime ?? ''}
                    onChange={(e) => setStart(e.target.value)}
                  />
                </Field>
                <Field label="End">
                  <input
                    className="input tabular"
                    type="time"
                    value={activity.endTime ?? ''}
                    onChange={(e) => setEnd(e.target.value)}
                  />
                </Field>
                <Field label="Duration (min)">
                  <input
                    className="input tabular"
                    type="number"
                    min={0}
                    step={15}
                    value={activity.durationMin ?? ''}
                    onChange={(e) => setDuration(e.target.value ? Number(e.target.value) : undefined)}
                  />
                </Field>
              </div>
            ) : activity.timePrecision === 'dayPart' ? (
              <div className="segmented">
                {DAY_PARTS.map((p) => (
                  <button
                    key={p}
                    className={activity.dayPart === p ? 'is-on' : ''}
                    onClick={() => patch({ dayPart: p }, 'Change timing')}
                  >
                    {p[0].toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            ) : activity.timePrecision === 'relative' ? (
              <Field label="Anchor">
                <input
                  className="input"
                  value={activity.anchorNote ?? ''}
                  placeholder="After lunch"
                  onChange={(e) => patch({ anchorNote: e.target.value })}
                />
              </Field>
            ) : (
              <div className="muted" style={{ fontSize: 12.5 }}>
                {activity.dayId
                  ? 'Somewhere in this day — it sits at the bottom of the timeline until you give it a time.'
                  : 'Saved as an idea. Drag it onto a day, or pick a day above.'}
              </div>
            )}
            {activity.timePrecision !== 'exact' && activity.timePrecision !== 'approximate' ? (
              <div className="mt-sm">
                <Field label="Expected duration (min)">
                  <input
                    className="input tabular"
                    type="number"
                    min={0}
                    step={15}
                    value={activity.durationMin ?? ''}
                    onChange={(e) => patch({ durationMin: e.target.value ? Number(e.target.value) : undefined })}
                  />
                </Field>
              </div>
            ) : null}
            {activity.durationMin ? (
              <div className="muted mt-sm" style={{ fontSize: 11.5 }}>
                {formatDuration(activity.durationMin)}
              </div>
            ) : null}
          </div>
        </div>

        {/* ------------------------------------------------- location */}
        <div className="insp__section">
          <div className="insp__section-title">Location</div>
          <Field label="Place">
            <input
              className="input"
              list="atlas-locations"
              defaultValue={location?.name ?? ''}
              key={activity.locationId ?? 'none'}
              placeholder="Search or type a new place"
              onBlur={(e) => commitLocationName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLElement).blur()
              }}
            />
          </Field>
          <datalist id="atlas-locations">
            {locations.map((l) => (
              <option key={l.id} value={l.name} />
            ))}
          </datalist>

          {location ? (
            <div className="stack mt-md">
              <Field label="Address">
                <input
                  className="input"
                  value={location.address ?? ''}
                  onChange={(e) => upsertLocation({ ...location, address: e.target.value })}
                />
              </Field>
              <div className="grid2">
                <Field label="Latitude">
                  <input
                    className="input tabular"
                    type="number"
                    step="any"
                    value={location.lat ?? ''}
                    placeholder="35.6764"
                    onChange={(e) =>
                      upsertLocation({ ...location, lat: e.target.value ? Number(e.target.value) : undefined })
                    }
                  />
                </Field>
                <Field label="Longitude">
                  <input
                    className="input tabular"
                    type="number"
                    step="any"
                    value={location.lng ?? ''}
                    placeholder="139.6993"
                    onChange={(e) =>
                      upsertLocation({ ...location, lng: e.target.value ? Number(e.target.value) : undefined })
                    }
                  />
                </Field>
              </div>
              {location.lat == null || location.lng == null ? (
                <div className="muted" style={{ fontSize: 11.5 }}>
                  Add coordinates to place this on the map.
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* ------------------------------------------------ transport */}
        <div className="insp__section">
          <div className="insp__section-title">
            Transport
            {!transport && isTransportish ? (
              <button className="btn btn--ghost btn--sm" onClick={ensureTransport}>
                <Icon name="plus" size={12} /> Add detail
              </button>
            ) : null}
          </div>
          {transport ? (
            <div className="stack">
              <div className="grid2">
                <Field label="Mode">
                  <select
                    className="select"
                    value={transport.mode}
                    onChange={(e) => {
                      const mode = e.target.value as TransportMode
                      upsertTransport({ ...transport, mode })
                      patch({ category: TRANSPORT_META[mode].category }, 'Change transport mode')
                    }}
                  >
                    {TRANSPORT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {TRANSPORT_META[m].label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Carrier">
                  <input
                    className="input"
                    value={transport.carrier ?? ''}
                    placeholder="JR Central"
                    onChange={(e) => upsertTransport({ ...transport, carrier: e.target.value })}
                  />
                </Field>
              </div>
              <div className="grid2">
                <Field label="From">
                  <input
                    className="input"
                    value={transport.fromLabel}
                    placeholder="Tokyo Station"
                    onChange={(e) => upsertTransport({ ...transport, fromLabel: e.target.value })}
                  />
                </Field>
                <Field label="To">
                  <input
                    className="input"
                    value={transport.toLabel}
                    placeholder="Kyoto Station"
                    onChange={(e) => upsertTransport({ ...transport, toLabel: e.target.value })}
                  />
                </Field>
              </div>
              <div className="grid3">
                <Field label="Number">
                  <input
                    className="input"
                    value={transport.vehicleNumber ?? ''}
                    placeholder="Nozomi 231"
                    onChange={(e) => upsertTransport({ ...transport, vehicleNumber: e.target.value })}
                  />
                </Field>
                <Field label="Seat">
                  <input
                    className="input"
                    value={transport.seat ?? ''}
                    placeholder="Car 8, 8A"
                    onChange={(e) => upsertTransport({ ...transport, seat: e.target.value })}
                  />
                </Field>
                <Field label="Platform / gate">
                  <input
                    className="input"
                    value={transport.platform ?? ''}
                    placeholder="14"
                    onChange={(e) => upsertTransport({ ...transport, platform: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Terminal">
                <input
                  className="input"
                  value={transport.terminal ?? ''}
                  onChange={(e) => upsertTransport({ ...transport, terminal: e.target.value })}
                />
              </Field>
              <Field label="Transport notes">
                <textarea
                  className="textarea"
                  value={transport.notes ?? ''}
                  onChange={(e) => upsertTransport({ ...transport, notes: e.target.value })}
                />
              </Field>
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 12.5 }}>
              {isTransportish
                ? 'No journey detail yet.'
                : 'Pick a transport category (flight, train, driving…) to record a journey here.'}
            </div>
          )}
        </div>

        {/* --------------------------------------------- accommodation */}
        {accommodations.length ? (
          <div className="insp__section">
            <div className="insp__section-title">Accommodation</div>
            <Field label="Linked stay">
              <select
                className="select"
                value={activity.accommodationId ?? ''}
                onChange={(e) => patch({ accommodationId: e.target.value || undefined }, 'Link stay')}
              >
                <option value="">Not linked</option>
                {accommodations.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : null}

        {/* -------------------------------------------------- booking */}
        <div className="insp__section">
          <div className="insp__section-title">
            Booking
            {!booking ? (
              <button className="btn btn--ghost btn--sm" onClick={ensureBooking}>
                <Icon name="plus" size={12} /> Add
              </button>
            ) : null}
          </div>
          {booking ? (
            <div className="stack">
              <div className="grid2">
                <Field label="Reference">
                  <input
                    className="input"
                    value={booking.reference ?? ''}
                    placeholder="ABC123"
                    onChange={(e) => upsertBooking({ ...booking, reference: e.target.value })}
                  />
                </Field>
                <Field label="Provider">
                  <input
                    className="input"
                    value={booking.provider ?? ''}
                    onChange={(e) => upsertBooking({ ...booking, provider: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Booking link">
                <input
                  className="input"
                  value={booking.url ?? ''}
                  placeholder="https://"
                  onChange={(e) => upsertBooking({ ...booking, url: e.target.value })}
                />
              </Field>
              <Field label="Status">
                <select
                  className="select"
                  value={booking.status}
                  onChange={(e) =>
                    upsertBooking({ ...booking, status: e.target.value as typeof booking.status })
                  }
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="pending">Pending</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </Field>
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 12.5 }}>
              No reservation recorded.
            </div>
          )}
        </div>

        {/* ----------------------------------------------------- cost */}
        <div className="insp__section">
          <div className="insp__section-title">Cost &amp; contact</div>
          <div className="grid3">
            <Field label="Cost">
              <input
                className="input tabular"
                type="number"
                min={0}
                value={activity.cost ?? ''}
                onChange={(e) =>
                  patch({
                    cost: e.target.value ? Number(e.target.value) : undefined,
                    currency: activity.currency ?? data.trips[activity.tripId]?.baseCurrency,
                  })
                }
              />
            </Field>
            <Field label="Currency">
              <input
                className="input"
                value={activity.currency ?? ''}
                placeholder={data.trips[activity.tripId]?.baseCurrency}
                onChange={(e) => patch({ currency: e.target.value || undefined })}
              />
            </Field>
            <Field label="Phone">
              <input
                className="input"
                value={activity.phone ?? ''}
                placeholder="+81…"
                onChange={(e) => patch({ phone: e.target.value || undefined })}
              />
            </Field>
          </div>
        </div>

        {/* ---------------------------------------------------- notes */}
        <div className="insp__section">
          <div className="insp__section-title">Description &amp; notes</div>
          <div className="stack">
            <Field label="Description">
              <textarea
                className="textarea"
                value={activity.description ?? ''}
                placeholder="What is this, and why is it on the list?"
                onChange={(e) => patch({ description: e.target.value })}
              />
            </Field>
            <Field label="Notes">
              <textarea
                className="textarea"
                value={activity.notes ?? ''}
                placeholder="Practicalities — cash only, meet at the north exit…"
                onChange={(e) => patch({ notes: e.target.value })}
              />
            </Field>
          </div>
        </div>

        {/* ---------------------------------------------------- links */}
        <div className="insp__section">
          <div className="insp__section-title">
            Links
            <button
              className="btn btn--ghost btn--sm"
              onClick={() =>
                patch({
                  links: [
                    ...activity.links,
                    { id: `${activity.id}_l${activity.links.length}_${Date.now().toString(36)}`, label: '', url: '' },
                  ],
                })
              }
            >
              <Icon name="plus" size={12} /> Add
            </button>
          </div>
          {activity.links.length ? (
            <div className="stack stack--tight">
              {activity.links.map((link, i) => (
                <div className="row" key={link.id}>
                  <input
                    className="input"
                    style={{ flex: '0 0 32%' }}
                    value={link.label}
                    placeholder="Label"
                    onChange={(e) => {
                      const links = [...activity.links]
                      links[i] = { ...link, label: e.target.value }
                      patch({ links })
                    }}
                  />
                  <input
                    className="input"
                    value={link.url}
                    placeholder="https://"
                    onChange={(e) => {
                      const links = [...activity.links]
                      links[i] = { ...link, url: e.target.value }
                      patch({ links })
                    }}
                  />
                  {link.url ? (
                    <a
                      className="btn btn--ghost btn--icon"
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${link.label || link.url}`}
                    >
                      <Icon name="external" size={14} />
                    </a>
                  ) : null}
                  <button
                    className="btn btn--ghost btn--icon"
                    aria-label="Remove link"
                    onClick={() => patch({ links: activity.links.filter((l) => l.id !== link.id) })}
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 12.5 }}>
              No links yet.
            </div>
          )}
        </div>

        {/* --------------------------------------------------- actions */}
        <div className="insp__section">
          <div className="row row--wrap">
            <button
              className="btn"
              onClick={() => {
                const id = duplicate(activity.id)
                if (id) selectActivity(id)
              }}
            >
              <Icon name="copy" size={14} /> Duplicate
            </button>
            {activity.dayId ? (
              <button className="btn" onClick={() => move(activity.id, null)}>
                <Icon name="bulb" size={14} /> Move to ideas
              </button>
            ) : null}
            <div className="topbar__spacer" />
            <button className="btn btn--danger" onClick={() => setConfirmDelete(true)}>
              <Icon name="trash" size={14} /> Delete
            </button>
          </div>
        </div>
      </div>

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete activity"
          message={`“${activity.title}” will be removed from the trip. You can undo this with Ctrl+Z.`}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false)
            remove(activity.id)
            onClose()
          }}
        />
      ) : null}
    </div>
  )
}
