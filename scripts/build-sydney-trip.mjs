#!/usr/bin/env node
/**
 * Builds the Sydney 2026 trip as an Atlas import file.
 *
 *   node scripts/build-sydney-trip.mjs   ->   public/trips/sydney-2026.json
 *
 * The output is a plain TripData document (the same shape Settings exports), so
 * it goes back in through Settings -> Data -> Import. Edit this file and re-run
 * to regenerate the plan; edit it in the app once it has been imported.
 *
 * Conventions follow src/data/demo.ts: deterministic ids, so a re-import
 * updates records rather than duplicating them. Nothing is invented - unknown
 * prices, flight numbers and the hotel are left blank rather than filled in
 * with plausible fiction.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const TRIP = 'trip_sydney_2026'
const START = '2026-09-27'
const END = '2026-10-09'
const STAMP = '2026-09-05T00:00:00.000Z'
const CUR = 'AUD'

/* --------------------------------------------------------------- helpers */

function dateRange(start, end) {
  const out = []
  const cursor = new Date(start + 'T12:00:00')
  const last = new Date(end + 'T12:00:00')
  while (cursor <= last) {
    out.push(
      cursor.getFullYear() +
        '-' +
        String(cursor.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(cursor.getDate()).padStart(2, '0'),
    )
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

const DATES = dateRange(START, END)
const dayId = (i) => 'day_' + DATES[i]

const data = {
  trips: {},
  days: {},
  activities: {},
  locations: {},
  accommodations: {},
  transports: {},
  bookings: {},
}
let order = 0

/** Opening hours, 0 = Sunday. `closed` lists weekdays the place is shut. */
function week(open, close, closed = []) {
  const out = {}
  for (let i = 0; i < 7; i++) out[i] = closed.includes(i) ? null : { open, close }
  return out
}

/** Open only on the listed weekdays - markets. */
function onlyOn(days, open, close) {
  const out = {}
  for (let i = 0; i < 7; i++) out[i] = days.includes(i) ? { open, close } : null
  return out
}

function loc(id, name, lat, lng, extra = {}) {
  data.locations[id] = { id, tripId: TRIP, name, lat, lng, ...extra }
  return id
}

function booking(id, provider, notes, extra = {}) {
  data.bookings[id] = {
    id,
    tripId: TRIP,
    provider,
    status: 'pending',
    notes,
    currency: CUR,
    ...extra,
  }
  return id
}

function transport(id, mode, fromLabel, toLabel, extra = {}) {
  data.transports[id] = { id, tripId: TRIP, mode, fromLabel, toLabel, ...extra }
  return id
}

function minutesBetween(start, end) {
  if (!start || !end) return undefined
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return eh * 60 + em - (sh * 60 + sm)
}

/**
 * One activity. `day` is a 0-based day index, or null for an idea.
 * Precision is inferred: a start time means exact, a dayPart means dayPart, an
 * anchorNote means relative, otherwise flexible - or unscheduled for an idea.
 */
function act(seed) {
  const precision =
    seed.precision ??
    (seed.start
      ? 'exact'
      : seed.dayPart
        ? 'dayPart'
        : seed.anchorNote
          ? 'relative'
          : seed.day === null
            ? 'unscheduled'
            : 'flexible')
  const id = seed.id
  data.activities[id] = {
    id,
    tripId: TRIP,
    dayId: seed.day === null ? null : dayId(seed.day),
    order: (order += 10),
    title: seed.title,
    description: seed.description,
    category: seed.category,
    timePrecision: precision,
    startTime: seed.start,
    endTime: seed.end,
    dayPart: seed.dayPart,
    anchorNote: seed.anchorNote,
    durationMin: seed.duration ?? minutesBetween(seed.start, seed.end),
    locationId: seed.location,
    cost: seed.cost,
    currency: seed.cost != null ? CUR : undefined,
    bookingId: seed.booking,
    transportId: seed.transport,
    accommodationId: seed.stay,
    phone: seed.phone,
    notes: seed.notes,
    links: (seed.links ?? []).map((l, i) => ({ id: id + '_link' + i, ...l })),
    attachments: [],
    status: 'planned',
    optional: seed.optional ?? false,
    createdAt: STAMP,
    updatedAt: STAMP,
  }
  return id
}

/* ------------------------------------------------------------------ trip */

data.trips[TRIP] = {
  id: TRIP,
  name: 'Sydney 2026',
  startDate: START,
  endDate: END,
  destinations: ['Sydney', 'Hunter Valley', 'Blue Mountains'],
  description:
    'Thirteen days in Sydney with a small child, two birthdays and two day trips. The three big optional ' +
    'excursions - Pebbly Beach, the Royal National Park and the Northern Beaches - sit in Ideas as ' +
    'replacement days rather than additions.',
  coverImage: 'atlas:sea',
  baseCurrency: CUR,
  createdAt: STAMP,
  updatedAt: STAMP,
}

/* ------------------------------------------------------------------ days */

const dayMeta = [
  {
    place: 'Sydney',
    headline: 'The Rocks - arrival and the harbour',
    notes:
      'Deliberately light. Sunset is about 17:47 (AEST), which is roughly when you want to be on the ' +
      'Glenmore roof. You land on a Sunday, so The Rocks Markets should be running until about 17:00.',
  },
  {
    place: 'Sydney',
    headline: 'Darling Harbour - aquarium, zoo and the waterfront',
    notes:
      'The best walking day of the trip: SEA LIFE to Barangaroo is all within 15 minutes on foot. One Merlin ' +
      'combo ticket covers SEA LIFE, WILD LIFE and the Sydney Tower Eye on Day 3 - buy it once, use it twice.',
  },
  {
    place: 'Sydney',
    headline: 'CBD - shopping and the tower',
    notes:
      'The Sydney Tower Eye entrance is inside Westfield (podium level 5) - same building, no travel between ' +
      'them. The Baxter Inn is a licensed basement bar with no minors: it needs a sitter, or a swap.',
  },
  {
    place: 'Sydney',
    headline: 'Manly - ferry, beach and Shelly',
    notes:
      'Ferry each way from Circular Quay, about 30 minutes, Opal or contactless card - tap on and off. Sit on ' +
      'the right leaving the Quay for the bridge and Opera House. The Manly - Spit Bridge walk is in Ideas ' +
      'rather than here: 10 km is too much with a small child.',
  },
  {
    place: 'Sydney',
    headline: 'Hyde Park and the Domain - museum, gardens, Aline\'s birthday',
    notes:
      'Aline\'s birthday. The afternoon stays light on purpose so the evening is the event. Mrs Macquaries ' +
      'Chair lands close to sunset (about 17:52), which is the reason to go at that hour.',
  },
  {
    place: 'Sydney',
    headline: 'Western Sydney - outlet shopping and kangaroos',
    notes:
      'A car day. Without one: train to Olympic Park for DFO, then the Blacktown line and the 729 bus to ' +
      'Featherdale - allow an extra hour each way. Harts Pub is in The Rocks, not near Chinatown, so it is a ' +
      'detour on the way back rather than a stop before dinner.',
  },
  {
    place: 'Sydney',
    headline: 'Centennial Park, Paddington and the inner west',
    notes:
      'The fullest day on the list, and the checks panel says so. Newtown and Glebe are marked optional: drop ' +
      'them the moment the little one has had enough. Paddington Markets are Saturday-only, 10:00-16:00.',
  },
  {
    place: 'Sydney',
    headline: 'Hunter Valley - wine day',
    notes:
      'Daylight saving starts at 02:00 this morning - clocks go forward an hour, so an 08:30 departure is ' +
      'yesterday\'s 07:30. Set alarms accordingly. NSW limit is 0.05: designated driver, or book a tour. ' +
      'Everything below is in Pokolbin, about ten minutes apart.',
  },
  {
    place: 'Sydney',
    headline: 'Art Gallery, Paddington and Surry Hills',
    notes:
      'NSW Labour Day - a public holiday. Galleries and pubs open, boutiques often on Sunday hours, public ' +
      'transport on a Sunday timetable. Paddy\'s Markets are closed Monday and Tuesday: the checks panel flags ' +
      'it, and Day 6 (Friday) or Day 12 (Thursday) are the easy swaps.',
  },
  {
    place: 'Sydney',
    headline: 'Blue Mountains - Echo Point and Scenic World',
    notes:
      'The cold day: roughly 5-14 C at Katoomba and windy at Echo Point, against high teens in the city. ' +
      'Jackets, long trousers, closed shoes. Mountain weather closes the Skyway without notice - Scenic World ' +
      'publishes conditions each morning.',
  },
  {
    place: 'Sydney',
    headline: 'Taronga, then a harbour beach at Balmoral',
    notes:
      'Unhurried on purpose, after two long day trips. Balmoral is a netted harbour beach - flat water, good ' +
      'for a small child. Endeavour Tap Rooms is back in The Rocks, so it is marked optional.',
  },
  {
    place: 'Sydney',
    headline: 'Harbour Bridge, the MCA and Cl\u00e1udia\'s birthday',
    notes:
      'Cl\u00e1udia\'s birthday: the bridge in the morning, the harbour at night. Sunset about 18:25 (AEDT). The ' +
      'pedestrian path is on the eastern side - stairs up from Cumberland Street in The Rocks. BridgeClimb ' +
      '(minimum age 8) is in Ideas as the alternative to the walk plus Pylon.',
  },
  {
    place: 'Sydney',
    headline: 'Bondi, Watsons Bay, then home',
    notes:
      'This shape only works with a late-evening departure, roughly 22:00 or later. Anything earlier and ' +
      'Watsons Bay has to go: international check-in closes 60-90 minutes before departure and the airport is ' +
      '30-45 minutes from the city. Sunset about 18:32 (AEDT) over the skyline from The Gap.',
  },
]

DATES.forEach((date, i) => {
  data.days['day_' + date] = {
    id: 'day_' + date,
    tripId: TRIP,
    date,
    locationLabel: dayMeta[i].place,
    headline: dayMeta[i].headline,
    notes: dayMeta[i].notes,
  }
})

/* ------------------------------------------------------------- locations */

// Harbour, The Rocks, Circular Quay
const syd = loc('loc_syd', 'Sydney Airport (SYD)', -33.9399, 151.1753, {
  address: 'Mascot NSW 2020',
})
const circularQuay = loc('loc_circular_quay', 'Circular Quay', -33.8614, 151.2108)
const opera = loc('loc_opera', 'Sydney Opera House', -33.8568, 151.2153, {
  address: 'Bennelong Point, Sydney NSW 2000',
  url: 'https://www.sydneyoperahouse.com/',
  openingHours: week('09:00', '17:00'),
})
const theRocks = loc('loc_the_rocks', 'The Rocks + Dawes Point', -33.8577, 151.2088)
const glenmore = loc('loc_glenmore', 'The Glenmore Hotel', -33.8592, 151.2079, {
  address: '96 Cumberland St, The Rocks',
})
const heroWaterloo = loc('loc_hero', 'Hero of Waterloo', -33.8586, 151.2064, {
  address: '81 Lower Fort St, Millers Point',
})
const hartsPub = loc('loc_harts', 'Harts Pub', -33.8607, 151.2077, {
  address: 'Essex + Gloucester St, The Rocks',
})
const endeavour = loc('loc_endeavour', 'Endeavour Tap Rooms', -33.8592, 151.2076, {
  address: '39-43 Argyle St, The Rocks',
})
const mca = loc('loc_mca', 'Museum of Contemporary Art', -33.8599, 151.2088, {
  address: '140 George St, The Rocks',
  url: 'https://www.mca.com.au/',
  openingHours: week('10:00', '17:00'),
})
const bridgeWalk = loc('loc_bridge_walk', 'Sydney Harbour Bridge walkway', -33.8523, 151.2108)
const pylon = loc('loc_pylon', 'Pylon Lookout', -33.8524, 151.2114, {
  address: 'Southeast pylon, Sydney Harbour Bridge',
  url: 'https://www.pylonlookout.com.au/',
  openingHours: week('10:00', '17:00'),
})
const capCook = loc('loc_captain_cook', 'Captain Cook Cruises, Wharf 6', -33.8613, 151.2119, {
  address: 'Circular Quay Wharf 6',
})
const aria = loc('loc_aria', 'Aria Restaurant', -33.8595, 151.2118, {
  address: '1 Macquarie St, Sydney',
})

// Darling Harbour + Barangaroo
const sealife = loc('loc_sealife', 'SEA LIFE Sydney Aquarium', -33.8697, 151.202, {
  address: '1-5 Wheat Rd, Darling Harbour',
  openingHours: week('10:00', '17:00'),
})
const wildlife = loc('loc_wildlife', 'WILD LIFE Sydney Zoo', -33.8694, 151.2013, {
  address: '1-5 Wheat Rd, Darling Harbour',
  openingHours: week('10:00', '17:00'),
})
const fratelli = loc('loc_fratelli', 'Cockle Bay Wharf', -33.8712, 151.2007, {
  address: 'Cockle Bay Wharf, Darling Harbour',
})
const darlingQuarter = loc('loc_darling_quarter', 'Darling Quarter Playground', -33.8742, 151.2029)
const chineseGarden = loc(
  'loc_chinese_garden',
  'Chinese Garden of Friendship',
  -33.8767,
  151.2027,
  { address: 'Pier St, Darling Harbour', openingHours: week('10:00', '17:00') },
)
const barangaroo = loc('loc_barangaroo', 'Barangaroo Reserve', -33.8557, 151.2013)
const zephyr = loc('loc_zephyr', 'Zephyr Sky Bar, Hyatt Regency', -33.8681, 151.2013, {
  address: '161 Sussex St, Sydney',
})

// CBD
const qvb = loc('loc_qvb', 'Queen Victoria Building', -33.8717, 151.2069, {
  address: '455 George St, Sydney',
  openingHours: {
    0: { open: '11:00', close: '17:00' },
    1: { open: '09:00', close: '18:00' },
    2: { open: '09:00', close: '18:00' },
    3: { open: '09:00', close: '18:00' },
    4: { open: '09:00', close: '21:00' },
    5: { open: '09:00', close: '18:00' },
    6: { open: '09:00', close: '18:00' },
  },
})
const westfield = loc('loc_westfield', 'Westfield Sydney', -33.8704, 151.2085, {
  address: '188 Pitt St, Sydney',
  openingHours: week('09:30', '19:00'),
})
const appleGeorge = loc('loc_apple', 'Apple George St + JB Hi-Fi', -33.8692, 151.2072)
const groundsCity = loc('loc_grounds_city', 'The Grounds of the City', -33.8703, 151.2062, {
  address: 'The Galeries, 500 George St',
})
const sydneyTower = loc('loc_sydney_tower', 'Sydney Tower Eye', -33.8707, 151.2089, {
  address: 'Level 5, Westfield Sydney, 108 Market St',
  openingHours: week('10:00', '20:00'),
})
const baxter = loc('loc_baxter', 'The Baxter Inn', -33.8683, 151.2049, {
  address: 'Basement, 152-156 Clarence St',
})
const chinatown = loc('loc_chinatown', 'Chinatown, Dixon St', -33.8785, 151.2043)
const paddys = loc('loc_paddys', 'Paddy\'s Markets Haymarket', -33.8794, 151.2029, {
  address: '9-13 Hay St, Haymarket',
  // Haymarket trades Wednesday to Sunday - Monday and Tuesday are closed.
  openingHours: onlyOn([0, 3, 4, 5, 6], '10:00', '18:00'),
})
const central = loc('loc_central', 'Central Station', -33.8832, 151.2065)

// Hyde Park + The Domain
const ausMuseum = loc('loc_aus_museum', 'Australian Museum', -33.8746, 151.213, {
  address: '1 William St, Darlinghurst',
  url: 'https://australian.museum/',
  openingHours: week('10:00', '17:00'),
})
const stMarys = loc('loc_st_marys', 'St Mary\'s Cathedral', -33.8712, 151.2131, {
  openingHours: week('06:30', '18:30'),
})
const hydePark = loc('loc_hyde_park', 'Hyde Park', -33.8735, 151.211)
const hydePlayground = loc('loc_hyde_playground', 'Hyde Park playground', -33.8709, 151.211, {
  address: 'North end, near St James',
})
const botanic = loc('loc_botanic', 'Royal Botanic Garden', -33.8642, 151.2166, {
  openingHours: week('07:00', '18:30'),
})
const mrsMacquarie = loc('loc_mrs_macquarie', 'Mrs Macquarie\'s Chair', -33.8599, 151.2226)
const artGallery = loc('loc_art_gallery', 'Art Gallery of NSW', -33.8688, 151.217, {
  address: 'Art Gallery Rd, The Domain',
  url: 'https://www.artgallery.nsw.gov.au/',
  openingHours: {
    0: { open: '10:00', close: '17:00' },
    1: { open: '10:00', close: '17:00' },
    2: { open: '10:00', close: '17:00' },
    3: { open: '10:00', close: '22:00' },
    4: { open: '10:00', close: '17:00' },
    5: { open: '10:00', close: '17:00' },
    6: { open: '10:00', close: '17:00' },
  },
})

// Manly
const manlyWharf = loc('loc_manly_wharf', 'Manly Wharf', -33.8003, 151.2846)
const corso = loc('loc_corso', 'The Corso', -33.7975, 151.2872)
const manlyBeach = loc('loc_manly_beach', 'Manly Beach', -33.7969, 151.288)
const wharfBar = loc('loc_wharf_bar', 'The Wharf Bar', -33.8005, 151.2843, {
  address: 'Manly Wharf',
})
const shelly = loc('loc_shelly', 'Shelly Beach', -33.8, 151.2946, {
  address: 'Cabbage Tree Bay Aquatic Reserve',
})
const fourPines = loc('loc_four_pines', '4 Pines Brewing Co', -33.8003, 151.2841, {
  address: 'Manly Wharf',
})

// Western Sydney
const dfo = loc('loc_dfo', 'DFO Homebush', -33.8452, 151.0672, {
  address: '3-5 Underwood Rd, Homebush',
  openingHours: week('10:00', '18:00'),
})
const featherdale = loc('loc_featherdale', 'Featherdale Wildlife Park', -33.7607, 150.873, {
  address: '217-229 Kildare Rd, Doonside',
  url: 'https://www.featherdale.com.au/',
  openingHours: week('09:00', '17:00'),
})

// Eastern suburbs
const centennial = loc('loc_centennial', 'Centennial Parklands', -33.8969, 151.2337)
const wildPlay = loc(
  'loc_wild_play',
  'Ian Potter Children\'s WILD PLAY Garden',
  -33.894,
  151.2313,
  { openingHours: week('09:00', '17:00') },
)
const homestead = loc('loc_homestead', 'Centennial Park Homestead', -33.8974, 151.2325)
const paddington = loc('loc_paddington', 'Paddington, Oxford St', -33.8846, 151.2266)
const fiveWays = loc('loc_five_ways', 'Five Ways, Paddington', -33.8862, 151.228)
const paddingtonMarkets = loc(
  'loc_paddington_markets',
  'Paddington Markets',
  -33.8853,
  151.2287,
  { address: '395 Oxford St, at St Johns', openingHours: onlyOn([6], '10:00', '16:00') },
)
const thePaddington = loc('loc_the_paddington', 'The Paddington', -33.885, 151.228, {
  address: '380 Oxford St, Paddington',
})
const surryHills = loc('loc_surry_hills', 'Surry Hills, Crown St', -33.885, 151.213)
const newtown = loc('loc_newtown', 'Newtown, King St', -33.8963, 151.1795)
const glebe = loc('loc_glebe', 'Glebe Point Road', -33.8798, 151.1897)
const sydneyUni = loc('loc_sydney_uni', 'University of Sydney Quadrangle', -33.8886, 151.1873)

// Coast
const bondi = loc('loc_bondi', 'Bondi Beach', -33.8908, 151.2743)
const bondiWalk = loc('loc_bondi_walk', 'Bondi to Tamarama coastal walk', -33.8945, 151.279)
const coogee = loc('loc_coogee', 'Coogee Beach', -33.9205, 151.257)
const watsonsWharf = loc('loc_watsons_wharf', 'Watsons Bay Wharf', -33.842, 151.2818)
const robertson = loc('loc_robertson', 'Robertson Park', -33.8425, 151.2807)
const theGap = loc('loc_the_gap', 'The Gap + South Head', -33.844, 151.285)
const doyles = loc('loc_doyles', 'Doyles on the Beach', -33.8419, 151.281)

// North shore
const taronga = loc('loc_taronga', 'Taronga Zoo', -33.8433, 151.2413, {
  address: 'Bradleys Head Rd, Mosman',
  url: 'https://www.taronga.org.au/sydney-zoo',
  openingHours: week('09:30', '17:00'),
})
const tarongaWharf = loc('loc_taronga_wharf', 'Taronga Zoo Wharf', -33.8434, 151.2412)
const balmoral = loc('loc_balmoral', 'Balmoral Beach', -33.8236, 151.2515)
const balmoralPlay = loc('loc_balmoral_play', 'Balmoral playground', -33.8244, 151.2513)
const bathers = loc('loc_bathers', 'The Bathers\' Pavilion', -33.8225, 151.2519, {
  address: '4 The Esplanade, Balmoral Beach',
})

// Hunter Valley
const tulloch = loc('loc_tulloch', 'Tulloch Wines', -32.781, 151.3005, {
  address: 'Debeyers Rd, Pokolbin',
  url: 'https://www.tulloch.com.au/',
  openingHours: week('10:00', '17:00'),
})
const brokenwood = loc('loc_brokenwood', 'Brokenwood Wines + The Wood', -32.7897, 151.2977, {
  address: '401-427 McDonalds Rd, Pokolbin',
  url: 'https://www.brokenwood.com.au/',
  openingHours: week('10:00', '17:00'),
})
const audrey = loc('loc_audrey', 'Audrey Wilkinson Vineyard', -32.7745, 151.276, {
  address: 'Debeyers Rd, Pokolbin',
  url: 'https://www.audreywilkinson.com.au/',
  openingHours: week('10:00', '17:00'),
})
const tyrrells = loc('loc_tyrrells', 'Tyrrell\'s Wines', -32.7622, 151.2951, {
  address: 'Broke Rd, Pokolbin',
  url: 'https://www.tyrrells.com.au/',
  openingHours: week('10:00', '17:00'),
})

// Blue Mountains
const katoomba = loc('loc_katoomba', 'Katoomba Station', -33.714, 150.311)
const echoPoint = loc('loc_echo_point', 'Echo Point + Three Sisters', -33.7325, 150.3122)
const scenicWorld = loc('loc_scenic_world', 'Scenic World', -33.7276, 150.3005, {
  address: 'Violet St + Cliff Dr, Katoomba',
  url: 'https://www.scenicworld.com.au/',
  openingHours: week('09:00', '17:00'),
})

// Optional day trips - only referenced from Ideas
const pebbly = loc('loc_pebbly', 'Pebbly Beach, Murramarang NP', -35.63, 150.32)
const royalNp = loc('loc_royal_np', 'Royal National Park, Wattamolla', -34.137, 151.113)
const palmBeach = loc('loc_palm_beach', 'Palm Beach', -33.598, 151.323)
const barrenjoey = loc('loc_barrenjoey', 'Barrenjoey Lighthouse', -33.5797, 151.3283)
const spitBridge = loc('loc_spit', 'Spit Bridge', -33.8047, 151.2469)
const oBar = loc('loc_o_bar', 'O Bar and Dining', -33.8646, 151.2074, {
  address: 'Level 47, Australia Square, 264 George St',
})

/* --------------------------------------------------------- accommodation */

// Placeholder: the stay is not booked yet, but every day needs to resolve one
// or the nightly check fires thirteen times. Replace the name, address and
// reference in one place and the whole trip picks it up.
const stayBooking = booking(
  'bkg_stay',
  'To be decided',
  'Accommodation is not booked yet. Somewhere near Circular Quay, Darling Harbour or Surry Hills keeps ' +
    'most of this itinerary walkable; the Blue Mountains and Hunter days both start from Central or a car park.',
)
data.accommodations['stay_sydney'] = {
  id: 'stay_sydney',
  tripId: TRIP,
  name: 'Sydney base - to be confirmed',
  checkInDate: DATES[0],
  checkInTime: '15:00',
  checkOutDate: DATES[12],
  checkOutTime: '11:00',
  bookingId: stayBooking,
  currency: CUR,
  notes:
    'Placeholder so the nightly accommodation check passes. Replace the name, address, phone and booking ' +
    'reference once it is confirmed - no coordinates yet, so nothing is pinned on the map.',
}

/* ---------------------------------------------------------------- Day 1 */

act({
  id: 'act_arrive',
  day: 0,
  title: 'Arrive at Sydney Airport (SYD)',
  category: 'flight',
  dayPart: 'morning',
  duration: 90,
  location: syd,
  booking: booking('bkg_flights', 'To be added', 'Add both flight numbers and the real times.'),
  transport: transport('trn_arrive', 'flight', 'Home', 'Sydney (SYD)', {
    notes: 'Fill in carrier, flight number and landing time - the rest of Day 1 hangs off it.',
  }),
  notes:
    'Everything on Day 1 assumes a morning landing. If you arrive in the afternoon, keep Circular Quay and ' +
    'the Opera House and drop the rest.',
})
act({
  id: 'act_transfer_in',
  day: 0,
  title: 'Airport to the city',
  category: 'transport',
  dayPart: 'morning',
  duration: 45,
  transport: transport('trn_transfer_in', 'publicTransport', 'Sydney Airport (SYD)', 'Accommodation', {
    notes:
      'Airport Link train is 13 minutes to the CBD but adds a station access fee of about $17 per adult; ' +
      'with luggage and a child a maxi taxi or rideshare often works out similar.',
  }),
})
act({
  id: 'act_checkin',
  day: 0,
  title: 'Check in and drop the bags',
  category: 'accommodation',
  anchorNote: 'Once you reach the city',
  duration: 60,
  stay: 'stay_sydney',
})
act({
  id: 'act_circular_quay_1',
  day: 0,
  title: 'Circular Quay',
  category: 'walking',
  start: '14:00',
  end: '15:00',
  location: circularQuay,
})
act({
  id: 'act_opera_exterior',
  day: 0,
  title: 'Sydney Opera House - exterior and photos',
  category: 'culture',
  start: '15:15',
  end: '16:15',
  location: opera,
  notes: 'Inside is Day 12. Walk right around to the eastern steps for the shot back at the bridge.',
})
act({
  id: 'act_rocks_walk',
  day: 0,
  title: 'The Rocks + Dawes Point',
  category: 'walking',
  start: '16:30',
  end: '17:45',
  location: theRocks,
  notes:
    'The Rocks Markets run Saturday and Sunday on George St until about 17:00 - you land on a Sunday, so ' +
    'they should be on. Dawes Point sits directly under the bridge.',
})
act({
  id: 'act_glenmore',
  day: 0,
  title: 'The Glenmore rooftop',
  category: 'food',
  start: '18:00',
  end: '19:00',
  location: glenmore,
  notes: 'Rooftop faces the Opera House. Sunset about 17:47 - get up there before it goes.',
})
act({
  id: 'act_dinner_quay',
  day: 0,
  title: 'Dinner around Circular Quay',
  category: 'food',
  start: '19:15',
  end: '20:45',
  location: circularQuay,
})

/* ---------------------------------------------------------------- Day 2 */

const merlin = booking(
  'bkg_merlin',
  'Merlin Entertainments',
  'One multi-attraction pass covers SEA LIFE, WILD LIFE and the Sydney Tower Eye (Day 3). Book online for ' +
    'timed entry - this is the middle of the NSW school holidays.',
)
act({
  id: 'act_sealife',
  day: 1,
  title: 'SEA LIFE Sydney Aquarium',
  category: 'activity',
  start: '10:00',
  end: '12:00',
  location: sealife,
  booking: merlin,
})
act({
  id: 'act_wildlife',
  day: 1,
  title: 'WILD LIFE Sydney Zoo',
  category: 'activity',
  start: '12:15',
  end: '13:30',
  location: wildlife,
  booking: merlin,
  notes: 'Next door to the aquarium - same building complex, two minutes between them.',
})
act({
  id: 'act_lunch_cockle',
  day: 1,
  title: 'Lunch - Fratelli Fresh, Cockle Bay',
  category: 'food',
  start: '13:45',
  end: '14:45',
  location: fratelli,
  notes:
    'Confirm it is still trading before you set your heart on it - the Cockle Bay and Darling Harbour ' +
    'promenade has plenty of alternatives either way.',
})
act({
  id: 'act_darling_quarter',
  day: 1,
  title: 'Darling Quarter Playground',
  category: 'activity',
  start: '15:00',
  end: '16:00',
  location: darlingQuarter,
  notes: 'Water play area - bring a change of clothes and a towel.',
})
act({
  id: 'act_chinese_garden',
  day: 1,
  title: 'Chinese Garden of Friendship',
  category: 'culture',
  start: '16:15',
  end: '17:00',
  location: chineseGarden,
  notes: 'Small entry fee. Closes at 17:00, so this is the last slot that works.',
})
act({
  id: 'act_barangaroo',
  day: 1,
  title: 'Barangaroo Reserve',
  category: 'nature',
  start: '17:30',
  end: '18:30',
  location: barangaroo,
})
act({
  id: 'act_zephyr',
  day: 1,
  title: 'Zephyr Sky Bar',
  category: 'food',
  start: '18:45',
  end: '20:00',
  location: zephyr,
  notes: 'Hotel rooftop bar - check the under-18 policy for the evening before you walk over.',
})

/* ---------------------------------------------------------------- Day 3 */

act({
  id: 'act_qvb',
  day: 2,
  title: 'Queen Victoria Building',
  category: 'shopping',
  start: '10:00',
  end: '11:15',
  location: qvb,
  notes: 'Worth the trip for the building itself - the dome, the tiled floor and the Royal Clock.',
})
act({
  id: 'act_apple_jb',
  day: 2,
  title: 'Apple Store + JB Hi-Fi',
  category: 'shopping',
  start: '11:30',
  end: '12:30',
  location: appleGeorge,
})
act({
  id: 'act_grounds_city',
  day: 2,
  title: 'Lunch - The Grounds of the City',
  category: 'food',
  start: '12:45',
  end: '14:00',
  location: groundsCity,
  notes: 'Inside The Galeries. No small-group bookings at lunch - expect a queue at peak.',
})
act({
  id: 'act_westfield',
  day: 2,
  title: 'Westfield Sydney',
  category: 'shopping',
  start: '14:15',
  end: '16:00',
  location: westfield,
})
act({
  id: 'act_sydney_tower',
  day: 2,
  title: 'Sydney Tower Eye',
  category: 'activity',
  start: '16:15',
  end: '17:30',
  location: sydneyTower,
  booking: merlin,
  notes:
    'Entrance is on podium level 5 of Westfield - you are already in the building. Covered by the same ' +
    'Merlin pass as Day 2.',
})
act({
  id: 'act_baxter',
  day: 2,
  title: 'The Baxter Inn',
  category: 'food',
  start: '18:00',
  end: '19:30',
  location: baxter,
  optional: true,
  notes:
    'Unmarked basement whisky bar down a laneway off Clarence St. Licensed, no minors - this one needs a ' +
    'sitter, or swap it for somewhere with a courtyard.',
})
act({
  id: 'act_dinner_cbd',
  day: 2,
  title: 'Dinner in the CBD',
  category: 'food',
  duration: 90,
  notes: 'Left unscheduled on purpose - see how the shopping runs.',
})

/* ---------------------------------------------------------------- Day 4 */

act({
  id: 'act_ferry_manly_out',
  day: 3,
  title: 'Ferry - Circular Quay to Manly',
  category: 'transport',
  start: '09:30',
  end: '10:00',
  location: circularQuay,
  transport: transport('trn_ferry_manly_out', 'ferry', 'Circular Quay', 'Manly Wharf', {
    platform: 'Wharf 3',
    notes: 'F1 Manly, about 30 minutes. Opal or contactless - tap on and off.',
  }),
})
act({
  id: 'act_corso',
  day: 3,
  title: 'The Corso',
  category: 'walking',
  start: '10:15',
  end: '11:00',
  location: corso,
})
act({
  id: 'act_manly_beach',
  day: 3,
  title: 'Manly Beach',
  category: 'beach',
  start: '11:15',
  end: '12:45',
  location: manlyBeach,
  notes: 'Patrolled between the flags. Water is about 18 C in early October.',
})
act({
  id: 'act_wharf_bar',
  day: 3,
  title: 'Lunch at The Wharf Bar',
  category: 'food',
  start: '13:00',
  end: '14:15',
  location: wharfBar,
})
act({
  id: 'act_shelly',
  day: 3,
  title: 'Shelly Beach',
  category: 'beach',
  start: '14:30',
  end: '16:30',
  location: shelly,
  notes:
    'Twenty minutes along the promenade from Manly. Sheltered, north-facing and shallow - the better core ' +
    'activity with a small child than the Spit walk.',
})
act({
  id: 'act_snorkel',
  day: 3,
  title: 'Snorkelling at Cabbage Tree Bay',
  category: 'activity',
  anchorNote: 'While you are at Shelly',
  duration: 90,
  location: shelly,
  optional: true,
  notes:
    'Aquatic reserve - gear hire on the Corso. Water around 18 C, so a wetsuit unless someone is hardy.',
})
act({
  id: 'act_four_pines',
  day: 3,
  title: '4 Pines Brewing Co',
  category: 'food',
  start: '16:45',
  end: '17:30',
  location: fourPines,
})
act({
  id: 'act_ferry_manly_back',
  day: 3,
  title: 'Ferry - Manly to Circular Quay',
  category: 'transport',
  start: '17:45',
  end: '18:15',
  location: manlyWharf,
  transport: transport('trn_ferry_manly_back', 'ferry', 'Manly Wharf', 'Circular Quay', {
    notes: 'Golden hour on the way back if you catch this one.',
  }),
})
act({
  id: 'act_hero',
  day: 3,
  title: 'Hero of Waterloo',
  category: 'food',
  start: '18:30',
  end: '19:30',
  location: heroWaterloo,
  optional: true,
  notes: 'One of the oldest pubs in Sydney. Small and old - check the minors policy before you commit.',
})

/* ---------------------------------------------------------------- Day 5 */

act({
  id: 'act_aus_museum',
  day: 4,
  title: 'Australian Museum',
  category: 'museum',
  start: '10:00',
  end: '11:45',
  location: ausMuseum,
  notes: 'General entry is free; special exhibitions are ticketed.',
})
act({
  id: 'act_burra',
  day: 4,
  title: 'Burra children\'s space',
  category: 'activity',
  start: '11:45',
  end: '12:30',
  location: ausMuseum,
  notes: 'Inside the museum - free, timed sessions at busy periods.',
})
act({
  id: 'act_lunch_hyde',
  day: 4,
  title: 'Lunch near Hyde Park',
  category: 'food',
  start: '12:45',
  end: '13:45',
  location: hydePark,
})
act({
  id: 'act_st_marys',
  day: 4,
  title: 'St Mary\'s Cathedral',
  category: 'culture',
  start: '14:00',
  end: '14:45',
  location: stMarys,
})
act({
  id: 'act_hyde_playground',
  day: 4,
  title: 'Hyde Park playground',
  category: 'activity',
  start: '15:00',
  end: '16:00',
  location: hydePlayground,
})
act({
  id: 'act_botanic',
  day: 4,
  title: 'Royal Botanic Garden',
  category: 'nature',
  start: '16:15',
  end: '17:30',
  location: botanic,
})
act({
  id: 'act_mrs_macquarie',
  day: 4,
  title: 'Mrs Macquarie\'s Chair',
  category: 'nature',
  start: '17:45',
  end: '18:30',
  location: mrsMacquarie,
  notes: 'The postcard angle with the Opera House and bridge in one frame. Sunset about 17:52.',
})
act({
  id: 'act_aline_birthday',
  day: 4,
  title: 'Aline\'s birthday dinner - Aria',
  category: 'event',
  start: '19:30',
  end: '22:00',
  location: aria,
  booking: booking(
    'bkg_aria',
    'Aria Restaurant',
    'Not booked. Fine dining over the Opera House - book weeks ahead and confirm the policy on children. ' +
      'O Bar, Infinity and Bennelong are in Ideas as alternatives.',
  ),
  notes: 'The point of the day. Alternatives sit in Ideas if Aria does not work out.',
})

/* ---------------------------------------------------------------- Day 6 */

act({
  id: 'act_drive_dfo',
  day: 5,
  title: 'Drive to DFO Homebush',
  category: 'driving',
  start: '09:15',
  end: '10:00',
  transport: transport('trn_drive_dfo', 'car', 'City', 'DFO Homebush', {
    notes: 'About 20 km west. Paid parking on site.',
  }),
})
act({
  id: 'act_dfo',
  day: 5,
  title: 'DFO Homebush',
  category: 'shopping',
  start: '10:15',
  end: '12:30',
  location: dfo,
  notes: 'The long shopping session of the trip - outlet prices, so leave suitcase room.',
})
act({
  id: 'act_dfo_lunch',
  day: 5,
  title: 'Lunch at DFO',
  category: 'food',
  start: '12:30',
  end: '13:15',
  location: dfo,
})
act({
  id: 'act_drive_featherdale',
  day: 5,
  title: 'Drive to Featherdale',
  category: 'driving',
  start: '13:30',
  end: '14:15',
  transport: transport('trn_drive_featherdale', 'car', 'DFO Homebush', 'Featherdale, Doonside', {
    notes: 'About 25 km further west.',
  }),
})
act({
  id: 'act_featherdale',
  day: 5,
  title: 'Featherdale Wildlife Park',
  category: 'nature',
  start: '14:30',
  end: '16:15',
  location: featherdale,
  booking: booking(
    'bkg_featherdale',
    'Featherdale Wildlife Park',
    'Not booked. Online tickets only in peak periods; koala photo sessions run to a timetable.',
  ),
  notes: 'Hand-feeding kangaroos and wallabies, koalas up close. Last entry is about an hour before close.',
})
act({
  id: 'act_drive_back_city',
  day: 5,
  title: 'Drive back to the city',
  category: 'driving',
  start: '16:30',
  end: '17:30',
  transport: transport('trn_drive_back', 'car', 'Doonside', 'City', {
    notes: 'Friday afternoon on the M4 - allow more than the map says.',
  }),
})
act({
  id: 'act_harts',
  day: 5,
  title: 'Harts Pub',
  category: 'food',
  start: '17:45',
  end: '18:45',
  location: hartsPub,
  optional: true,
  notes:
    'Harts is in The Rocks, a fair way from Chinatown. Keep it only if you want the detour - otherwise ' +
    'head straight to Haymarket.',
})
act({
  id: 'act_chinatown_dinner',
  day: 5,
  title: 'Malaysian dinner in Chinatown',
  category: 'food',
  start: '19:15',
  end: '20:45',
  location: chinatown,
  notes:
    'Mamak on Goulburn St queues from about 18:00 and takes no bookings. Ho Jiak and the Dixon St food ' +
    'courts are the fallbacks.',
})

/* ---------------------------------------------------------------- Day 7 */

act({
  id: 'act_centennial',
  day: 6,
  title: 'Centennial Parklands',
  category: 'nature',
  start: '09:30',
  end: '10:45',
  location: centennial,
})
act({
  id: 'act_wild_play',
  day: 6,
  title: 'Ian Potter Children\'s WILD PLAY Garden',
  category: 'activity',
  start: '11:00',
  end: '12:30',
  location: wildPlay,
  notes: 'Free. Water play, a bamboo forest and a dry creek bed - bring spare clothes.',
})
act({
  id: 'act_homestead',
  day: 6,
  title: 'Lunch - Centennial Park Homestead',
  category: 'food',
  start: '12:45',
  end: '13:45',
  location: homestead,
})
act({
  id: 'act_quadricycle',
  day: 6,
  title: 'Family quadricycle',
  category: 'activity',
  anchorNote: 'If everyone still has energy',
  duration: 45,
  location: centennial,
  optional: true,
  notes: 'Hire is inside the park near the Cafe. Four-seaters with a child seat.',
})
act({
  id: 'act_paddington',
  day: 6,
  title: 'Paddington - Oxford St and the terraces',
  category: 'walking',
  start: '14:00',
  end: '15:00',
  location: paddington,
})
act({
  id: 'act_paddington_markets',
  day: 6,
  title: 'Paddington Markets',
  category: 'shopping',
  start: '15:15',
  end: '16:00',
  location: paddingtonMarkets,
  notes: 'Saturdays only, 10:00-16:00 - this is the one Saturday of the trip that lands here.',
})
act({
  id: 'act_surry_hills_1',
  day: 6,
  title: 'Surry Hills - cafes and boutiques',
  category: 'walking',
  start: '16:15',
  end: '17:30',
  location: surryHills,
})
act({
  id: 'act_newtown_1',
  day: 6,
  title: 'Newtown - King St and the street art',
  category: 'walking',
  start: '18:00',
  end: '19:30',
  location: newtown,
  optional: true,
  notes: 'The inner-west leg. Drop it without guilt if the day has already been long.',
})
act({
  id: 'act_glebe',
  day: 6,
  title: 'Glebe Point Road',
  category: 'walking',
  start: '19:45',
  end: '20:45',
  location: glebe,
  optional: true,
})

/* ---------------------------------------------------------------- Day 8 */

const hunterLunch = booking(
  'bkg_the_wood',
  'The Wood at Brokenwood',
  'Not booked. Sunday lunch in the valley books out weeks ahead - reserve this before anything else on ' +
    'this day. Book the cellar-door tastings at the same time.',
)
act({
  id: 'act_drive_hunter',
  day: 7,
  title: 'Drive to the Hunter Valley',
  category: 'driving',
  start: '08:30',
  end: '10:30',
  transport: transport('trn_drive_hunter', 'car', 'Sydney', 'Pokolbin, Hunter Valley', {
    notes: 'About 160 km, two hours via the M1. Clocks went forward at 02:00 - leave earlier than it feels.',
  }),
})
act({
  id: 'act_tulloch',
  day: 7,
  title: 'Tulloch Wines - tasting',
  category: 'activity',
  start: '10:45',
  end: '12:00',
  location: tulloch,
  booking: hunterLunch,
  notes:
    'Book the Junior Tasting Experience for the little one at the same time as the adults\' tasting - it is ' +
    'a grape-juice flight run alongside.',
})
act({
  id: 'act_brokenwood',
  day: 7,
  title: 'Brokenwood - tasting',
  category: 'activity',
  start: '12:15',
  end: '13:00',
  location: brokenwood,
})
act({
  id: 'act_the_wood',
  day: 7,
  title: 'Lunch at The Wood',
  category: 'food',
  start: '13:00',
  end: '14:15',
  location: brokenwood,
  booking: hunterLunch,
})
act({
  id: 'act_audrey',
  day: 7,
  title: 'Audrey Wilkinson - views',
  category: 'activity',
  start: '14:45',
  end: '15:45',
  location: audrey,
  notes: 'The view down the valley from the terrace is the reason to come. Late light is best.',
})
act({
  id: 'act_tyrrells',
  day: 7,
  title: 'Tyrrell\'s Wines',
  category: 'activity',
  start: '16:00',
  end: '16:45',
  location: tyrrells,
})
act({
  id: 'act_drive_hunter_back',
  day: 7,
  title: 'Drive back to Sydney',
  category: 'driving',
  start: '17:00',
  end: '19:00',
  transport: transport('trn_drive_hunter_back', 'car', 'Pokolbin', 'Sydney', {
    notes: 'Two hours. Whoever drove out should not be the one tasting.',
  }),
})

/* ---------------------------------------------------------------- Day 9 */

act({
  id: 'act_art_gallery',
  day: 8,
  title: 'Art Gallery of NSW',
  category: 'museum',
  start: '10:00',
  end: '12:00',
  location: artGallery,
  notes:
    'Free general entry. Naala Badu, the newer north building, holds the contemporary galleries and the ' +
    'Yiribana Gallery of Aboriginal and Torres Strait Islander art - that is the part worth the time.',
})
act({
  id: 'act_five_ways',
  day: 8,
  title: 'Paddington - Victorian terraces and Five Ways',
  category: 'walking',
  start: '12:30',
  end: '13:30',
  location: fiveWays,
})
act({
  id: 'act_the_paddington',
  day: 8,
  title: 'Lunch at The Paddington',
  category: 'food',
  start: '13:45',
  end: '15:00',
  location: thePaddington,
})
act({
  id: 'act_surry_hills_2',
  day: 8,
  title: 'Surry Hills',
  category: 'walking',
  start: '15:15',
  end: '16:30',
  location: surryHills,
})
act({
  id: 'act_paddys',
  day: 8,
  title: 'Paddy\'s Markets - souvenirs',
  category: 'shopping',
  start: '17:00',
  end: '18:00',
  location: paddys,
  optional: true,
  notes:
    'Haymarket trades Wednesday to Sunday, so it is shut on this Monday - the checks panel flags it. Move ' +
    'it to Day 6 (Friday, before the Chinatown dinner) or Day 12 (Thursday afternoon).',
})

/* --------------------------------------------------------------- Day 10 */

act({
  id: 'act_train_katoomba',
  day: 9,
  title: 'Train - Central to Katoomba',
  category: 'train',
  start: '07:20',
  end: '09:30',
  location: central,
  transport: transport('trn_train_katoomba', 'train', 'Central', 'Katoomba', {
    notes: 'Blue Mountains line, about two hours. Check the timetable the night before - services are hourly.',
  }),
})
act({
  id: 'act_bus_echo',
  day: 9,
  title: 'Bus to Echo Point',
  category: 'transport',
  start: '09:45',
  end: '10:15',
  transport: transport('trn_bus_echo', 'bus', 'Katoomba Station', 'Echo Point', {
    notes: 'The 686 local bus, or the hop-on Explorer Bus if you want Scenic World on the same ticket.',
  }),
})
act({
  id: 'act_echo_point',
  day: 9,
  title: 'Echo Point + Three Sisters',
  category: 'nature',
  start: '10:30',
  end: '11:30',
  location: echoPoint,
  notes: 'Exposed and windy. This is where the jackets earn their place in the bag.',
})
act({
  id: 'act_scenic_world',
  day: 9,
  title: 'Scenic World - Railway, Cableway, Skyway',
  category: 'activity',
  start: '11:45',
  end: '14:15',
  location: scenicWorld,
  booking: booking(
    'bkg_scenic',
    'Scenic World',
    'Not booked. Timed online tickets are cheaper and skip the queue. The Skyway closes in high wind - ' +
      'they publish conditions each morning.',
  ),
  notes: 'The Railway is the steepest passenger railway in the world; the valley boardwalk links the two ends.',
})
act({
  id: 'act_scenic_lunch',
  day: 9,
  title: 'Lunch at Scenic World',
  category: 'food',
  start: '14:15',
  end: '15:00',
  location: scenicWorld,
})
act({
  id: 'act_cliff_walk',
  day: 9,
  title: 'Prince Henry Cliff Walk',
  category: 'walking',
  start: '15:15',
  end: '16:15',
  location: echoPoint,
  optional: true,
  notes: 'Scenic World back to Echo Point along the clifftop, about 45 minutes, pram-unfriendly in places.',
})
act({
  id: 'act_bus_katoomba',
  day: 9,
  title: 'Bus to Katoomba Station',
  category: 'transport',
  start: '16:30',
  end: '17:00',
  transport: transport('trn_bus_katoomba', 'bus', 'Echo Point', 'Katoomba Station'),
})
act({
  id: 'act_train_back',
  day: 9,
  title: 'Train - Katoomba to Central',
  category: 'train',
  start: '17:15',
  end: '19:25',
  location: katoomba,
  transport: transport('trn_train_back', 'train', 'Katoomba', 'Central'),
})

/* --------------------------------------------------------------- Day 11 */

act({
  id: 'act_ferry_taronga',
  day: 10,
  title: 'Ferry - Circular Quay to Taronga',
  category: 'transport',
  start: '09:30',
  end: '09:45',
  location: circularQuay,
  transport: transport('trn_ferry_taronga', 'ferry', 'Circular Quay', 'Taronga Zoo Wharf', {
    notes: 'About 12 minutes. Zoo-and-ferry combo tickets exist - compare before buying entry separately.',
  }),
})
act({
  id: 'act_sky_safari',
  day: 10,
  title: 'Sky Safari cable car to the top gate',
  category: 'activity',
  start: '10:00',
  end: '10:15',
  location: tarongaWharf,
  notes: 'Included with entry. Ride up, then walk the zoo downhill back towards the wharf.',
})
act({
  id: 'act_taronga',
  day: 10,
  title: 'Taronga Zoo',
  category: 'nature',
  start: '10:30',
  end: '13:45',
  location: taronga,
  booking: booking(
    'bkg_taronga',
    'Taronga Zoo Sydney',
    'Not booked. Online tickets are dated. Keeper talks and the seal show run to a published timetable - ' +
      'plan the morning around one or two of them.',
  ),
})
act({
  id: 'act_taronga_lunch',
  day: 10,
  title: 'Lunch at the zoo',
  category: 'food',
  start: '13:45',
  end: '14:30',
  location: taronga,
})
act({
  id: 'act_to_balmoral',
  day: 10,
  title: 'Taronga to Balmoral',
  category: 'transport',
  start: '15:00',
  end: '15:30',
  transport: transport('trn_to_balmoral', 'bus', 'Taronga Zoo', 'Balmoral Beach', {
    notes: 'The 238 from Bradleys Head Rd, or a short taxi - about 4 km.',
  }),
})
act({
  id: 'act_balmoral',
  day: 10,
  title: 'Balmoral Beach',
  category: 'beach',
  start: '15:45',
  end: '17:00',
  location: balmoral,
  notes: 'Harbour beach with a netted swimming enclosure - flat water, no surf.',
})
act({
  id: 'act_balmoral_play',
  day: 10,
  title: 'Balmoral playground',
  category: 'activity',
  start: '17:15',
  end: '18:00',
  location: balmoralPlay,
})
act({
  id: 'act_bathers',
  day: 10,
  title: 'Dinner at The Bathers\' Pavilion',
  category: 'food',
  start: '18:15',
  end: '19:45',
  location: bathers,
  booking: booking(
    'bkg_bathers',
    'The Bathers\' Pavilion',
    'Not booked. There is a formal restaurant and a more relaxed cafe next door - the cafe is the one that ' +
      'works with a child at this hour.',
  ),
})
act({
  id: 'act_endeavour',
  day: 10,
  title: 'Endeavour Tap Rooms',
  category: 'food',
  anchorNote: 'Only if you go back through The Rocks',
  duration: 60,
  location: endeavour,
  optional: true,
  notes: 'It is in The Rocks, a long way back from Balmoral. Easy to skip.',
})

/* --------------------------------------------------------------- Day 12 */

act({
  id: 'act_bridge_walk',
  day: 11,
  title: 'Walk across the Sydney Harbour Bridge',
  category: 'walking',
  start: '09:30',
  end: '10:45',
  location: bridgeWalk,
  notes:
    'Pedestrian path is the eastern side - stairs up from Cumberland St in The Rocks, or the Bridge Stairs ' +
    'at Milsons Point from the north. About 25 minutes each way at a walking pace.',
})
act({
  id: 'act_pylon',
  day: 11,
  title: 'Pylon Lookout + Bridge Museum',
  category: 'museum',
  start: '11:00',
  end: '12:00',
  location: pylon,
  notes: '200 steps to the top, no lift. Small entry fee, cash not needed.',
})
act({
  id: 'act_mca_lunch',
  day: 11,
  title: 'Lunch at the MCA Cafe',
  category: 'food',
  start: '12:30',
  end: '13:45',
  location: mca,
  notes: 'Level 4 terrace looks straight at the Opera House.',
})
act({
  id: 'act_mca',
  day: 11,
  title: 'Museum of Contemporary Art',
  category: 'museum',
  start: '13:45',
  end: '15:00',
  location: mca,
  notes: 'Free general entry.',
})
act({
  id: 'act_quay_free',
  day: 11,
  title: 'Circular Quay and the Opera House forecourt',
  category: 'freeTime',
  start: '16:45',
  end: '18:00',
  location: circularQuay,
})
act({
  id: 'act_opera_tour',
  day: 11,
  title: 'Sydney Opera House tour',
  category: 'culture',
  start: '15:30',
  end: '16:30',
  location: opera,
  booking: booking(
    'bkg_opera',
    'Sydney Opera House',
    'Not booked. The one-hour building tour runs through the day. If something family-friendly is on in ' +
      'the Concert Hall that evening, a performance is the better birthday version - check the calendar first.',
  ),
  notes: 'The interior was the gap in the original plan. A show would replace this if the calendar allows.',
})
act({
  id: 'act_claudia_birthday',
  day: 11,
  title: 'Cl\u00e1udia\'s birthday - harbour dinner cruise',
  category: 'event',
  start: '19:00',
  end: '21:00',
  location: capCook,
  booking: booking(
    'bkg_cruise',
    'Captain Cook Cruises',
    'Not booked. Alternatives in Ideas: the Clearview glass boat, Bennelong at the Opera House, or an ' +
      'Opera House performance. Whichever it is, book early - peak school-holiday week.',
  ),
  notes: 'Bridge lit up from the water. Boarding is usually 20 minutes before departure.',
})

/* --------------------------------------------------------------- Day 13 */

act({
  id: 'act_checkout',
  day: 12,
  title: 'Check out, leave the bags with the hotel',
  category: 'accommodation',
  start: '08:00',
  end: '08:30',
  stay: 'stay_sydney',
  notes: 'Confirm the day before that they will hold luggage until the evening.',
})
act({
  id: 'act_bondi',
  day: 12,
  title: 'Bondi Beach',
  category: 'beach',
  start: '09:00',
  end: '10:45',
  location: bondi,
})
act({
  id: 'act_bondi_walk',
  day: 12,
  title: 'Bondi to Tamarama section',
  category: 'walking',
  start: '11:00',
  end: '12:00',
  location: bondiWalk,
  optional: true,
  notes:
    'The prettiest stretch, about 25 minutes each way past the Icebergs. The full Bondi-Coogee walk is 6 km ' +
    'and too much on a departure day - it is in Ideas if you would rather trade something for it.',
})
act({
  id: 'act_newtown_lunch',
  day: 12,
  title: 'Lunch in Newtown - King St',
  category: 'food',
  start: '12:45',
  end: '14:00',
  location: newtown,
})
act({
  id: 'act_newtown_art',
  day: 12,
  title: 'Newtown street art',
  category: 'culture',
  start: '14:00',
  end: '14:45',
  location: newtown,
  notes: 'The I Have a Dream mural is on the wall by Newtown station; the lanes off King St have the rest.',
})
act({
  id: 'act_to_quay',
  day: 12,
  title: 'Newtown to Circular Quay',
  category: 'transport',
  start: '15:00',
  end: '15:30',
  transport: transport('trn_to_quay', 'train', 'Newtown', 'Circular Quay'),
})
act({
  id: 'act_ferry_watsons',
  day: 12,
  title: 'Ferry to Watsons Bay',
  category: 'transport',
  start: '15:45',
  end: '16:15',
  location: circularQuay,
  transport: transport('trn_ferry_watsons', 'ferry', 'Circular Quay', 'Watsons Bay', {
    notes: 'About 25 minutes. Check the last return service before you board - they thin out in the evening.',
  }),
})
act({
  id: 'act_robertson',
  day: 12,
  title: 'Robertson Park',
  category: 'nature',
  start: '16:30',
  end: '17:00',
  location: robertson,
})
act({
  id: 'act_the_gap',
  day: 12,
  title: 'The Gap + South Head',
  category: 'nature',
  start: '17:15',
  end: '18:00',
  location: theGap,
  notes: 'Ocean cliffs on one side, harbour on the other. Hornby Lighthouse is 20 minutes further out.',
})
act({
  id: 'act_doyles',
  day: 12,
  title: 'Doyles - fish and chips by the water',
  category: 'food',
  start: '18:15',
  end: '19:30',
  location: doyles,
  notes: 'Sunset about 18:32 over the city skyline. The takeaway kiosk by the wharf is the cheaper version.',
})
act({
  id: 'act_ferry_back_final',
  day: 12,
  title: 'Ferry back to Circular Quay',
  category: 'transport',
  start: '19:45',
  end: '20:15',
  location: watsonsWharf,
  transport: transport('trn_ferry_back_final', 'ferry', 'Watsons Bay', 'Circular Quay'),
})
act({
  id: 'act_bags',
  day: 12,
  title: 'Collect the bags',
  category: 'other',
  anchorNote: 'Straight off the ferry',
  duration: 30,
})
act({
  id: 'act_transfer_out',
  day: 12,
  title: 'Transfer to Sydney Airport',
  category: 'transport',
  anchorNote: 'After the bags',
  duration: 45,
  location: syd,
  transport: transport('trn_transfer_out', 'car', 'City', 'Sydney Airport (SYD)', {
    notes: '30-45 minutes depending on traffic. Pre-book a maxi taxi if there are more than four of you.',
  }),
})
act({
  id: 'act_depart',
  day: 12,
  title: 'Departure flight',
  category: 'flight',
  dayPart: 'evening',
  duration: 120,
  location: syd,
  booking: 'bkg_flights',
  transport: transport('trn_depart', 'flight', 'Sydney (SYD)', 'Home', {
    notes: 'Fill in the real flight number and time - the whole shape of Day 13 depends on it.',
  }),
  notes:
    'International check-in closes 60-90 minutes before departure. If this flight leaves before about ' +
    '21:00, cut Watsons Bay and go straight to the airport after Newtown.',
})

/* ----------------------------------------------------------------- Ideas */

act({
  id: 'idea_pebbly',
  day: null,
  title: 'Pebbly Beach - kangaroos on the sand',
  category: 'nature',
  duration: 660,
  location: pebbly,
  description: 'Murramarang National Park, south coast. Wild eastern grey kangaroos on the beach.',
  notes:
    'About 275 km and three and a half hours each way - a whole day for one sight, and the least defensible ' +
    'of the three swaps. Only worth it if wild kangaroos in a natural setting are a priority; Featherdale ' +
    'already covers hand-feeding.',
})
act({
  id: 'idea_royal_np',
  day: null,
  title: 'Royal National Park day',
  category: 'nature',
  duration: 480,
  location: royalNp,
  description: 'Audley, Wattamolla and the coast track. The second national park in the world.',
  notes:
    'About an hour each way. The best swap for Day 7 if you would rather have bush and coast than another ' +
    'set of neighbourhoods. Figure Eight Pools only at low tide and only in a small swell - check the NPWS ' +
    'safety page the morning of, people get hurt there.',
})
act({
  id: 'idea_northern_beaches',
  day: null,
  title: 'Palm Beach + Barrenjoey Lighthouse',
  category: 'beach',
  duration: 480,
  location: palmBeach,
  description: 'Palm Beach, the Barrenjoey headland, then Whale Beach and Avalon on the way back.',
  notes:
    'The strongest of the three optional swaps and the intended replacement for Day 7. About 75 minutes by ' +
    'car, no train. The lighthouse track is 30-40 minutes up and steep - a carrier for the little one.',
})
act({
  id: 'idea_barrenjoey',
  day: null,
  title: 'Barrenjoey Lighthouse track',
  category: 'walking',
  duration: 120,
  location: barrenjoey,
  notes: 'Part of the Northern Beaches day. Smugglers Track is steeper and shorter; Access Trail is easier.',
})
act({
  id: 'idea_spit_walk',
  day: null,
  title: 'Manly to Spit Bridge walk',
  category: 'walking',
  duration: 240,
  location: spitBridge,
  description: '10 km harbour walk through Dobroyd Head with Aboriginal engravings on the way.',
  notes: 'Walk it Spit-to-Manly and finish with the ferry. Too long with a small child unless someone carries.',
})
act({
  id: 'idea_bondi_coogee',
  day: null,
  title: 'Full Bondi to Coogee coastal walk',
  category: 'walking',
  duration: 180,
  location: coogee,
  notes: '6 km, two hours at a stroll, no shade. Day 13 has the Bondi-Tamarama section instead.',
})
act({
  id: 'idea_bridgeclimb',
  day: null,
  title: 'BridgeClimb',
  category: 'activity',
  duration: 210,
  location: bridgeWalk,
  notes:
    'The alternative to the Day 12 walk plus Pylon Lookout. Minimum age is 8 for the Sydney Climb, so check ' +
    'before booking. Dawn and twilight slots cost more and are worth it.',
})
act({
  id: 'idea_sydney_uni',
  day: null,
  title: 'University of Sydney Quadrangle',
  category: 'culture',
  duration: 45,
  location: sydneyUni,
  notes: 'Ten minutes from Newtown or Glebe - easy to bolt onto either. Sandstone gothic, free to walk in.',
})
act({
  id: 'idea_o_bar',
  day: null,
  title: 'O Bar and Dining',
  category: 'food',
  duration: 150,
  location: oBar,
  notes: 'Birthday alternative. Revolving restaurant on level 47 - a full turn takes about 90 minutes.',
})
act({
  id: 'idea_infinity',
  day: null,
  title: 'Infinity at Sydney Tower',
  category: 'food',
  duration: 150,
  location: sydneyTower,
  notes: 'Birthday alternative, and it pairs with the Day 3 tower visit if you would rather double up.',
})
act({
  id: 'idea_bennelong',
  day: null,
  title: 'Bennelong at the Opera House',
  category: 'food',
  duration: 150,
  location: opera,
  notes: 'Birthday alternative - inside the smaller shell. Books out furthest ahead of the three.',
})
act({
  id: 'idea_clearview',
  day: null,
  title: 'Clearview glass boat cruise',
  category: 'event',
  duration: 150,
  location: capCook,
  notes: 'Birthday alternative to the Captain Cook cruise - glass roof, so better on a clear night.',
})
act({
  id: 'idea_opera_show',
  day: null,
  title: 'Performance at the Opera House',
  category: 'event',
  duration: 180,
  location: opera,
  notes:
    'Check the calendar for the trip dates. A family-friendly matinee or an early evening show would ' +
    'replace the Day 12 tour outright.',
})

/* ----------------------------------------------------------------- write */

const outDir = resolve(ROOT, 'public', 'trips')
mkdirSync(outDir, { recursive: true })
const outFile = resolve(outDir, 'sydney-2026.json')
writeFileSync(outFile, JSON.stringify(data, null, 2) + '\n', 'utf8')

const scheduled = Object.values(data.activities).filter((a) => a.dayId)
console.log('Wrote ' + outFile)
console.log(
  DATES.length +
    ' days, ' +
    scheduled.length +
    ' scheduled activities, ' +
    (Object.keys(data.activities).length - scheduled.length) +
    ' ideas, ' +
    Object.keys(data.locations).length +
    ' locations, ' +
    Object.keys(data.bookings).length +
    ' bookings.',
)
