import { useRef, useState } from 'react'
import type { Trip, TripData } from '@/domain/types'
import { COLLECTIONS } from '@/domain/types'
import { useTripStore } from '@/store/tripStore'
import { useUiStore, type ThemeSetting } from '@/store/uiStore'
import { getTileConfig } from '@/platform/mapConfig'
import { Icon } from '@/ui/Icon'
import { ConfirmDialog, Field, Switch } from '@/ui/primitives'

/**
 * Settings, plus the escape hatches an offline-first app owes its user:
 * take your data out as a file, put it back, or start over from the demo.
 */
export function SettingsView({ trip }: { trip?: Trip }) {
  const data = useTripStore((s) => s.data)
  const updateTrip = useTripStore((s) => s.updateTrip)
  const syncTripDays = useTripStore((s) => s.syncTripDays)
  const resetToDemo = useTripStore((s) => s.resetToDemo)
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const warningsMuted = useUiStore((s) => s.warningsMuted)
  const setWarningsMuted = useUiStore((s) => s.setWarningsMuted)
  const [confirmReset, setConfirmReset] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const tiles = getTileConfig()

  function exportJson() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `atlas-trips-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function importJson(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as Partial<TripData>
      const missing = COLLECTIONS.filter((c) => !parsed[c] || typeof parsed[c] !== 'object')
      if (missing.length) {
        setImportMessage(`That file is missing: ${missing.join(', ')}.`)
        return
      }
      const store = useTripStore.getState()
      const count = Object.keys(parsed.trips ?? {}).length
      // Merge rather than replace, so an import never destroys existing trips.
      useTripStore.setState({
        data: {
          trips: { ...data.trips, ...parsed.trips },
          days: { ...data.days, ...parsed.days },
          activities: { ...data.activities, ...parsed.activities },
          locations: { ...data.locations, ...parsed.locations },
          accommodations: { ...data.accommodations, ...parsed.accommodations },
          transports: { ...data.transports, ...parsed.transports },
          bookings: { ...data.bookings, ...parsed.bookings },
        },
      })
      const first = Object.keys(parsed.trips ?? {})[0]
      if (first) store.setActiveTrip(first)
      // Touch the trip so the change is written through to storage.
      if (first) store.updateTrip(first, {})
      setImportMessage(`Imported ${count} ${count === 1 ? 'trip' : 'trips'}.`)
    } catch {
      setImportMessage('That file could not be read as an Atlas export.')
    }
  }

  return (
    <div className="view view--pad">
      <div className="wrap stack stack--loose" style={{ maxWidth: 760 }}>
        {trip ? (
          <section className="panel-card">
            <div className="panel-card__head">
              <Icon name="calendar" size={14} />
              <span className="panel-card__title">Trip</span>
            </div>
            <div className="panel-card__body stack">
              <Field label="Name">
                <input
                  className="input"
                  value={trip.name}
                  onChange={(e) => updateTrip(trip.id, { name: e.target.value })}
                />
              </Field>
              <div className="grid2">
                <Field label="Start date">
                  <input
                    className="input tabular"
                    type="date"
                    value={trip.startDate}
                    onChange={(e) => updateTrip(trip.id, { startDate: e.target.value })}
                  />
                </Field>
                <Field label="End date">
                  <input
                    className="input tabular"
                    type="date"
                    value={trip.endDate}
                    min={trip.startDate}
                    onChange={(e) => updateTrip(trip.id, { endDate: e.target.value })}
                  />
                </Field>
              </div>
              <div className="muted" style={{ fontSize: 11.5 }}>
                Changing the dates adds or removes days. Activities on a removed day are moved back to
                Ideas — nothing is deleted.
              </div>
              <Field label="Destinations" hint="Comma separated">
                <input
                  className="input"
                  value={trip.destinations.join(', ')}
                  onChange={(e) =>
                    updateTrip(trip.id, {
                      destinations: e.target.value
                        .split(',')
                        .map((d) => d.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
              <Field label="Description">
                <textarea
                  className="textarea"
                  value={trip.description ?? ''}
                  onChange={(e) => updateTrip(trip.id, { description: e.target.value })}
                />
              </Field>
              <div className="grid2">
                <Field label="Base currency">
                  <input
                    className="input"
                    value={trip.baseCurrency}
                    onChange={(e) => updateTrip(trip.id, { baseCurrency: e.target.value.toUpperCase() })}
                  />
                </Field>
                <Field label="Cover image URL" hint="Leave blank for the generated cover">
                  <input
                    className="input"
                    value={trip.coverImage?.startsWith('atlas:') ? '' : (trip.coverImage ?? '')}
                    placeholder="https://…"
                    onChange={(e) => updateTrip(trip.id, { coverImage: e.target.value || undefined })}
                  />
                </Field>
              </div>
              <div>
                <button className="btn btn--sm" onClick={() => syncTripDays(trip.id)}>
                  <Icon name="calendar" size={13} /> Rebuild days from dates
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="panel-card">
          <div className="panel-card__head">
            <Icon name="sun" size={14} />
            <span className="panel-card__title">Appearance</span>
          </div>
          <div className="panel-card__body stack">
            <Field label="Theme">
              <div className="segmented">
                {(['system', 'light', 'dark'] as ThemeSetting[]).map((t) => (
                  <button key={t} className={theme === t ? 'is-on' : ''} onClick={() => setTheme(t)}>
                    <Icon name={t === 'dark' ? 'moon' : t === 'light' ? 'sun' : 'settings'} size={13} />
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </Field>
            <Switch
              checked={!warningsMuted}
              onChange={(v) => setWarningsMuted(!v)}
              label="Show itinerary warnings"
            />
            <div className="muted" style={{ fontSize: 11.5 }}>
              Warnings never change your plan. Turning them off only hides the badges.
            </div>
          </div>
        </section>

        <section className="panel-card">
          <div className="panel-card__head">
            <Icon name="pin" size={14} />
            <span className="panel-card__title">Maps</span>
          </div>
          <div className="panel-card__body stack">
            <div className="detail-row">
              <span className="detail-row__label">Tile source</span>
              <span className="detail-row__value">
                {tiles.isDefault ? 'OpenStreetMap (default, no key needed)' : 'Custom provider'}
              </span>
            </div>
            <div className="muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
              To use a commercial provider, create a <code>.env.local</code> file with{' '}
              <code>VITE_MAP_TILE_URL</code> and <code>VITE_MAP_API_KEY</code>. See{' '}
              <code>.env.example</code>. Keys are read from the environment and never stored in the
              trip data.
            </div>
          </div>
        </section>

        <section className="panel-card">
          <div className="panel-card__head">
            <Icon name="layers" size={14} />
            <span className="panel-card__title">Data</span>
          </div>
          <div className="panel-card__body stack">
            <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.6 }}>
              Everything is stored on this device (IndexedDB, with a localStorage fallback). The trip
              works with no network at all — only map tiles need one.
            </div>
            <div className="row gap-sm row--wrap">
              <button className="btn" onClick={exportJson}>
                <Icon name="external" size={14} /> Export JSON
              </button>
              <button className="btn" onClick={() => fileRef.current?.click()}>
                <Icon name="plus" size={14} /> Import JSON
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void importJson(file)
                  e.target.value = ''
                }}
              />
              <div className="topbar__spacer" />
              <button className="btn btn--danger" onClick={() => setConfirmReset(true)}>
                <Icon name="undo" size={14} /> Reset to demo trip
              </button>
            </div>
            {importMessage ? (
              <div className="warn warn--info">
                <span className="warn__icon">
                  <Icon name="bulb" size={14} />
                </span>
                <span>{importMessage}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel-card">
          <div className="panel-card__head">
            <Icon name="book" size={14} />
            <span className="panel-card__title">Keyboard</span>
          </div>
          <div className="panel-card__body">
            <div className="stack stack--tight">
              {[
                ['Ctrl / ⌘ + Z', 'Undo'],
                ['Ctrl / ⌘ + Shift + Z', 'Redo'],
                ['J / K', 'Previous / next day'],
                ['N', 'Focus the quick-add field'],
                ['M', 'Toggle the map panel'],
                ['I', 'Toggle the ideas panel'],
                ['Esc', 'Close the inspector'],
                ['1 – 6', 'Jump between views'],
              ].map(([keys, action]) => (
                <div className="detail-row" key={keys}>
                  <span className="detail-row__label">
                    <span className="kbd">{keys}</span>
                  </span>
                  <span className="detail-row__value">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {confirmReset ? (
        <ConfirmDialog
          title="Reset to demo trip"
          message="This deletes every trip on this device and restores the Japan 2027 demo. Export first if you want to keep your work."
          confirmLabel="Reset everything"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            setConfirmReset(false)
            void resetToDemo()
          }}
        />
      ) : null}
    </div>
  )
}
