import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type {
  Accommodation,
  Activity,
  ActivityCategory,
  Booking,
  DateStr,
  Day,
  ID,
  Location,
  TimePrecision,
  Transport,
  Trip,
  TripData,
} from '@/domain/types'
import { emptyData } from '@/domain/types'
import { newId, now } from '@/domain/ids'
import { dateRange, daysBetween } from '@/domain/time'
import { activitiesForDay, ideasForTrip, listDays } from '@/domain/selectors'
import { clearAll, emptyIdSets, loadAll, persist, readSetting, writeSetting } from '@/data/db'
import { buildDemoTrip } from '@/data/demo'
import { ADOPTED_REVISION_KEY, fetchPublishedTrip } from '@/data/published'
import { broadcastData, onRemoteData } from '@/data/sync'

const HISTORY_LIMIT = 80

interface HistoryEntry {
  label: string
  data: TripData
}

export interface TripState {
  data: TripData
  ready: boolean
  activeTripId: ID | null
  past: HistoryEntry[]
  future: HistoryEntry[]
  /** Label of the last committed action, surfaced in the undo affordance. */
  lastAction: string | null

  init: () => Promise<void>
  resetToDemo: () => Promise<void>
  /**
   * Revision of the published plan that differs from the one already adopted,
   * or null when this device is up to date. Set by `checkForUpdate`.
   */
  publishedUpdate: string | null
  /** Ask the site whether the published plan has moved on. */
  checkForUpdate: () => Promise<void>
  /** Replace the local copy with the published plan. Destructive, and says so. */
  adoptPublished: () => Promise<boolean>

  setActiveTrip: (tripId: ID) => void
  createTrip: (input: NewTripInput) => ID
  updateTrip: (tripId: ID, patch: Partial<Trip>) => void
  deleteTrip: (tripId: ID) => void
  /** Grow/shrink the materialised day rows to match the trip's date range. */
  syncTripDays: (tripId: ID) => void

  updateDay: (dayId: ID, patch: Partial<Day>) => void

  addActivity: (input: NewActivityInput) => ID
  updateActivity: (id: ID, patch: Partial<Activity>, label?: string) => void
  deleteActivity: (id: ID) => void
  duplicateActivity: (id: ID) => ID | null
  /** Move an activity to a day (or to the ideas inbox when `dayId` is null). */
  moveActivity: (id: ID, dayId: ID | null, opts?: MoveOptions) => void
  reorderActivity: (id: ID, targetId: ID, position: 'before' | 'after') => void
  setActivityStatus: (id: ID, status: Activity['status']) => void

  upsertLocation: (loc: Partial<Location> & { tripId: ID; name: string; id?: ID }) => ID
  deleteLocation: (id: ID) => void
  upsertAccommodation: (
    input: Partial<Accommodation> & { tripId: ID; name: string; checkInDate: DateStr; checkOutDate: DateStr; id?: ID },
  ) => ID
  deleteAccommodation: (id: ID) => void
  upsertTransport: (input: Partial<Transport> & { tripId: ID; id?: ID }) => ID
  upsertBooking: (input: Partial<Booking> & { tripId: ID; id?: ID }) => ID
  deleteBooking: (id: ID) => void

  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}

export interface NewTripInput {
  name: string
  startDate: DateStr
  endDate: DateStr
  destinations: string[]
  description?: string
  coverImage?: string
  baseCurrency?: string
}

export interface NewActivityInput {
  tripId: ID
  dayId?: ID | null
  title: string
  category?: ActivityCategory
  timePrecision?: TimePrecision
  startTime?: string
  endTime?: string
  dayPart?: Activity['dayPart']
  anchorNote?: string
  durationMin?: number
  locationId?: ID
  notes?: string
  description?: string
  cost?: number
  currency?: string
  optional?: boolean
  transportId?: ID
  accommodationId?: ID
  bookingId?: ID
  phone?: string
}

export interface MoveOptions {
  startTime?: string
  timePrecision?: TimePrecision
  dayPart?: Activity['dayPart']
  /** Place directly before/after this activity, adopting sensible ordering. */
  beforeId?: ID
  afterId?: ID
}

/* ------------------------------------------------------------- persistence */

let persistedIds = emptyIdSets()
let persistTimer: ReturnType<typeof setTimeout> | null = null
let applyingRemote = false

function schedulePersist(data: TripData) {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    void persist(data, persistedIds).then((ids) => {
      persistedIds = ids
    })
    if (!applyingRemote) broadcastData(data)
  }, 180)
}

/** Shallow-copy the collection maps. Records are immutable, so this is cheap. */
function snapshot(data: TripData): TripData {
  return {
    trips: { ...data.trips },
    days: { ...data.days },
    activities: { ...data.activities },
    locations: { ...data.locations },
    accommodations: { ...data.accommodations },
    transports: { ...data.transports },
    bookings: { ...data.bookings },
  }
}

const ACTIVE_TRIP_KEY = 'activeTripId'

export const useTripStore = create<TripState>((set, get) => {
  /** Apply a mutation, recording an undo entry and scheduling a write. */
  function commit(label: string, recipe: (draft: TripData) => void) {
    const state = get()
    const before = snapshot(state.data)
    const draft = snapshot(state.data)
    recipe(draft)
    const past = [...state.past, { label, data: before }].slice(-HISTORY_LIMIT)
    set({ data: draft, past, future: [], lastAction: label })
    schedulePersist(draft)
  }

  function nextOrder(data: TripData, tripId: ID, dayId: ID | null): number {
    const siblings = Object.values(data.activities).filter(
      (a) => a.tripId === tripId && a.dayId === dayId,
    )
    return siblings.reduce((max, a) => Math.max(max, a.order), 0) + 10
  }

  return {
    data: emptyData(),
    ready: false,
    activeTripId: null,
    past: [],
    future: [],
    lastAction: null,

    async init() {
      let data = await loadAll()
      if (Object.keys(data.trips).length === 0) {
        // First run: seed from the published plan so every device opens on the
        // same itinerary. The bundled demo is the fallback when there is no
        // published file to fetch (offline, Electron, a fork without one).
        const published = await fetchPublishedTrip()
        if (published) {
          data = published.data
          writeSetting(ADOPTED_REVISION_KEY, published.revision)
        } else {
          data = buildDemoTrip()
        }
      }
      persistedIds = await persist(data, emptyIdSets())
      const stored = readSetting<ID | null>(ACTIVE_TRIP_KEY, null)
      const activeTripId =
        stored && data.trips[stored] ? stored : (Object.keys(data.trips)[0] ?? null)
      set({ data, ready: true, activeTripId })

      onRemoteData((remote) => {
        applyingRemote = true
        set({ data: remote })
        applyingRemote = false
      })

      void get().checkForUpdate()
    },

    publishedUpdate: null,

    async checkForUpdate() {
      const published = await fetchPublishedTrip()
      if (!published) return
      const adopted = readSetting<string | null>(ADOPTED_REVISION_KEY, null)
      set({ publishedUpdate: published.revision === adopted ? null : published.revision })
    },

    async adoptPublished() {
      const published = await fetchPublishedTrip()
      if (!published) return false
      await clearAll()
      persistedIds = await persist(published.data, emptyIdSets())
      const activeTripId = Object.keys(published.data.trips)[0] ?? null
      writeSetting(ACTIVE_TRIP_KEY, activeTripId)
      writeSetting(ADOPTED_REVISION_KEY, published.revision)
      set({
        data: published.data,
        activeTripId,
        past: [],
        future: [],
        lastAction: null,
        publishedUpdate: null,
      })
      broadcastData(published.data)
      return true
    },

    async resetToDemo() {
      await clearAll()
      const data = buildDemoTrip()
      persistedIds = await persist(data, emptyIdSets())
      const activeTripId = Object.keys(data.trips)[0] ?? null
      writeSetting(ACTIVE_TRIP_KEY, activeTripId)
      set({ data, activeTripId, past: [], future: [], lastAction: null })
      broadcastData(data)
    },

    setActiveTrip(tripId) {
      writeSetting(ACTIVE_TRIP_KEY, tripId)
      set({ activeTripId: tripId })
    },

    createTrip(input) {
      const id = newId('trip')
      const stamp = now()
      commit('Create trip', (d) => {
        d.trips[id] = {
          id,
          name: input.name.trim() || 'Untitled trip',
          startDate: input.startDate,
          endDate: input.endDate,
          destinations: input.destinations.filter(Boolean),
          description: input.description,
          coverImage: input.coverImage,
          baseCurrency: input.baseCurrency ?? 'EUR',
          createdAt: stamp,
          updatedAt: stamp,
        }
        for (const date of dateRange(input.startDate, input.endDate)) {
          const dayId = newId('day')
          d.days[dayId] = { id: dayId, tripId: id, date }
        }
      })
      writeSetting(ACTIVE_TRIP_KEY, id)
      set({ activeTripId: id })
      return id
    },

    updateTrip(tripId, patch) {
      commit('Edit trip', (d) => {
        const trip = d.trips[tripId]
        if (!trip) return
        d.trips[tripId] = { ...trip, ...patch, id: tripId, updatedAt: now() }
      })
      if (patch.startDate || patch.endDate) get().syncTripDays(tripId)
    },

    deleteTrip(tripId) {
      commit('Delete trip', (d) => {
        delete d.trips[tripId]
        for (const [key, rows] of [
          ['days', d.days],
          ['activities', d.activities],
          ['locations', d.locations],
          ['accommodations', d.accommodations],
          ['transports', d.transports],
          ['bookings', d.bookings],
        ] as const) {
          void key
          for (const row of Object.values(rows) as { id: ID; tripId: ID }[]) {
            if (row.tripId === tripId) delete (rows as Record<ID, unknown>)[row.id]
          }
        }
      })
      const remaining = Object.keys(get().data.trips)
      const next = remaining[0] ?? null
      writeSetting(ACTIVE_TRIP_KEY, next)
      set({ activeTripId: next })
    },

    syncTripDays(tripId) {
      const trip = get().data.trips[tripId]
      if (!trip) return
      if (daysBetween(trip.startDate, trip.endDate) < 0) return
      commit('Adjust dates', (d) => {
        const wanted = new Set(dateRange(trip.startDate, trip.endDate))
        const existing = Object.values(d.days).filter((day) => day.tripId === tripId)
        const byDate = new Map(existing.map((day) => [day.date, day]))
        for (const date of wanted) {
          if (!byDate.has(date)) {
            const dayId = newId('day')
            d.days[dayId] = { id: dayId, tripId, date }
          }
        }
        for (const day of existing) {
          if (wanted.has(day.date)) continue
          // Dropping a day never deletes its work: activities return to Ideas.
          for (const a of Object.values(d.activities)) {
            if (a.dayId === day.id) {
              d.activities[a.id] = {
                ...a,
                dayId: null,
                timePrecision: 'unscheduled',
                updatedAt: now(),
              }
            }
          }
          delete d.days[day.id]
        }
      })
    },

    updateDay(dayId, patch) {
      commit('Edit day', (d) => {
        const day = d.days[dayId]
        if (!day) return
        d.days[dayId] = { ...day, ...patch, id: dayId }
      })
    },

    addActivity(input) {
      const id = newId('act')
      const stamp = now()
      const dayId = input.dayId ?? null
      commit(dayId ? 'Add activity' : 'Add idea', (d) => {
        d.activities[id] = {
          id,
          tripId: input.tripId,
          dayId,
          order: nextOrder(d, input.tripId, dayId),
          title: input.title.trim() || 'Untitled',
          description: input.description,
          category: input.category ?? 'activity',
          timePrecision: input.timePrecision ?? (dayId ? 'flexible' : 'unscheduled'),
          startTime: input.startTime,
          endTime: input.endTime,
          dayPart: input.dayPart,
          anchorNote: input.anchorNote,
          durationMin: input.durationMin,
          locationId: input.locationId,
          cost: input.cost,
          currency: input.currency,
          bookingId: input.bookingId,
          transportId: input.transportId,
          accommodationId: input.accommodationId,
          phone: input.phone,
          notes: input.notes,
          links: [],
          attachments: [],
          status: 'planned',
          optional: input.optional ?? false,
          createdAt: stamp,
          updatedAt: stamp,
        }
      })
      return id
    },

    updateActivity(id, patch, label = 'Edit activity') {
      commit(label, (d) => {
        const a = d.activities[id]
        if (!a) return
        d.activities[id] = { ...a, ...patch, id, updatedAt: now() }
      })
    },

    deleteActivity(id) {
      commit('Delete activity', (d) => {
        const a = d.activities[id]
        if (!a) return
        if (a.transportId) delete d.transports[a.transportId]
        delete d.activities[id]
      })
    },

    duplicateActivity(id) {
      const source = get().data.activities[id]
      if (!source) return null
      const copy = newId('act')
      const stamp = now()
      commit('Duplicate activity', (d) => {
        let transportId = source.transportId
        if (transportId && d.transports[transportId]) {
          const tId = newId('trn')
          d.transports[tId] = { ...d.transports[transportId], id: tId }
          transportId = tId
        }
        d.activities[copy] = {
          ...source,
          id: copy,
          transportId,
          title: `${source.title} (copy)`,
          order: source.order + 1,
          status: 'planned',
          createdAt: stamp,
          updatedAt: stamp,
        }
      })
      return copy
    },

    moveActivity(id, dayId, opts = {}) {
      commit(dayId ? 'Move activity' : 'Move to ideas', (d) => {
        const a = d.activities[id]
        if (!a) return
        const next: Activity = { ...a, dayId, updatedAt: now() }

        if (dayId === null) {
          next.timePrecision = 'unscheduled'
          next.startTime = undefined
          next.endTime = undefined
          next.dayPart = undefined
        } else {
          if (opts.startTime) {
            const duration =
              a.durationMin ??
              (a.startTime && a.endTime
                ? Math.max(
                    0,
                    Number(a.endTime.slice(0, 2)) * 60 +
                      Number(a.endTime.slice(3)) -
                      (Number(a.startTime.slice(0, 2)) * 60 + Number(a.startTime.slice(3))),
                  )
                : undefined)
            next.startTime = opts.startTime
            next.timePrecision = opts.timePrecision ?? 'exact'
            if (duration && duration > 0) {
              const startMin =
                Number(opts.startTime.slice(0, 2)) * 60 + Number(opts.startTime.slice(3))
              const endMin = startMin + duration
              const h = Math.floor((endMin % 1440) / 60)
              const m = endMin % 60
              next.endTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
              next.durationMin = duration
            }
          } else if (opts.dayPart) {
            next.dayPart = opts.dayPart
            next.timePrecision = 'dayPart'
            next.startTime = undefined
            next.endTime = undefined
          } else if (a.timePrecision === 'unscheduled') {
            next.timePrecision = 'flexible'
          }
        }

        // Ordering relative to a sibling, used by list drops.
        const siblings = Object.values(d.activities)
          .filter((x) => x.dayId === dayId && x.id !== id)
          .sort((x, y) => x.order - y.order)
        const anchorId = opts.beforeId ?? opts.afterId
        if (anchorId) {
          const idx = siblings.findIndex((s) => s.id === anchorId)
          if (idx >= 0) {
            const anchor = siblings[idx]
            const neighbour = opts.beforeId ? siblings[idx - 1] : siblings[idx + 1]
            next.order = neighbour
              ? (anchor.order + neighbour.order) / 2
              : opts.beforeId
                ? anchor.order - 10
                : anchor.order + 10
          }
        } else if (a.dayId !== dayId) {
          next.order = siblings.reduce((max, s) => Math.max(max, s.order), 0) + 10
        }

        d.activities[id] = next
      })
    },

    reorderActivity(id, targetId, position) {
      const target = get().data.activities[targetId]
      if (!target) return
      get().moveActivity(id, target.dayId, {
        [position === 'before' ? 'beforeId' : 'afterId']: targetId,
      } as MoveOptions)
    },

    setActivityStatus(id, status) {
      const label =
        status === 'completed' ? 'Mark complete' : status === 'skipped' ? 'Skip activity' : 'Reopen activity'
      get().updateActivity(id, { status }, label)
    },

    upsertLocation(input) {
      const id = input.id ?? newId('loc')
      commit(input.id ? 'Edit location' : 'Add location', (d) => {
        const prev = d.locations[id]
        d.locations[id] = {
          openingHours: undefined,
          ...prev,
          ...input,
          id,
          tripId: input.tripId,
          name: input.name,
        }
      })
      return id
    },

    deleteLocation(id) {
      commit('Delete location', (d) => {
        delete d.locations[id]
        for (const a of Object.values(d.activities)) {
          if (a.locationId === id) d.activities[a.id] = { ...a, locationId: undefined }
        }
      })
    },

    upsertAccommodation(input) {
      const id = input.id ?? newId('stay')
      commit(input.id ? 'Edit accommodation' : 'Add accommodation', (d) => {
        const prev = d.accommodations[id]
        d.accommodations[id] = { ...prev, ...input, id } as Accommodation
      })
      return id
    },

    deleteAccommodation(id) {
      commit('Delete accommodation', (d) => {
        delete d.accommodations[id]
        for (const a of Object.values(d.activities)) {
          if (a.accommodationId === id) d.activities[a.id] = { ...a, accommodationId: undefined }
        }
      })
    },

    upsertTransport(input) {
      const id = input.id ?? newId('trn')
      commit(input.id ? 'Edit transport' : 'Add transport', (d) => {
        const base: Transport = d.transports[id] ?? {
          id,
          tripId: input.tripId,
          mode: 'train',
          fromLabel: '',
          toLabel: '',
        }
        d.transports[id] = { ...base, ...input, id }
      })
      return id
    },

    upsertBooking(input) {
      const id = input.id ?? newId('bkg')
      commit(input.id ? 'Edit booking' : 'Add booking', (d) => {
        const base: Booking = d.bookings[id] ?? { id, tripId: input.tripId, status: 'confirmed' }
        d.bookings[id] = { ...base, ...input, id }
      })
      return id
    },

    deleteBooking(id) {
      commit('Delete booking', (d) => {
        delete d.bookings[id]
        for (const a of Object.values(d.activities)) {
          if (a.bookingId === id) d.activities[a.id] = { ...a, bookingId: undefined }
        }
        for (const h of Object.values(d.accommodations)) {
          if (h.bookingId === id) d.accommodations[h.id] = { ...h, bookingId: undefined }
        }
      })
    },

    undo() {
      const { past, future, data } = get()
      const entry = past.at(-1)
      if (!entry) return
      set({
        data: entry.data,
        past: past.slice(0, -1),
        future: [...future, { label: entry.label, data: snapshot(data) }].slice(-HISTORY_LIMIT),
        lastAction: null,
      })
      schedulePersist(entry.data)
    },

    redo() {
      const { past, future, data } = get()
      const entry = future.at(-1)
      if (!entry) return
      set({
        data: entry.data,
        future: future.slice(0, -1),
        past: [...past, { label: entry.label, data: snapshot(data) }].slice(-HISTORY_LIMIT),
      })
      schedulePersist(entry.data)
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,
  }
})

/* -------------------------------------------------------------- convenience */

export const useActiveTrip = (): Trip | undefined =>
  useTripStore((s) => (s.activeTripId ? s.data.trips[s.activeTripId] : undefined))

// Derived lists are rebuilt on every read, so they go through `useShallow`:
// element-wise comparison keeps referential churn from re-rendering the tree.
export const useTripDays = (tripId: ID | null): Day[] =>
  useTripStore(useShallow((s) => (tripId ? listDays(s.data, tripId) : EMPTY_DAYS)))

export const useDayActivities = (dayId: ID | null): Activity[] =>
  useTripStore(useShallow((s) => (dayId ? activitiesForDay(s.data, dayId) : EMPTY_ACTIVITIES)))

export const useIdeas = (tripId: ID | null): Activity[] =>
  useTripStore(useShallow((s) => (tripId ? ideasForTrip(s.data, tripId) : EMPTY_ACTIVITIES)))

const EMPTY_DAYS: Day[] = []
const EMPTY_ACTIVITIES: Activity[] = []
