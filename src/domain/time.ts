import type { Activity, DateStr, DayPart, TimeStr } from './types'

/** Anchor minute used to sort part-of-day activities among timed ones. */
export const DAY_PART_ANCHOR: Record<DayPart, number> = {
  morning: 9 * 60,
  afternoon: 13 * 60 + 30,
  evening: 18 * 60 + 30,
}

export const DAY_PART_RANGE: Record<DayPart, [number, number]> = {
  morning: [6 * 60, 12 * 60],
  afternoon: [12 * 60, 17 * 60],
  evening: [17 * 60, 23 * 60],
}

export function toMinutes(t?: TimeStr): number | undefined {
  if (!t) return undefined
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim())
  if (!m) return undefined
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return undefined
  return h * 60 + min
}

export function fromMinutes(total: number): TimeStr {
  const wrapped = ((total % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Snap a minute value to the nearest `step` (used by drag-to-time). */
export function snapMinutes(total: number, step = 15): number {
  return Math.round(total / step) * step
}

/* ------------------------------------------------------------ Ordering */

/**
 * Minute-of-day used to order an activity within its day. Activities without
 * any time sink to the bottom but keep their manual order.
 */
export function sortMinutes(a: Activity): number {
  const exact = toMinutes(a.startTime)
  if (exact !== undefined) return exact
  if (a.timePrecision === 'dayPart' && a.dayPart) return DAY_PART_ANCHOR[a.dayPart]
  return Number.POSITIVE_INFINITY
}

/** More specific timings sort first when two activities land on the same minute. */
const PRECISION_RANK: Record<Activity['timePrecision'], number> = {
  exact: 0,
  approximate: 1,
  dayPart: 2,
  relative: 3,
  flexible: 4,
  unscheduled: 5,
}

export function compareActivities(a: Activity, b: Activity): number {
  const am = sortMinutes(a)
  const bm = sortMinutes(b)
  if (am !== bm) return am - bm
  const rank = PRECISION_RANK[a.timePrecision] - PRECISION_RANK[b.timePrecision]
  if (rank !== 0) return rank
  return a.order - b.order
}

/** Effective end of an activity in minutes, if it can be determined. */
export function endMinutes(a: Activity): number | undefined {
  const end = toMinutes(a.endTime)
  if (end !== undefined) return end
  const start = toMinutes(a.startTime)
  if (start !== undefined && a.durationMin) return start + a.durationMin
  return start
}

/** Scheduled minutes an activity consumes, for the overplanning check. */
export function occupiedMinutes(a: Activity): number {
  const start = toMinutes(a.startTime)
  const end = toMinutes(a.endTime)
  if (start !== undefined && end !== undefined && end > start) return end - start
  if (a.durationMin) return a.durationMin
  return 0
}

/* ------------------------------------------------------------ Formatting */

export function formatTimeRange(a: Activity): string {
  switch (a.timePrecision) {
    case 'exact':
      return a.endTime ? `${a.startTime}–${a.endTime}` : (a.startTime ?? '')
    case 'approximate':
      return a.startTime ? `~${a.startTime}` : 'Approximate'
    case 'dayPart':
      return a.dayPart ? capitalise(a.dayPart) : 'Sometime'
    case 'relative':
      return a.anchorNote || 'Relative'
    case 'flexible':
      return 'Flexible'
    case 'unscheduled':
      return 'Unscheduled'
  }
}

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

export const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/* ------------------------------------------------------------ Calendar */

/** Parse `YYYY-MM-DD` into a *local* Date at midnight (no timezone drift). */
export function parseDate(date: DateStr): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function formatDate(d: Date): DateStr {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDays(date: DateStr, days: number): DateStr {
  const d = parseDate(date)
  d.setDate(d.getDate() + days)
  return formatDate(d)
}

export function daysBetween(from: DateStr, to: DateStr): number {
  const a = parseDate(from).getTime()
  const b = parseDate(to).getTime()
  return Math.round((b - a) / 86_400_000)
}

export function dateRange(start: DateStr, end: DateStr): DateStr[] {
  const out: DateStr[] = []
  const total = Math.max(0, daysBetween(start, end))
  for (let i = 0; i <= total; i++) out.push(addDays(start, i))
  return out
}

export function todayStr(): DateStr {
  return formatDate(new Date())
}

export function nowMinutes(): number {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const weekdayLong = (date: DateStr) => WEEKDAYS[parseDate(date).getDay()]
export const weekdayShort = (date: DateStr) => WEEKDAYS[parseDate(date).getDay()].slice(0, 3)
export const monthShort = (date: DateStr) => MONTHS[parseDate(date).getMonth()]
export const dayOfMonth = (date: DateStr) => parseDate(date).getDate()

/** e.g. "12 Mar" */
export const formatShortDate = (date: DateStr) => `${dayOfMonth(date)} ${monthShort(date)}`

/** e.g. "12 Mar – 26 Mar 2027" */
export function formatDateSpan(start: DateStr, end: DateStr): string {
  const year = parseDate(end).getFullYear()
  return `${formatShortDate(start)} – ${formatShortDate(end)} ${year}`
}
