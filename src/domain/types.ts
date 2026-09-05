/**
 * Atlas domain model.
 *
 * Everything the app shows is derived from these entities. Views (weekly,
 * daily, map, travel mode, dashboard) are projections — they never own or
 * duplicate itinerary data.
 *
 * Storage is normalised: each collection lives in its own object store, keyed
 * by id, so a trip is never a single opaque blob.
 */

export type ID = string

/** Calendar date, `YYYY-MM-DD`, always local to the trip (never UTC-shifted). */
export type DateStr = string
/** Wall-clock time of day, `HH:MM`, 24h. */
export type TimeStr = string
export type ISOStamp = string

/* ------------------------------------------------------------------ Trip */

export interface Trip {
  id: ID
  name: string
  startDate: DateStr
  endDate: DateStr
  /** Ordered list of places the trip passes through, for the header + stats. */
  destinations: string[]
  description?: string
  /** Either a remote/data URL, or an `atlas:<token>` generated cover. */
  coverImage?: string
  baseCurrency: string
  createdAt: ISOStamp
  updatedAt: ISOStamp
}

/* ------------------------------------------------------------------- Day */

/**
 * One calendar day of a trip. Days are materialised (not derived on the fly)
 * because they carry planning data of their own: which city you are in and the
 * one-line headline shown in the weekly view.
 */
export interface Day {
  id: ID
  tripId: ID
  date: DateStr
  /** City / region for this day — the weekly view's second line. */
  locationLabel?: string
  /** Short headline, e.g. "Temple day". Kept deliberately concise. */
  headline?: string
  notes?: string
}

/* -------------------------------------------------------------- Location */

/** A place. Multiple activities may share one location. */
export interface Location {
  id: ID
  tripId: ID
  name: string
  address?: string
  lat?: number
  lng?: number
  phone?: string
  url?: string
  /** Optional opening hours, keyed 0=Sunday..6=Saturday. Enables the closed-time check. */
  openingHours?: OpeningHours
}

export interface OpeningHours {
  /** `null` means closed that day. */
  [weekday: number]: { open: TimeStr; close: TimeStr } | null
}

/* -------------------------------------------------------------- Activity */

export const ACTIVITY_CATEGORIES = [
  'flight',
  'train',
  'driving',
  'transport',
  'accommodation',
  'food',
  'beach',
  'nature',
  'culture',
  'museum',
  'shopping',
  'event',
  'walking',
  'activity',
  'freeTime',
  'other',
] as const
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number]

/**
 * How precisely an activity is placed in the day. Not everything needs a clock
 * time — approximate, part-of-day, relative and flexible are first-class.
 */
export type TimePrecision =
  | 'exact' // 09:30–10:30
  | 'approximate' // ~10:00
  | 'dayPart' // Morning
  | 'relative' // After lunch
  | 'flexible' // sometime today
  | 'unscheduled' // not on a day at all (an idea)

export type DayPart = 'morning' | 'afternoon' | 'evening'

export type ActivityStatus = 'planned' | 'completed' | 'skipped'

export interface Link {
  id: ID
  label: string
  url: string
}

export interface Attachment {
  id: ID
  name: string
  /** Data URL or file reference. Kept small; large files are out of scope. */
  href: string
  kind: 'image' | 'document' | 'link'
}

/**
 * The fundamental itinerary entity.
 *
 * An activity with `dayId === null` is an *idea*: saved, not yet scheduled.
 * Transport and accommodation stays are activities too — they carry a
 * `transportId` / `accommodationId` pointing at their structured detail, so
 * placement (day, time, order, status) lives in exactly one place.
 */
export interface Activity {
  id: ID
  tripId: ID
  dayId: ID | null
  /** Manual ordering within a day (or within the ideas inbox). */
  order: number

  title: string
  description?: string
  category: ActivityCategory

  timePrecision: TimePrecision
  startTime?: TimeStr
  endTime?: TimeStr
  dayPart?: DayPart
  /** Free-text anchor for `relative` timing, e.g. "After lunch". */
  anchorNote?: string
  /** Minutes. Used when there is no end time, and for load calculations. */
  durationMin?: number

  locationId?: ID
  cost?: number
  currency?: string

  bookingId?: ID
  transportId?: ID
  accommodationId?: ID

  phone?: string
  notes?: string
  links: Link[]
  attachments: Attachment[]

  status: ActivityStatus
  /** Optional = "if we have time / if the weather holds". */
  optional: boolean

  createdAt: ISOStamp
  updatedAt: ISOStamp
}

/* ------------------------------------------------------------- Transport */

export const TRANSPORT_MODES = [
  'flight',
  'train',
  'bus',
  'car',
  'rentalCar',
  'ferry',
  'walking',
  'publicTransport',
  'other',
] as const
export type TransportMode = (typeof TRANSPORT_MODES)[number]

/**
 * Transport-specific detail for an activity. Times and day placement are NOT
 * repeated here — they live on the owning activity.
 */
export interface Transport {
  id: ID
  tripId: ID
  mode: TransportMode
  fromLabel: string
  toLabel: string
  fromLocationId?: ID
  toLocationId?: ID
  carrier?: string
  /** Flight number, train name/number, line, etc. */
  vehicleNumber?: string
  seat?: string
  /** Platform, gate or pier. */
  platform?: string
  terminal?: string
  notes?: string
}

/* --------------------------------------------------------- Accommodation */

export interface Accommodation {
  id: ID
  tripId: ID
  name: string
  locationId?: ID
  address?: string
  phone?: string
  checkInDate: DateStr
  checkInTime?: TimeStr
  checkOutDate: DateStr
  checkOutTime?: TimeStr
  cost?: number
  currency?: string
  bookingId?: ID
  url?: string
  notes?: string
}

/* --------------------------------------------------------------- Booking */

export type BookingStatus = 'confirmed' | 'pending' | 'cancelled'

/**
 * A reservation. Referenced by whatever it books (activity, accommodation) so
 * the Bookings view can list every reference in one place.
 */
export interface Booking {
  id: ID
  tripId: ID
  reference?: string
  provider?: string
  url?: string
  cost?: number
  currency?: string
  status: BookingStatus
  notes?: string
}

/* ------------------------------------------------------------ Collection */

/** The full normalised dataset held in memory and mirrored to IndexedDB. */
export interface TripData {
  trips: Record<ID, Trip>
  days: Record<ID, Day>
  activities: Record<ID, Activity>
  locations: Record<ID, Location>
  accommodations: Record<ID, Accommodation>
  transports: Record<ID, Transport>
  bookings: Record<ID, Booking>
}

export const COLLECTIONS = [
  'trips',
  'days',
  'activities',
  'locations',
  'accommodations',
  'transports',
  'bookings',
] as const
export type CollectionName = (typeof COLLECTIONS)[number]

export const emptyData = (): TripData => ({
  trips: {},
  days: {},
  activities: {},
  locations: {},
  accommodations: {},
  transports: {},
  bookings: {},
})
