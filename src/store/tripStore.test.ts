import { beforeEach, describe, expect, it } from 'vitest'
import { useTripStore } from './tripStore'
import { buildDemoTrip } from '@/data/demo'
import { activitiesForDay, ideasForTrip, listDays } from '@/domain/selectors'
import { emptyData } from '@/domain/types'

const store = () => useTripStore.getState()

function loadDemo() {
  const data = buildDemoTrip()
  const tripId = Object.keys(data.trips)[0]
  useTripStore.setState({ data, activeTripId: tripId, past: [], future: [], ready: true })
  return tripId
}

describe('trip store', () => {
  beforeEach(() => {
    useTripStore.setState({ data: emptyData(), activeTripId: null, past: [], future: [] })
  })

  it('creates a trip with one day per date', () => {
    const id = store().createTrip({
      name: 'Lisbon weekend',
      startDate: '2027-05-07',
      endDate: '2027-05-09',
      destinations: ['Lisbon'],
    })
    const days = listDays(store().data, id)
    expect(days.map((d) => d.date)).toEqual(['2027-05-07', '2027-05-08', '2027-05-09'])
    expect(store().activeTripId).toBe(id)
  })

  it('schedules an idea by moving it, without creating a second record', () => {
    const tripId = loadDemo()
    const idea = ideasForTrip(store().data, tripId)[0]
    const day = listDays(store().data, tripId)[5]
    const before = Object.keys(store().data.activities).length

    store().moveActivity(idea.id, day.id, { startTime: '14:00' })

    const moved = store().data.activities[idea.id]
    expect(moved.dayId).toBe(day.id)
    expect(moved.startTime).toBe('14:00')
    expect(moved.timePrecision).toBe('exact')
    expect(Object.keys(store().data.activities)).toHaveLength(before)
    expect(ideasForTrip(store().data, tripId)).not.toContainEqual(
      expect.objectContaining({ id: idea.id }),
    )
  })

  it('keeps an activity’s duration when it is dropped on a new time', () => {
    const tripId = loadDemo()
    const day = listDays(store().data, tripId)[5]
    const [first] = activitiesForDay(store().data, day.id) // 09:00–12:00

    store().moveActivity(first.id, day.id, { startTime: '10:30' })

    const moved = store().data.activities[first.id]
    expect(moved.startTime).toBe('10:30')
    expect(moved.endTime).toBe('13:30')
    expect(moved.durationMin).toBe(180)
  })

  it('moves an activity between days and orders it last', () => {
    const tripId = loadDemo()
    const days = listDays(store().data, tripId)
    const source = activitiesForDay(store().data, days[5].id)[0]

    store().moveActivity(source.id, days[6].id)

    expect(store().data.activities[source.id].dayId).toBe(days[6].id)
    const target = activitiesForDay(store().data, days[6].id)
    expect(target.some((a) => a.id === source.id)).toBe(true)
  })

  it('reorders within a day by placing before a sibling', () => {
    const tripId = loadDemo()
    const day = listDays(store().data, tripId)[6]
    const items = activitiesForDay(store().data, day.id)
    const last = items[items.length - 1]
    const first = items[0]

    store().reorderActivity(last.id, first.id, 'before')

    expect(store().data.activities[last.id].order).toBeLessThan(
      store().data.activities[first.id].order,
    )
  })

  it('unschedules back to ideas, clearing the time', () => {
    const tripId = loadDemo()
    const day = listDays(store().data, tripId)[5]
    const activity = activitiesForDay(store().data, day.id)[0]

    store().moveActivity(activity.id, null)

    const moved = store().data.activities[activity.id]
    expect(moved.dayId).toBeNull()
    expect(moved.startTime).toBeUndefined()
    expect(moved.timePrecision).toBe('unscheduled')
  })

  it('duplicates an activity along with its transport detail', () => {
    const tripId = loadDemo()
    const shinkansen = Object.values(store().data.activities).find(
      (a) => a.id === 'act_shinkansen',
    )!
    const copyId = store().duplicateActivity(shinkansen.id)!
    const copy = store().data.activities[copyId]

    expect(copy.title).toContain('(copy)')
    expect(copy.transportId).toBeDefined()
    expect(copy.transportId).not.toBe(shinkansen.transportId)
    expect(store().data.transports[copy.transportId!].vehicleNumber).toBe('Nozomi 231')
    expect(store().data.transports[shinkansen.transportId!]).toBeDefined()
    void tripId
  })

  it('undoes and redoes a deletion', () => {
    const tripId = loadDemo()
    const day = listDays(store().data, tripId)[5]
    const activity = activitiesForDay(store().data, day.id)[0]

    store().deleteActivity(activity.id)
    expect(store().data.activities[activity.id]).toBeUndefined()

    store().undo()
    expect(store().data.activities[activity.id]?.title).toBe(activity.title)

    store().redo()
    expect(store().data.activities[activity.id]).toBeUndefined()
  })

  it('never loses work when the trip gets shorter', () => {
    const tripId = loadDemo()
    const days = listDays(store().data, tripId)
    const lastDay = days[days.length - 1]
    const stranded = activitiesForDay(store().data, lastDay.id)
    expect(stranded.length).toBeGreaterThan(0)

    store().updateTrip(tripId, { endDate: '2027-03-24' })

    expect(store().data.days[lastDay.id]).toBeUndefined()
    for (const activity of stranded) {
      const after = store().data.activities[activity.id]
      expect(after).toBeDefined()
      expect(after.dayId).toBeNull() // returned to Ideas, not deleted
    }
  })

  it('extends the day list when the trip gets longer', () => {
    const tripId = loadDemo()
    store().updateTrip(tripId, { endDate: '2027-03-27' })
    const dates = listDays(store().data, tripId).map((d) => d.date)
    expect(dates).toHaveLength(16)
    expect(dates.at(-1)).toBe('2027-03-27')
  })

  it('deletes a trip and everything belonging to it', () => {
    const tripId = loadDemo()
    store().deleteTrip(tripId)
    expect(store().data.trips[tripId]).toBeUndefined()
    expect(Object.values(store().data.activities)).toHaveLength(0)
    expect(Object.values(store().data.days)).toHaveLength(0)
    expect(Object.values(store().data.accommodations)).toHaveLength(0)
  })

  it('clears the link when a location is deleted', () => {
    const tripId = loadDemo()
    const withLocation = Object.values(store().data.activities).find((a) => a.locationId)!
    store().deleteLocation(withLocation.locationId!)
    expect(store().data.activities[withLocation.id].locationId).toBeUndefined()
    void tripId
  })
})
