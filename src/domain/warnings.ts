import type { Activity, DateStr, ID, TripData } from './types'
import {
  accommodationForDate,
  activitiesForDay,
  dayLoadMinutes,
  estimatedTravelMinutes,
  haversineKm,
  listDays,
} from './selectors'
import { endMinutes, formatDuration, parseDate, toMinutes } from './time'
import { categoryMeta } from './categories'

export type WarningSeverity = 'warning' | 'info'

export type WarningCode =
  | 'tightConnection'
  | 'travelTime'
  | 'farApart'
  | 'closed'
  | 'overplanned'
  | 'noAccommodation'
  | 'overlap'
  | 'emptyDay'

export interface Warning {
  id: string
  code: WarningCode
  severity: WarningSeverity
  message: string
  detail?: string
  dayId?: ID
  date?: DateStr
  activityIds: ID[]
}

export interface WarningThresholds {
  /** Below this many minutes between activities, flag a tight connection. */
  tightConnectionMin: number
  /** Above this many km between consecutive same-day activities, flag distance. */
  farApartKm: number
  /** Above this many scheduled minutes in a day, flag overplanning. */
  overplannedMin: number
}

export const DEFAULT_THRESHOLDS: WarningThresholds = {
  tightConnectionMin: 15,
  farApartKm: 30,
  overplannedMin: 10 * 60,
}

const timed = (a: Activity) =>
  (a.timePrecision === 'exact' || a.timePrecision === 'approximate') &&
  toMinutes(a.startTime) !== undefined

const q = (s: string) => '“' + s + '”'

/**
 * Rule engine. Warnings are advisory only - nothing here ever mutates the
 * itinerary. The user stays in control; we just point at things.
 */
export function computeWarnings(
  data: TripData,
  tripId: ID,
  thresholds: WarningThresholds = DEFAULT_THRESHOLDS,
): Warning[] {
  const trip = data.trips[tripId]
  if (!trip) return []
  const out: Warning[] = []
  const days = listDays(data, tripId)

  for (const day of days) {
    const acts = activitiesForDay(data, day.id).filter((a) => a.status !== 'skipped')
    const scheduled = acts.filter(timed)

    /* ---- pairwise checks between consecutive timed activities ---- */
    for (let i = 0; i < scheduled.length - 1; i++) {
      const a = scheduled[i]
      const b = scheduled[i + 1]
      const aEnd = endMinutes(a)
      const bStart = toMinutes(b.startTime)
      if (aEnd === undefined || bStart === undefined) continue

      const gap = bStart - aEnd

      if (gap < 0) {
        out.push({
          id: `overlap:${a.id}:${b.id}`,
          code: 'overlap',
          severity: 'warning',
          message: `${q(a.title)} overlaps ${q(b.title)} by ${formatDuration(-gap)}.`,
          dayId: day.id,
          date: day.date,
          activityIds: [a.id, b.id],
        })
        continue
      }

      const la = a.locationId ? data.locations[a.locationId] : undefined
      const lb = b.locationId ? data.locations[b.locationId] : undefined
      // A transport activity *is* the journey, so don't charge for it twice.
      const isJourney =
        categoryMeta(a.category).isTransport || categoryMeta(b.category).isTransport
      const sameSpot = Boolean(a.locationId) && a.locationId === b.locationId

      let distanceFlagged = false
      if (!isJourney && la?.lat != null && la.lng != null && lb?.lat != null && lb.lng != null) {
        const km = haversineKm({ lat: la.lat, lng: la.lng }, { lat: lb.lat, lng: lb.lng })
        if (km >= thresholds.farApartKm) {
          distanceFlagged = true
          out.push({
            id: `far:${a.id}:${b.id}`,
            code: 'farApart',
            severity: 'warning',
            message: `${q(a.title)} and ${q(b.title)} are ${Math.round(km)} km apart.`,
            detail: 'Consider splitting these across days, or adding transport between them.',
            dayId: day.id,
            date: day.date,
            activityIds: [a.id, b.id],
          })
        } else {
          const need = estimatedTravelMinutes(km)
          if (km > 0.4 && need > gap + 5) {
            distanceFlagged = true
            out.push({
              id: `travel:${a.id}:${b.id}`,
              code: 'travelTime',
              severity: 'warning',
              message: `${q(b.title)} starts before the journey from ${q(a.title)} allows.`,
              detail: `About ${formatDuration(need)} of travel (${km.toFixed(1)} km) but only ${formatDuration(gap)} available.`,
              dayId: day.id,
              date: day.date,
              activityIds: [a.id, b.id],
            })
          }
        }
      }

      // Only complain about a short gap when nothing more specific already has,
      // and when the gap actually has to absorb something: free time is a
      // buffer by definition, and staying put needs no turnaround at all.
      const worthFlagging =
        !distanceFlagged &&
        !sameSpot &&
        a.category !== 'freeTime' &&
        b.category !== 'freeTime' &&
        !a.optional &&
        !b.optional
      if (worthFlagging && gap < thresholds.tightConnectionMin) {
        out.push({
          id: `tight:${a.id}:${b.id}`,
          code: 'tightConnection',
          severity: 'warning',
          message: `Only ${gap} minutes between ${q(a.title)} and ${q(b.title)}.`,
          dayId: day.id,
          date: day.date,
          activityIds: [a.id, b.id],
        })
      }
    }

    /* ---- opening hours ---- */
    const weekday = parseDate(day.date).getDay()
    for (const a of scheduled) {
      const loc = a.locationId ? data.locations[a.locationId] : undefined
      const hours = loc?.openingHours?.[weekday]
      const start = toMinutes(a.startTime)
      if (hours === undefined || start === undefined) continue
      if (hours === null) {
        out.push({
          id: `closed:${a.id}`,
          code: 'closed',
          severity: 'warning',
          message: `${loc?.name ?? a.title} may be closed on this day.`,
          dayId: day.id,
          date: day.date,
          activityIds: [a.id],
        })
        continue
      }
      const open = toMinutes(hours.open)
      const close = toMinutes(hours.close)
      const end = endMinutes(a) ?? start
      if (open !== undefined && close !== undefined && (start < open || end > close)) {
        out.push({
          id: `closed:${a.id}`,
          code: 'closed',
          severity: 'warning',
          message: `${loc?.name ?? a.title} may be closed at the planned time.`,
          detail: `Opening hours ${hours.open}-${hours.close}.`,
          dayId: day.id,
          date: day.date,
          activityIds: [a.id],
        })
      }
    }

    /* ---- overplanning ---- */
    const load = dayLoadMinutes(acts)
    if (load > thresholds.overplannedMin) {
      out.push({
        id: `load:${day.id}`,
        code: 'overplanned',
        severity: 'warning',
        message: `This day contains ${formatDuration(load)} of scheduled activities.`,
        dayId: day.id,
        date: day.date,
        activityIds: [],
      })
    }

    /* ---- empty day ---- */
    if (acts.length === 0 && !day.headline) {
      out.push({
        id: `empty:${day.id}`,
        code: 'emptyDay',
        severity: 'info',
        message: 'Nothing planned yet for this day.',
        dayId: day.id,
        date: day.date,
        activityIds: [],
      })
    }

    /* ---- accommodation ---- */
    const isLastDay = day.date === trip.endDate
    const overnightTransport = acts.some(
      (a) => categoryMeta(a.category).isTransport && (a.durationMin ?? 0) >= 6 * 60,
    )
    if (!isLastDay && !overnightTransport && !accommodationForDate(data, tripId, day.date)) {
      out.push({
        id: `stay:${day.id}`,
        code: 'noAccommodation',
        severity: 'warning',
        message: 'No accommodation assigned for this night.',
        dayId: day.id,
        date: day.date,
        activityIds: [],
      })
    }
  }

  return out
}

export function groupWarningsByDay(warnings: Warning[]): Map<ID, Warning[]> {
  const map = new Map<ID, Warning[]>()
  for (const w of warnings) {
    if (!w.dayId) continue
    const list = map.get(w.dayId) ?? []
    list.push(w)
    map.set(w.dayId, list)
  }
  return map
}

export function warningsForActivity(warnings: Warning[], activityId: ID): Warning[] {
  return warnings.filter((w) => w.activityIds.includes(activityId))
}
