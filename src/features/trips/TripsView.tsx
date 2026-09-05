import { useMemo, useState } from 'react'
import type { ID, Trip } from '@/domain/types'
import { computeTripStats } from '@/domain/selectors'
import { addDays, formatDateSpan, todayStr } from '@/domain/time'
import { useTripStore } from '@/store/tripStore'
import { Icon } from '@/ui/Icon'
import { ConfirmDialog, Field, Modal } from '@/ui/primitives'

const COVERS = ['dusk', 'sea', 'forest', 'default'] as const

/** Trip switcher and creation. Multiple trips live side by side. */
export function TripsView({ onOpenTrip }: { onOpenTrip: (tripId: ID) => void }) {
  const data = useTripStore((s) => s.data)
  const activeTripId = useTripStore((s) => s.activeTripId)
  const setActiveTrip = useTripStore((s) => s.setActiveTrip)
  const deleteTrip = useTripStore((s) => s.deleteTrip)
  const [creating, setCreating] = useState(false)
  const [confirm, setConfirm] = useState<Trip | null>(null)

  const trips = useMemo(
    () => Object.values(data.trips).sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [data.trips],
  )

  return (
    <div className="view view--pad">
      <div className="wrap stack stack--loose">
        <div className="row">
          <h2 className="topbar__title" style={{ fontSize: 19 }}>
            Trips
          </h2>
          <div className="topbar__spacer" />
          <button className="btn btn--primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={14} /> New trip
          </button>
        </div>

        <div className="cards">
          {trips.map((trip) => {
            const stats = computeTripStats(data, trip.id)
            const cover = trip.coverImage?.startsWith('atlas:') ? trip.coverImage.slice(6) : undefined
            return (
              <div className="panel-card" key={trip.id}>
                <div
                  className="hero__art"
                  data-cover={cover}
                  style={{
                    height: 76,
                    ...(trip.coverImage && !cover
                      ? {
                          backgroundImage: `url(${trip.coverImage})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }
                      : {}),
                  }}
                />
                <div className="panel-card__body">
                  <div className="row">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 620, fontSize: 16, letterSpacing: '-0.02em' }}>
                        {trip.name}
                      </div>
                      <div className="muted tabular" style={{ fontSize: 12.5 }}>
                        {formatDateSpan(trip.startDate, trip.endDate)}
                      </div>
                    </div>
                    {trip.id === activeTripId ? <span className="chip chip--accent">Active</span> : null}
                  </div>

                  <div className="muted mt-sm" style={{ fontSize: 12.5 }}>
                    {trip.destinations.join(' → ') || 'No destinations yet'}
                  </div>

                  <div className="row gap-sm mt-md" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    <span>{stats.totalDays} days</span>
                    <span>·</span>
                    <span>{stats.activityCount} activities</span>
                    <span>·</span>
                    <span>{stats.bookingCount} bookings</span>
                  </div>

                  <div className="row gap-sm mt-md">
                    <button
                      className="btn btn--primary"
                      onClick={() => {
                        setActiveTrip(trip.id)
                        onOpenTrip(trip.id)
                      }}
                    >
                      Open
                    </button>
                    <div className="topbar__spacer" />
                    <button
                      className="btn btn--ghost btn--icon"
                      aria-label={`Delete ${trip.name}`}
                      title="Delete trip"
                      onClick={() => setConfirm(trip)}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {creating ? <NewTripModal onClose={() => setCreating(false)} onCreated={onOpenTrip} /> : null}
      {confirm ? (
        <ConfirmDialog
          title="Delete trip"
          message={`“${confirm.name}” and everything in it — days, activities, bookings — will be deleted.`}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            deleteTrip(confirm.id)
            setConfirm(null)
          }}
        />
      ) : null}
    </div>
  )
}

export function NewTripModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (tripId: ID) => void
}) {
  const createTrip = useTripStore((s) => s.createTrip)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState(addDays(todayStr(), 6))
  const [destinations, setDestinations] = useState('')
  const [description, setDescription] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [cover, setCover] = useState<(typeof COVERS)[number]>('dusk')

  const valid = name.trim().length > 0 && startDate <= endDate

  function submit() {
    if (!valid) return
    const id = createTrip({
      name,
      startDate,
      endDate,
      destinations: destinations
        .split(/[,→>]/)
        .map((d) => d.trim())
        .filter(Boolean),
      description: description.trim() || undefined,
      coverImage: cover === 'default' ? undefined : `atlas:${cover}`,
      baseCurrency: currency.trim().toUpperCase() || 'EUR',
    })
    onClose()
    onCreated(id)
  }

  return (
    <Modal
      title="New trip"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={!valid}>
            Create trip
          </button>
        </>
      }
    >
      <div className="stack">
        <Field label="Trip name">
          <input
            className="input"
            type="text"
            value={name}
            placeholder="Japan 2027"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && valid) submit()
            }}
          />
        </Field>
        <div className="grid2">
          <Field label="Start date">
            <input
              className="input tabular"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                if (e.target.value > endDate) setEndDate(e.target.value)
              }}
            />
          </Field>
          <Field label="End date">
            <input
              className="input tabular"
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Destinations" hint="Separate with commas — Tokyo, Kyoto, Osaka">
          <input
            className="input"
            type="text"
            value={destinations}
            placeholder="Tokyo, Kyoto, Osaka"
            onChange={(e) => setDestinations(e.target.value)}
          />
        </Field>
        <Field label="Description">
          <textarea
            className="textarea"
            value={description}
            placeholder="Optional — the shape of the trip in a sentence."
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid2">
          <Field label="Currency">
            <input className="input" value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </Field>
          <Field label="Cover">
            <div className="row gap-sm">
              {COVERS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="hero__art"
                  data-cover={c === 'default' ? undefined : c}
                  aria-label={`Cover ${c}`}
                  aria-pressed={cover === c}
                  onClick={() => setCover(c)}
                  style={{
                    height: 30,
                    width: 44,
                    borderRadius: 6,
                    border: cover === c ? '2px solid var(--accent)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </div>
          </Field>
        </div>
      </div>
    </Modal>
  )
}
