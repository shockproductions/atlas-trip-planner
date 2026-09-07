/**
 * Guards the published itinerary.
 *
 * This runs on every pull request, so a proposal that corrupts the trip file —
 * bad JSON, a dangling reference, an activity on a day that does not exist —
 * fails its check before anyone is asked to accept it. The point of an approval
 * gate is that what arrives at it is already known to be well-formed.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import type { TripData } from '@/domain/types'
import { COLLECTIONS } from '@/domain/types'
import { computeWarnings } from '@/domain/warnings'
import { listDays, tripSubset } from '@/domain/selectors'
import { dateRange } from '@/domain/time'
import { revisionOf } from '@/data/published'

const RAW = readFileSync('public/trips/sydney-2026.json', 'utf8')
const data = JSON.parse(RAW) as TripData

describe('the published trip', () => {
  it('has every collection', () => {
    for (const name of COLLECTIONS) {
      expect(data[name], `missing collection: ${name}`).toBeTypeOf('object')
    }
  })

  it('holds exactly one trip', () => {
    expect(Object.keys(data.trips)).toHaveLength(1)
  })

  const tripId = Object.keys(data.trips)[0]

  it('materialises one day per date in the range', () => {
    const trip = data.trips[tripId]
    const expected = dateRange(trip.startDate, trip.endDate)
    const dates = listDays(data, tripId).map((d) => d.date)
    expect(dates).toEqual(expected)
  })

  it('has no dangling references', () => {
    const dangling: string[] = []
    for (const a of Object.values(data.activities)) {
      if (a.tripId !== tripId) dangling.push(`${a.id}: wrong trip`)
      if (a.dayId && !data.days[a.dayId]) dangling.push(`${a.id}: day ${a.dayId}`)
      if (a.locationId && !data.locations[a.locationId]) dangling.push(`${a.id}: location`)
      if (a.bookingId && !data.bookings[a.bookingId]) dangling.push(`${a.id}: booking`)
      if (a.transportId && !data.transports[a.transportId]) dangling.push(`${a.id}: transport`)
      if (a.accommodationId && !data.accommodations[a.accommodationId]) {
        dangling.push(`${a.id}: accommodation`)
      }
    }
    for (const stay of Object.values(data.accommodations)) {
      if (stay.locationId && !data.locations[stay.locationId]) dangling.push(`${stay.id}: location`)
      if (stay.bookingId && !data.bookings[stay.bookingId]) dangling.push(`${stay.id}: booking`)
    }
    expect(dangling).toEqual([])
  })

  it('gives every located place real coordinates', () => {
    const bad = Object.values(data.locations).filter(
      (l) =>
        (l.lat != null || l.lng != null) &&
        (typeof l.lat !== 'number' ||
          typeof l.lng !== 'number' ||
          Math.abs(l.lat) > 90 ||
          Math.abs(l.lng) > 180),
    )
    expect(bad.map((l) => l.name)).toEqual([])
  })

  it('is a clean single-trip subset — nothing from another trip rides along', () => {
    expect(tripSubset(data, tripId)).toEqual(data)
  })

  it('still computes its warnings without throwing', () => {
    const warnings = computeWarnings(data, tripId)
    // Advisory only, so this asserts the engine runs rather than a fixed count.
    expect(Array.isArray(warnings)).toBe(true)
  })

  it('hashes stably, so the update check is not noisy', () => {
    expect(revisionOf(RAW)).toEqual(revisionOf(RAW))
    expect(revisionOf(RAW)).not.toEqual(revisionOf(RAW + ' '))
  })
})
