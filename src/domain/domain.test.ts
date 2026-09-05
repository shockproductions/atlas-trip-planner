import { describe, expect, it } from 'vitest'
import {
  addDays,
  compareActivities,
  dateRange,
  daysBetween,
  endMinutes,
  formatTimeRange,
  fromMinutes,
  occupiedMinutes,
  sortMinutes,
  toMinutes,
} from './time'
import {
  accommodationForDate,
  activitiesForDay,
  buildDayTimeline,
  dayLoadMinutes,
  computeTripStats,
  estimatedTravelMinutes,
  haversineKm,
  ideasForTrip,
} from './selectors'
import { computeWarnings } from './warnings'
import { buildDemoTrip } from '@/data/demo'
import type { Activity } from './types'

const activity = (patch: Partial<Activity> = {}): Activity => ({
  id: patch.id ?? 'a1',
  tripId: 't1',
  dayId: 'd1',
  order: 0,
  title: 'Thing',
  category: 'activity',
  timePrecision: 'exact',
  links: [],
  attachments: [],
  status: 'planned',
  optional: false,
  createdAt: '',
  updatedAt: '',
  ...patch,
})

describe('time', () => {
  it('parses and formats clock times', () => {
    expect(toMinutes('09:30')).toBe(570)
    expect(toMinutes('24:00')).toBeUndefined()
    expect(toMinutes('09:60')).toBeUndefined()
    expect(toMinutes('nonsense')).toBeUndefined()
    expect(fromMinutes(570)).toBe('09:30')
    expect(fromMinutes(1500)).toBe('01:00') // wraps past midnight
  })

  it('walks dates without timezone drift', () => {
    expect(addDays('2027-03-12', 3)).toBe('2027-03-15')
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01')
    expect(daysBetween('2027-03-12', '2027-03-25')).toBe(13)
    expect(dateRange('2027-03-12', '2027-03-14')).toEqual([
      '2027-03-12',
      '2027-03-13',
      '2027-03-14',
    ])
  })

  it('orders timed activities before untimed ones, keeping manual order', () => {
    const nine = activity({ id: 'a', startTime: '09:00' })
    const noon = activity({ id: 'b', startTime: '12:00' })
    const morning = activity({ id: 'c', timePrecision: 'dayPart', dayPart: 'morning' })
    const loose = activity({ id: 'd', timePrecision: 'flexible', order: 5 })
    const looser = activity({ id: 'e', timePrecision: 'flexible', order: 9 })

    const sorted = [looser, loose, noon, morning, nine].sort(compareActivities).map((a) => a.id)
    expect(sorted).toEqual(['a', 'c', 'b', 'd', 'e'])
    expect(sortMinutes(loose)).toBe(Number.POSITIVE_INFINITY)
  })

  it('derives end times from duration when no end is set', () => {
    expect(endMinutes(activity({ startTime: '09:00', durationMin: 90 }))).toBe(630)
    expect(endMinutes(activity({ startTime: '09:00', endTime: '10:00' }))).toBe(600)
    expect(occupiedMinutes(activity({ startTime: '09:00', endTime: '10:30' }))).toBe(90)
    expect(occupiedMinutes(activity({ timePrecision: 'flexible', durationMin: 45 }))).toBe(45)
  })

  it('describes every timing style', () => {
    expect(formatTimeRange(activity({ startTime: '09:00', endTime: '10:00' }))).toBe('09:00–10:00')
    expect(formatTimeRange(activity({ timePrecision: 'approximate', startTime: '10:00' }))).toBe('~10:00')
    expect(formatTimeRange(activity({ timePrecision: 'dayPart', dayPart: 'evening' }))).toBe('Evening')
    expect(
      formatTimeRange(activity({ timePrecision: 'relative', anchorNote: 'After lunch' })),
    ).toBe('After lunch')
    expect(formatTimeRange(activity({ timePrecision: 'flexible' }))).toBe('Flexible')
  })
})

describe('day timeline', () => {
  it('inserts explicit free time between distant activities', () => {
    const slots = buildDayTimeline([
      activity({ id: 'a', startTime: '09:00', endTime: '12:00' }),
      activity({ id: 'b', startTime: '17:00', endTime: '18:00' }),
    ])
    expect(slots.map((s) => s.kind)).toEqual(['activity', 'gap', 'activity'])
    const gap = slots[1]
    expect(gap.kind === 'gap' && gap.minutes).toBe(300)
  })

  it('leaves short turnarounds alone', () => {
    const slots = buildDayTimeline([
      activity({ id: 'a', startTime: '09:00', endTime: '12:00' }),
      activity({ id: 'b', startTime: '12:20', endTime: '13:00' }),
    ])
    expect(slots.every((s) => s.kind === 'activity')).toBe(true)
  })

  it('excludes skipped and free-time entries from the day load', () => {
    const load = dayLoadMinutes([
      activity({ id: 'a', startTime: '09:00', endTime: '11:00' }),
      activity({ id: 'b', startTime: '11:00', endTime: '13:00', status: 'skipped' }),
      activity({ id: 'c', startTime: '13:00', endTime: '18:00', category: 'freeTime' }),
    ])
    expect(load).toBe(120)
  })
})

describe('geo', () => {
  it('measures distance between real places', () => {
    // Tokyo Station → Kyoto Station is about 370 km as the crow flies.
    const km = haversineKm({ lat: 35.6812, lng: 139.7671 }, { lat: 34.9858, lng: 135.7588 })
    expect(km).toBeGreaterThan(350)
    expect(km).toBeLessThan(390)
  })

  it('scales travel estimates by distance', () => {
    expect(estimatedTravelMinutes(0.5)).toBeLessThan(10)
    expect(estimatedTravelMinutes(5)).toBeGreaterThan(estimatedTravelMinutes(0.5))
    expect(estimatedTravelMinutes(300)).toBeGreaterThan(estimatedTravelMinutes(5))
  })
})

describe('demo trip', () => {
  const data = buildDemoTrip()
  const tripId = Object.keys(data.trips)[0]

  it('builds a coherent 14-day trip', () => {
    expect(Object.keys(data.days)).toHaveLength(14)
    expect(Object.keys(data.activities).length).toBeGreaterThan(40)
    expect(Object.keys(data.accommodations)).toHaveLength(4)
    expect(Object.keys(data.transports).length).toBeGreaterThan(6)
  })

  it('parks unscheduled ideas outside the itinerary', () => {
    const ideas = ideasForTrip(data, tripId)
    expect(ideas.length).toBeGreaterThan(3)
    expect(ideas.every((i) => i.dayId === null)).toBe(true)
    expect(ideas.every((i) => i.timePrecision === 'unscheduled')).toBe(true)
  })

  it('resolves the stay covering each night, and none on check-out day', () => {
    expect(accommodationForDate(data, tripId, '2027-03-13')?.name).toBe('Hotel Kaigan Shinjuku')
    expect(accommodationForDate(data, tripId, '2027-03-16')?.name).toBe('Ryokan Sanjo')
    // Second Osaka night is deliberately unbooked in the demo.
    expect(accommodationForDate(data, tripId, '2027-03-20')).toBeUndefined()
  })

  it('keeps activity order stable within a day', () => {
    const day = Object.values(data.days).find((d) => d.date === '2027-03-17')!
    const titles = activitiesForDay(data, day.id).map((a) => a.title)
    expect(titles[0]).toBe('Fushimi Inari')
    expect(titles.at(-1)).toBe('Kaiseki dinner')
  })

  it('counts a travel night at the destination, not the route', () => {
    const stats = computeTripStats(data, tripId)
    const places = Object.fromEntries(stats.nightsByPlace.map((n) => [n.place, n.nights]))
    // "Tokyo → Kyoto" is a travel day; that night is spent in Kyoto.
    expect(places['Tokyo → Kyoto']).toBeUndefined()
    expect(places.Tokyo).toBe(4)
    expect(places.Kyoto).toBe(4)
    expect(places.Okinawa).toBe(4)
    expect(Object.values(places).reduce((a, b) => a + b, 0)).toBe(13)
  })

  it('reports statistics that match the data', () => {
    const stats = computeTripStats(data, tripId)
    expect(stats.totalDays).toBe(14)
    expect(stats.plannedDays).toBe(13) // one day left deliberately open
    expect(stats.accommodationCount).toBe(4)
    expect(stats.nightsByPlace.length).toBeGreaterThan(1)
  })
})

describe('warnings', () => {
  const data = buildDemoTrip()
  const tripId = Object.keys(data.trips)[0]
  const warnings = computeWarnings(data, tripId)

  it('finds the demo trip’s planted problems', () => {
    const codes = new Set(warnings.map((w) => w.code))
    expect(codes.has('noAccommodation')).toBe(true)
    expect(codes.has('closed')).toBe(true)
    expect(codes.has('tightConnection')).toBe(true)
  })

  it('flags the museum booked on its closing day', () => {
    const closed = warnings.find(
      (w) => w.code === 'closed' && w.message.includes('Tokyo National Museum'),
    )
    expect(closed).toBeDefined()
    expect(closed?.date).toBe('2027-03-15')
    // One warning per activity, not one per rule pass.
    expect(warnings.filter((w) => w.id === closed!.id)).toHaveLength(1)
  })

  it('stays quiet about back-to-back activities in the same place', () => {
    // Fushimi Inari runs to 12:00 and lunch starts at 12:00, at the same spot.
    const noise = warnings.filter(
      (w) => w.code === 'tightConnection' && w.message.includes('Fushimi Inari'),
    )
    expect(noise).toEqual([])
  })

  it('does not count an overnight flight as an overplanned day', () => {
    // The inbound leg is 11h25 in the air; that is travel, not a packed day.
    expect(warnings.some((w) => w.code === 'overplanned' && w.date === '2027-03-12')).toBe(false)
    // The Kyoto-to-Osaka day genuinely is too full, and still reports.
    expect(warnings.some((w) => w.code === 'overplanned' && w.date === '2027-03-19')).toBe(true)
  })

  it('prefers the travel-time explanation over a bare tight connection', () => {
    const pair = warnings.filter((w) => w.message.includes('Sensō-ji'))
    expect(pair).toHaveLength(1)
    expect(pair[0].code).toBe('travelTime')
    expect(pair[0].detail).toMatch(/km/)
  })

  it('flags exactly the unbooked night', () => {
    const nights = warnings.filter((w) => w.code === 'noAccommodation').map((w) => w.date)
    expect(nights).toEqual(['2027-03-20'])
  })

  it('detects an overlap and never mutates the itinerary', () => {
    const before = JSON.stringify(data)
    const day = Object.values(data.days).find((d) => d.date === '2027-03-13')!
    const [first] = activitiesForDay(data, day.id)
    const clash = activity({
      id: 'clash',
      dayId: day.id,
      startTime: first.startTime,
      endTime: '23:00',
      title: 'Clashing thing',
    })
    const withClash = { ...data, activities: { ...data.activities, clash } }
    const result = computeWarnings(withClash, tripId)
    expect(result.some((w) => w.code === 'overlap')).toBe(true)
    expect(JSON.stringify(data)).toBe(before)
  })

  it('does not flag distance across a transport leg', () => {
    // Tokyo → Kyoto is 370 km but happens on a train, so it is not "far apart".
    const travelDay = Object.values(data.days).find((d) => d.date === '2027-03-16')!
    const dayWarnings = warnings.filter((w) => w.dayId === travelDay.id)
    expect(dayWarnings.some((w) => w.code === 'farApart')).toBe(false)
  })
})
