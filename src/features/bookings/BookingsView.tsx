import { useMemo, useState } from 'react'
import type { Accommodation, ID, Trip } from '@/domain/types'
import { accommodationsForTrip, listDays } from '@/domain/selectors'
import { addDays, dayOfMonth, formatShortDate, monthShort, weekdayShort } from '@/domain/time'
import { TRANSPORT_META } from '@/domain/categories'
import { useTripStore } from '@/store/tripStore'
import { useUiStore } from '@/store/uiStore'
import { Icon } from '@/ui/Icon'
import { CategoryIcon, ConfirmDialog, Field } from '@/ui/primitives'

/**
 * Everything with a reference number, in one place: stays, journeys and the
 * reservations attached to them. This is the screen you open at a check-in desk.
 */
export function BookingsView({ trip, onOpenDay }: { trip: Trip; onOpenDay: (dayId: ID) => void }) {
  const data = useTripStore((s) => s.data)
  const upsertAccommodation = useTripStore((s) => s.upsertAccommodation)
  const deleteAccommodation = useTripStore((s) => s.deleteAccommodation)
  const upsertBooking = useTripStore((s) => s.upsertBooking)
  const addActivity = useTripStore((s) => s.addActivity)
  const upsertTransport = useTripStore((s) => s.upsertTransport)
  const selectActivity = useUiStore((s) => s.selectActivity)
  const [confirmStay, setConfirmStay] = useState<Accommodation | null>(null)

  const stays = useMemo(() => accommodationsForTrip(data, trip.id), [data, trip.id])
  const days = useMemo(() => listDays(data, trip.id), [data, trip.id])

  const journeys = useMemo(
    () =>
      Object.values(data.activities)
        .filter((a) => a.tripId === trip.id && a.transportId)
        .sort((a, b) => {
          const da = a.dayId ? (data.days[a.dayId]?.date ?? '') : ''
          const db = b.dayId ? (data.days[b.dayId]?.date ?? '') : ''
          return da.localeCompare(db) || (a.startTime ?? '').localeCompare(b.startTime ?? '')
        }),
    [data, trip.id],
  )

  const bookings = useMemo(() => {
    const subjects = new Map<ID, string>()
    for (const a of Object.values(data.activities)) {
      if (a.bookingId) subjects.set(a.bookingId, a.title)
    }
    for (const h of Object.values(data.accommodations)) {
      if (h.bookingId) subjects.set(h.bookingId, h.name)
    }
    return Object.values(data.bookings)
      .filter((b) => b.tripId === trip.id)
      .map((b) => ({ booking: b, subject: subjects.get(b.id) ?? 'Unlinked' }))
  }, [data, trip.id])

  function addStay() {
    const start = days[0]?.date ?? trip.startDate
    upsertAccommodation({
      tripId: trip.id,
      name: 'New stay',
      checkInDate: start,
      checkOutDate: addDays(start, 1),
      checkInTime: '15:00',
      checkOutTime: '11:00',
    })
  }

  function addJourney() {
    const dayId = days[0]?.id
    const transportId = upsertTransport({
      tripId: trip.id,
      mode: 'train',
      fromLabel: '',
      toLabel: '',
    })
    const id = addActivity({
      tripId: trip.id,
      dayId,
      title: 'New journey',
      category: 'train',
      timePrecision: 'exact',
      startTime: '09:00',
      transportId,
    })
    selectActivity(id)
    if (dayId) onOpenDay(dayId)
  }

  return (
    <div className="view view--pad">
      <div className="wrap stack stack--loose">
        {/* ------------------------------------------------- stays */}
        <section>
          <div className="row mb-md">
            <h2 className="topbar__title" style={{ fontSize: 17 }}>
              Accommodation
            </h2>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {stays.length} {stays.length === 1 ? 'stay' : 'stays'}
            </span>
            <div className="topbar__spacer" />
            <button className="btn" onClick={addStay}>
              <Icon name="plus" size={14} /> Add stay
            </button>
          </div>

          <div className="cards">
            {stays.map((stay) => {
              const booking = stay.bookingId ? data.bookings[stay.bookingId] : undefined
              return (
                <div className="panel-card" key={stay.id}>
                  <div className="panel-card__head">
                    <CategoryIcon category="accommodation" size="sm" />
                    <input
                      className="inline-edit panel-card__title"
                      value={stay.name}
                      aria-label="Stay name"
                      onChange={(e) => upsertAccommodation({ ...stay, name: e.target.value })}
                    />
                    <div className="topbar__spacer" />
                    <button
                      className="btn btn--ghost btn--icon btn--sm"
                      aria-label="Delete stay"
                      title="Delete stay"
                      onClick={() => setConfirmStay(stay)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                  <div className="panel-card__body stack">
                    <div className="grid2">
                      <Field label="Check in">
                        <input
                          className="input tabular"
                          type="date"
                          value={stay.checkInDate}
                          onChange={(e) => upsertAccommodation({ ...stay, checkInDate: e.target.value })}
                        />
                      </Field>
                      <Field label="Time">
                        <input
                          className="input tabular"
                          type="time"
                          value={stay.checkInTime ?? ''}
                          onChange={(e) => upsertAccommodation({ ...stay, checkInTime: e.target.value })}
                        />
                      </Field>
                    </div>
                    <div className="grid2">
                      <Field label="Check out">
                        <input
                          className="input tabular"
                          type="date"
                          value={stay.checkOutDate}
                          onChange={(e) => upsertAccommodation({ ...stay, checkOutDate: e.target.value })}
                        />
                      </Field>
                      <Field label="Time">
                        <input
                          className="input tabular"
                          type="time"
                          value={stay.checkOutTime ?? ''}
                          onChange={(e) => upsertAccommodation({ ...stay, checkOutTime: e.target.value })}
                        />
                      </Field>
                    </div>
                    <Field label="Address">
                      <input
                        className="input"
                        value={stay.address ?? ''}
                        onChange={(e) => upsertAccommodation({ ...stay, address: e.target.value })}
                      />
                    </Field>
                    <div className="grid2">
                      <Field label="Phone">
                        <input
                          className="input"
                          value={stay.phone ?? ''}
                          onChange={(e) => upsertAccommodation({ ...stay, phone: e.target.value })}
                        />
                      </Field>
                      <Field label="Cost">
                        <input
                          className="input tabular"
                          type="number"
                          value={stay.cost ?? ''}
                          onChange={(e) =>
                            upsertAccommodation({
                              ...stay,
                              cost: e.target.value ? Number(e.target.value) : undefined,
                              currency: stay.currency ?? trip.baseCurrency,
                            })
                          }
                        />
                      </Field>
                    </div>
                    <Field label="Booking reference">
                      <input
                        className="input"
                        value={booking?.reference ?? ''}
                        placeholder="Add a reference"
                        onChange={(e) => {
                          if (booking) upsertBooking({ ...booking, reference: e.target.value })
                          else {
                            const id = upsertBooking({
                              tripId: trip.id,
                              reference: e.target.value,
                              status: 'confirmed',
                            })
                            upsertAccommodation({ ...stay, bookingId: id })
                          }
                        }}
                      />
                    </Field>
                    <Field label="Booking link">
                      <input
                        className="input"
                        value={stay.url ?? ''}
                        placeholder="https://"
                        onChange={(e) => upsertAccommodation({ ...stay, url: e.target.value })}
                      />
                    </Field>
                    <Field label="Notes">
                      <textarea
                        className="textarea"
                        value={stay.notes ?? ''}
                        onChange={(e) => upsertAccommodation({ ...stay, notes: e.target.value })}
                      />
                    </Field>
                    <div className="row">
                      {stay.phone ? (
                        <a className="btn btn--sm" href={`tel:${stay.phone.replace(/\s/g, '')}`}>
                          <Icon name="phone" size={13} /> Call
                        </a>
                      ) : null}
                      {stay.url ? (
                        <a className="btn btn--sm" href={stay.url} target="_blank" rel="noreferrer">
                          <Icon name="external" size={13} /> Open
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
            {!stays.length ? (
              <div className="panel-card">
                <div className="panel-card__body empty">
                  <div className="empty__title">No accommodation yet</div>
                  <div className="empty__body">Add a stay and it will appear on every night it covers.</div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* ---------------------------------------------- journeys */}
        <section>
          <div className="row mb-md">
            <h2 className="topbar__title" style={{ fontSize: 17 }}>
              Transport
            </h2>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {journeys.length} {journeys.length === 1 ? 'journey' : 'journeys'}
            </span>
            <div className="topbar__spacer" />
            <button className="btn" onClick={addJourney}>
              <Icon name="plus" size={14} /> Add journey
            </button>
          </div>

          <div className="panel-card">
            <div className="panel-card__body panel-card__body--flush">
              {journeys.length ? (
                journeys.map((activity) => {
                  const transport = data.transports[activity.transportId!]
                  const day = activity.dayId ? data.days[activity.dayId] : undefined
                  const booking = activity.bookingId ? data.bookings[activity.bookingId] : undefined
                  if (!transport) return null
                  return (
                    <button
                      key={activity.id}
                      className="list-row"
                      onClick={() => {
                        selectActivity(activity.id)
                        if (activity.dayId) onOpenDay(activity.dayId)
                      }}
                    >
                      <CategoryIcon category={activity.category} />
                      <span className="list-row__main">
                        <span className="list-row__title">
                          {transport.fromLabel || '—'} → {transport.toLabel || '—'}
                        </span>
                        <span className="list-row__sub">
                          {[
                            TRANSPORT_META[transport.mode].label,
                            transport.carrier,
                            transport.vehicleNumber,
                            transport.seat ? `Seat ${transport.seat}` : null,
                            transport.platform ? `Platform ${transport.platform}` : null,
                            booking?.reference,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <span className="list-row__aside">
                        {day ? (
                          <>
                            {weekdayShort(day.date)} {dayOfMonth(day.date)} {monthShort(day.date)}
                            <br />
                          </>
                        ) : null}
                        {activity.startTime}
                        {activity.endTime ? `–${activity.endTime}` : ''}
                      </span>
                    </button>
                  )
                })
              ) : (
                <div className="empty">
                  <div className="empty__body">No journeys recorded.</div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------- bookings */}
        <section>
          <div className="row mb-md">
            <h2 className="topbar__title" style={{ fontSize: 17 }}>
              Reservations
            </h2>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {bookings.length} total
            </span>
          </div>

          <div className="panel-card">
            <div className="panel-card__body panel-card__body--flush">
              {bookings.length ? (
                bookings.map(({ booking, subject }) => (
                  <div className="list-row" key={booking.id}>
                    <Icon name="ticket" size={15} />
                    <span className="list-row__main">
                      <span className="list-row__title">{subject}</span>
                      <span className="list-row__sub">
                        {[booking.provider, booking.reference].filter(Boolean).join(' · ') ||
                          'No reference recorded'}
                      </span>
                    </span>
                    <span className="list-row__aside" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span
                        className={`chip${booking.status === 'confirmed' ? ' chip--accent' : booking.status === 'pending' ? ' chip--warn' : ''}`}
                      >
                        {booking.status}
                      </span>
                      {booking.cost ? (
                        <span className="tabular">
                          {booking.cost.toLocaleString()} {booking.currency ?? ''}
                        </span>
                      ) : null}
                      {booking.url ? (
                        <a
                          className="btn btn--ghost btn--icon btn--sm"
                          href={booking.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Open booking"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Icon name="external" size={13} />
                        </a>
                      ) : null}
                    </span>
                  </div>
                ))
              ) : (
                <div className="empty">
                  <div className="empty__body">No reservations yet.</div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {confirmStay ? (
        <ConfirmDialog
          title="Delete stay"
          message={`Remove “${confirmStay.name}” (${formatShortDate(confirmStay.checkInDate)} – ${formatShortDate(confirmStay.checkOutDate)})? Nights it covered will show as unbooked.`}
          onCancel={() => setConfirmStay(null)}
          onConfirm={() => {
            deleteAccommodation(confirmStay.id)
            setConfirmStay(null)
          }}
        />
      ) : null}
    </div>
  )
}
