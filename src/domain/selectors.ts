import type {
  Accommodation,
  Activity,
  DateStr,
  Day,
  ID,
  Location,
  TripData,
} from './types'
import { compareActivities, endMinutes, occupiedMinutes, toMinutes, dateRange } from './time'
import { categoryMeta } from './categories'

/* ------------------------------------------------------------- Basics */

export const listDays = (data: TripData, tripId: ID): Day[] =>
  Object.values(data.days)
    .filter((d) => d.tripId === tripId)
    .sort((a, b) => a.date.localeCompare(b.date))

export const dayByDate = (data: TripData, tripId: ID, date: DateStr): Day | undefined =>
  Object.values(data.days).find((d) => d.tripId === tripId && d.date === date)

export const activitiesForDay = (data: TripData, dayId: ID): Activity[] =>
  Object.values(data.activities)
    .filter((a) => a.dayId === dayId)
    .sort(compareActivities)

/** Ideas = activities belonging to the trip but not placed on any day. */
export const ideasForTrip = (data: TripData, tripId: ID): Activity[] =>
  Object.values(data.activities)
    .filter((a) => a.tripId === tripId && a.dayId === null)
    .sort((a, b) => a.order - b.order)

export const activitiesForTrip = (data: TripData, tripId: ID): Activity[] =>
  Object.values(data.activities).filter((a) => a.tripId === tripId)

export const scheduledActivities = (data: TripData, tripId: ID): Activity[] =>
  activitiesForTrip(data, tripId).filter((a) => a.dayId !== null)

export const locationOf = (data: TripData, a: Activity): Location | undefined =>
  a.locationId ? data.locations[a.locationId] : undefined

/** The stay covering a given night. Check-out day is not covered. */
export const accommodationForDate = (
  data: TripData,
  tripId: ID,
  date: DateStr,
): Accommodation | undefined =>
  Object.values(data.accommodations).find(
    (h) => h.tripId === tripId && h.checkInDate <= date && date < h.checkOutDate,
  )

export const accommodationsForTrip = (data: TripData, tripId: ID): Accommodation[] =>
  Object.values(data.accommodations)
    .filter((h) => h.tripId === tripId)
    .sort((a, b) => a.checkInDate.localeCompare(b.checkInDate))

export const bookingsForTrip = (data: TripData, tripId: ID) =>
  Object.values(data.bookings).filter((b) => b.tripId === tripId)

/* ------------------------------------------------------- Day timeline */

export type DaySlot =
  | { kind: 'activity'; activity: Activity }
  | { kind: 'gap'; startMin: number; endMin: number; minutes: number }

/**
 * The day's timeline: activities in order, with explicit free-time gaps
 * between them. Free time is a real part of an itinerary, so it is surfaced
 * rather than left as blank space.
 */
export function buildDayTimeline(activities: Activity[], minGapMinutes = 45): DaySlot[] {
  const slots: DaySlot[] = []
  let cursor: number | undefined

  for (const activity of activities) {
    const start = toMinutes(activity.startTime)
    if (
      cursor !== undefined &&
      start !== undefined &&
      start - cursor >= minGapMinutes &&
      activity.category !== 'freeTime'
    ) {
      slots.push({ kind: 'gap', startMin: cursor, endMin: start, minutes: start - cursor })
    }
    slots.push({ kind: 'activity', activity })
    const end = endMinutes(activity)
    if (end !== undefined) cursor = Math.max(cursor ?? end, end)
  }
  return slots
}

/** A long-haul leg is time spent travelling, not a packed day. */
const LONG_HAUL_MIN = 6 * 60

/**
 * Total scheduled minutes for a day — drives the overplanning warning.
 * Free time is not load, and neither is an overnight flight.
 */
export const dayLoadMinutes = (activities: Activity[]): number =>
  activities
    .filter((a) => a.status !== 'skipped' && a.category !== 'freeTime')
    .filter(
      (a) => !(categoryMeta(a.category).isTransport && occupiedMinutes(a) >= LONG_HAUL_MIN),
    )
    .reduce((sum, a) => sum + occupiedMinutes(a), 0)

/* ------------------------------------------------------------- Geo */

/** Great-circle distance in kilometres. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Rough travel time estimate, deliberately conservative and city-scaled. */
export function estimatedTravelMinutes(km: number): number {
  if (km < 1) return Math.round(km * 13) // walking
  if (km < 12) return Math.round(10 + km * 3.2) // urban transit
  if (km < 120) return Math.round(20 + km * 1.3) // regional
  return Math.round(60 + km * 0.35) // long distance
}

/* ----------------------------------------------------------- Stats */

/**
 * A day labelled "Tokyo → Kyoto" is a travel day: you wake in the first place
 * and sleep in the second, so the night belongs to the destination.
 */
function sleepingPlace(label?: string): string | undefined {
  if (!label) return undefined
  const destination = label.split(/→|->/).pop()?.trim()
  return destination || undefined
}

export interface TripStats {
  totalDays: number
  plannedDays: number
  activityCount: number
  bookingCount: number
  transportCount: number
  accommodationCount: number
  ideaCount: number
  estimatedCost: number
  nightsByPlace: { place: string; nights: number }[]
  optionalCount: number
  completedCount: number
}

export function computeTripStats(data: TripData, tripId: ID): TripStats {
  const trip = data.trips[tripId]
  const days = listDays(data, tripId)
  const all = activitiesForTrip(data, tripId)
  const scheduled = all.filter((a) => a.dayId !== null)

  // A day of nothing but free time is deliberately unplanned, not planned.
  const plannedDays = days.filter(
    (d) => !!d.headline || scheduled.some((a) => a.dayId === d.id && a.category !== 'freeTime'),
  ).length

  const nights = new Map<string, number>()
  if (trip) {
    for (const date of dateRange(trip.startDate, trip.endDate)) {
      if (date === trip.endDate) continue // final day is a departure, not a night
      const day = days.find((d) => d.date === date)
      const place =
        sleepingPlace(day?.locationLabel) ??
        accommodationForDate(data, tripId, date)?.name ??
        'Unassigned'
      nights.set(place, (nights.get(place) ?? 0) + 1)
    }
  }

  return {
    totalDays: days.length,
    plannedDays,
    activityCount: scheduled.length,
    bookingCount: bookingsForTrip(data, tripId).length,
    transportCount: scheduled.filter((a) => categoryMeta(a.category).isTransport).length,
    accommodationCount: accommodationsForTrip(data, tripId).length,
    ideaCount: all.length - scheduled.length,
    estimatedCost: all
      .filter((a) => a.status !== 'skipped')
      .reduce((s, a) => s + (a.cost ?? 0), 0) +
      accommodationsForTrip(data, tripId).reduce((s, h) => s + (h.cost ?? 0), 0),
    nightsByPlace: [...nights.entries()]
      .map(([place, n]) => ({ place, nights: n }))
      .sort((a, b) => b.nights - a.nights),
    optionalCount: scheduled.filter((a) => a.optional).length,
    completedCount: scheduled.filter((a) => a.status === 'completed').length,
  }
}
