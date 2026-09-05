import { useMemo } from 'react'
import type { ID, Trip } from '@/domain/types'
import {
  accommodationsForTrip,
  computeTripStats,
  ideasForTrip,
  listDays,
} from '@/domain/selectors'
import { formatDateSpan, formatShortDate, daysBetween } from '@/domain/time'
import type { Warning } from '@/domain/warnings'
import { useTripStore } from '@/store/tripStore'
import { useUiStore } from '@/store/uiStore'
import { WarningList } from '@/features/warnings/WarningList'
import { Icon } from '@/ui/Icon'
import { CategoryIcon } from '@/ui/primitives'

/**
 * The dashboard answers three questions: what is this trip, is it coherent,
 * and what still needs attention. It is a summary, not an analytics console.
 */
export function OverviewView({
  trip,
  warnings,
  onOpenDay,
  onGoto,
}: {
  trip: Trip
  warnings: Warning[]
  onOpenDay: (dayId: ID) => void
  onGoto: (route: string) => void
}) {
  const data = useTripStore((s) => s.data)
  const updateTrip = useTripStore((s) => s.updateTrip)
  const selectDay = useUiStore((s) => s.selectDay)

  const stats = useMemo(() => computeTripStats(data, trip.id), [data, trip.id])
  const days = useMemo(() => listDays(data, trip.id), [data, trip.id])
  const stays = useMemo(() => accommodationsForTrip(data, trip.id), [data, trip.id])
  const ideas = useMemo(() => ideasForTrip(data, trip.id), [data, trip.id])
  const realWarnings = warnings.filter((w) => w.severity === 'warning')
  const missingStays = realWarnings.filter((w) => w.code === 'noAccommodation')
  const cover = trip.coverImage?.startsWith('atlas:') ? trip.coverImage.slice(6) : undefined
  const maxNights = Math.max(1, ...stats.nightsByPlace.map((n) => n.nights))

  const upcomingBookings = useMemo(
    () =>
      Object.values(data.activities)
        .filter((a) => a.tripId === trip.id && a.bookingId && a.dayId)
        .sort((a, b) => {
          const da = data.days[a.dayId!]?.date ?? ''
          const db = data.days[b.dayId!]?.date ?? ''
          return da.localeCompare(db) || (a.startTime ?? '').localeCompare(b.startTime ?? '')
        })
        .slice(0, 5),
    [data, trip.id],
  )

  return (
    <div className="view view--pad">
      <div className="wrap stack stack--loose">
        {/* ------------------------------------------------------ hero */}
        <div className="hero">
          <div
            className="hero__art"
            data-cover={cover}
            style={
              trip.coverImage && !cover
                ? { backgroundImage: `url(${trip.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                : undefined
            }
          />
          <div className="hero__body">
            <div style={{ flex: '1 1 340px', minWidth: 0 }}>
              <input
                className="inline-edit hero__name"
                value={trip.name}
                aria-label="Trip name"
                onChange={(e) => updateTrip(trip.id, { name: e.target.value })}
              />
              <div className="hero__route">
                <span className="tabular">{formatDateSpan(trip.startDate, trip.endDate)}</span>
                <span className="muted">·</span>
                {trip.destinations.map((dest, i) => (
                  <span key={dest} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    {i > 0 ? <Icon name="arrowRight" size={12} /> : null}
                    {dest}
                  </span>
                ))}
              </div>
              {trip.description ? <p className="hero__desc">{trip.description}</p> : null}
            </div>

            <div className="stack" style={{ flex: '0 0 auto' }}>
              <button className="btn btn--primary" onClick={() => onGoto('plan')}>
                <Icon name="layers" size={14} /> Open planner
              </button>
              <button className="btn" onClick={() => onGoto('today')}>
                <Icon name="play" size={14} /> Travel mode
              </button>
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------- stats */}
        <div className="stats">
          <Stat value={stats.totalDays} label="Days" />
          <Stat value={`${stats.plannedDays}/${stats.totalDays}`} label="Days planned" />
          <Stat value={stats.activityCount} label="Activities" />
          <Stat value={stats.bookingCount} label="Bookings" />
          <Stat value={stats.transportCount} label="Transport" />
          <Stat value={stats.accommodationCount} label="Stays" />
          <Stat value={stats.ideaCount} label="Ideas" />
          <Stat
            value={realWarnings.length}
            label={realWarnings.length === 1 ? 'Warning' : 'Warnings'}
            warn={realWarnings.length > 0}
          />
        </div>

        <div className="cards">
          {/* ------------------------------------------------ where */}
          <section className="panel-card">
            <div className="panel-card__head">
              <Icon name="pin" size={14} />
              <span className="panel-card__title">Where you sleep</span>
              <div className="topbar__spacer" />
              <span className="muted tabular" style={{ fontSize: 11.5 }}>
                {daysBetween(trip.startDate, trip.endDate)} nights
              </span>
            </div>
            <div className="panel-card__body">
              <div className="bars">
                {stats.nightsByPlace.map((entry) => (
                  <div className="bar-row" key={entry.place}>
                    <span className="truncate" title={entry.place}>
                      {entry.place}
                    </span>
                    <span className="bar-row__track">
                      <span
                        className="bar-row__fill"
                        style={{ width: `${(entry.nights / maxNights) * 100}%` }}
                      />
                    </span>
                    <span className="bar-row__value">
                      {entry.nights} {entry.nights === 1 ? 'night' : 'nights'}
                    </span>
                  </div>
                ))}
              </div>
              {stats.estimatedCost > 0 ? (
                <div className="detail-row mt-md" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <span className="detail-row__label">Estimated cost</span>
                  <span className="detail-row__value tabular">
                    {Math.round(stats.estimatedCost).toLocaleString()} {trip.baseCurrency}
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          {/* --------------------------------------------- warnings */}
          <section className="panel-card">
            <div className="panel-card__head">
              <Icon name="alert" size={14} />
              <span className="panel-card__title">Itinerary checks</span>
              <div className="topbar__spacer" />
              {missingStays.length ? (
                <span className="chip chip--warn">{missingStays.length} missing stay</span>
              ) : null}
            </div>
            <div className="panel-card__body">
              {warnings.length ? (
                <WarningList
                  warnings={warnings.slice(0, 6)}
                  onPickDay={(dayId) => {
                    selectDay(dayId)
                    onOpenDay(dayId)
                  }}
                />
              ) : (
                <div className="empty" style={{ padding: '18px 6px' }}>
                  <Icon name="check" size={20} />
                  <div className="empty__title">Everything checks out</div>
                  <div className="empty__body">No timing, distance or accommodation problems found.</div>
                </div>
              )}
              {warnings.length > 6 ? (
                <button className="btn btn--ghost btn--sm mt-sm" onClick={() => onGoto('plan')}>
                  See all {warnings.length} in the planner
                </button>
              ) : null}
            </div>
          </section>

          {/* ------------------------------------------------ stays */}
          <section className="panel-card">
            <div className="panel-card__head">
              <Icon name="bed" size={14} />
              <span className="panel-card__title">Accommodation</span>
              <div className="topbar__spacer" />
              <button className="btn btn--ghost btn--sm" onClick={() => onGoto('bookings')}>
                Manage
              </button>
            </div>
            <div className="panel-card__body panel-card__body--flush">
              {stays.length ? (
                stays.map((stay) => (
                  <button key={stay.id} className="list-row" onClick={() => onGoto('bookings')}>
                    <CategoryIcon category="accommodation" size="sm" />
                    <span className="list-row__main">
                      <span className="list-row__title">{stay.name}</span>
                      <span className="list-row__sub">
                        {formatShortDate(stay.checkInDate)} → {formatShortDate(stay.checkOutDate)}
                        {stay.address ? ` · ${stay.address}` : ''}
                      </span>
                    </span>
                    <span className="list-row__aside">
                      {daysBetween(stay.checkInDate, stay.checkOutDate)}n
                    </span>
                  </button>
                ))
              ) : (
                <div className="empty" style={{ padding: '18px 6px' }}>
                  <div className="empty__body">No stays recorded yet.</div>
                </div>
              )}
            </div>
          </section>

          {/* --------------------------------------------- bookings */}
          <section className="panel-card">
            <div className="panel-card__head">
              <Icon name="ticket" size={14} />
              <span className="panel-card__title">Booked and confirmed</span>
              <div className="topbar__spacer" />
              <button className="btn btn--ghost btn--sm" onClick={() => onGoto('bookings')}>
                All bookings
              </button>
            </div>
            <div className="panel-card__body panel-card__body--flush">
              {upcomingBookings.length ? (
                upcomingBookings.map((a) => {
                  const day = a.dayId ? data.days[a.dayId] : undefined
                  const booking = a.bookingId ? data.bookings[a.bookingId] : undefined
                  return (
                    <button
                      key={a.id}
                      className="list-row"
                      onClick={() => {
                        if (a.dayId) onOpenDay(a.dayId)
                      }}
                    >
                      <CategoryIcon category={a.category} size="sm" />
                      <span className="list-row__main">
                        <span className="list-row__title">{a.title}</span>
                        <span className="list-row__sub">
                          {day ? formatShortDate(day.date) : ''}
                          {a.startTime ? ` · ${a.startTime}` : ''}
                          {booking?.reference ? ` · ${booking.reference}` : ''}
                        </span>
                      </span>
                    </button>
                  )
                })
              ) : (
                <div className="empty" style={{ padding: '18px 6px' }}>
                  <div className="empty__body">Nothing booked yet.</div>
                </div>
              )}
            </div>
          </section>

          {/* ------------------------------------------------ ideas */}
          <section className="panel-card">
            <div className="panel-card__head">
              <Icon name="bulb" size={14} />
              <span className="panel-card__title">Ideas waiting</span>
              <div className="topbar__spacer" />
              <button className="btn btn--ghost btn--sm" onClick={() => onGoto('ideas')}>
                Open inbox
              </button>
            </div>
            <div className="panel-card__body panel-card__body--flush">
              {ideas.length ? (
                ideas.slice(0, 6).map((idea) => (
                  <button key={idea.id} className="list-row" onClick={() => onGoto('ideas')}>
                    <CategoryIcon category={idea.category} size="sm" />
                    <span className="list-row__main">
                      <span className="list-row__title">{idea.title}</span>
                      {idea.description ? (
                        <span className="list-row__sub">{idea.description}</span>
                      ) : null}
                    </span>
                  </button>
                ))
              ) : (
                <div className="empty" style={{ padding: '18px 6px' }}>
                  <div className="empty__body">Nothing parked. Save ideas as you research.</div>
                </div>
              )}
            </div>
          </section>

          {/* ------------------------------------------------- days */}
          <section className="panel-card">
            <div className="panel-card__head">
              <Icon name="calendar" size={14} />
              <span className="panel-card__title">Day by day</span>
              <div className="topbar__spacer" />
              <button className="btn btn--ghost btn--sm" onClick={() => onGoto('timeline')}>
                Weekly view
              </button>
            </div>
            <div className="panel-card__body panel-card__body--flush">
              {days.map((day) => (
                <button key={day.id} className="list-row" onClick={() => onOpenDay(day.id)}>
                  <span className="list-row__main">
                    <span className="list-row__title">
                      {formatShortDate(day.date)}
                      {day.locationLabel ? ` · ${day.locationLabel}` : ''}
                    </span>
                    <span className="list-row__sub">{day.headline || 'No headline yet'}</span>
                  </span>
                  <span className="list-row__aside">
                    <Icon name="chevronRight" size={14} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Stat({ value, label, warn }: { value: number | string; label: string; warn?: boolean }) {
  return (
    <div className={`stat${warn ? ' stat--warn' : ''}`}>
      <div className="stat__value">{value}</div>
      <div className="stat__label">{label}</div>
    </div>
  )
}
