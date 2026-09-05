import type {
  Accommodation,
  Activity,
  ActivityCategory,
  Booking,
  DateStr,
  DayPart,
  ID,
  Location,
  OpeningHours,
  TimePrecision,
  Transport,
  TransportMode,
  TripData,
} from '@/domain/types'
import { emptyData } from '@/domain/types'
import { dateRange } from '@/domain/time'

/**
 * The demo trip: 14 days in Japan.
 *
 * Deliberately imperfect — it contains a tight connection, a museum booked on
 * its closing day, an over-full day and an unbooked night, so the warning
 * system has something real to say on first launch. Ids are deterministic to
 * keep re-seeding stable.
 */

const START: DateStr = '2027-03-12'
const END: DateStr = '2027-03-25'
const TRIP: ID = 'trip_japan_2027'
const STAMP = '2027-01-08T10:00:00.000Z'

const d = (offset: number): DateStr => dateRange(START, END)[offset]

/** Day ids are derived from the date so activities can reference them directly. */
const dayId = (offset: number): ID => `day_${d(offset)}`

interface Seed {
  data: TripData
  order: number
}

function makeLocation(
  s: Seed,
  id: ID,
  name: string,
  lat: number,
  lng: number,
  extra: Partial<Location> = {},
): ID {
  s.data.locations[id] = { id, tripId: TRIP, name, lat, lng, ...extra }
  return id
}

interface ActivitySeed {
  id: ID
  day: number | null
  title: string
  category: ActivityCategory
  start?: string
  end?: string
  precision?: TimePrecision
  dayPart?: DayPart
  anchorNote?: string
  duration?: number
  location?: ID
  notes?: string
  description?: string
  cost?: number
  optional?: boolean
  transport?: Transport
  booking?: Omit<Booking, 'id' | 'tripId'> & { id: ID }
  accommodationId?: ID
  phone?: string
  links?: { label: string; url: string }[]
}

function addActivity(s: Seed, seed: ActivitySeed): Activity {
  let bookingId: ID | undefined
  if (seed.booking) {
    const { id, ...rest } = seed.booking
    s.data.bookings[id] = { id, tripId: TRIP, ...rest }
    bookingId = id
  }
  if (seed.transport) {
    s.data.transports[seed.transport.id] = seed.transport
  }

  const precision: TimePrecision =
    seed.precision ??
    (seed.start ? 'exact' : seed.dayPart ? 'dayPart' : seed.day === null ? 'unscheduled' : 'flexible')

  const activity: Activity = {
    id: seed.id,
    tripId: TRIP,
    dayId: seed.day === null ? null : dayId(seed.day),
    order: (s.order += 10),
    title: seed.title,
    description: seed.description,
    category: seed.category,
    timePrecision: precision,
    startTime: seed.start,
    endTime: seed.end,
    dayPart: seed.dayPart,
    anchorNote: seed.anchorNote,
    durationMin: seed.duration,
    locationId: seed.location,
    cost: seed.cost,
    currency: seed.cost != null ? 'JPY' : undefined,
    bookingId,
    transportId: seed.transport?.id,
    accommodationId: seed.accommodationId,
    phone: seed.phone,
    notes: seed.notes,
    links: (seed.links ?? []).map((l, i) => ({ id: `${seed.id}_link${i}`, ...l })),
    attachments: [],
    status: 'planned',
    optional: seed.optional ?? false,
    createdAt: STAMP,
    updatedAt: STAMP,
  }
  s.data.activities[activity.id] = activity
  return activity
}

function transport(
  id: ID,
  mode: TransportMode,
  fromLabel: string,
  toLabel: string,
  extra: Partial<Transport> = {},
): Transport {
  return { id, tripId: TRIP, mode, fromLabel, toLabel, ...extra }
}

function addStay(s: Seed, stay: Omit<Accommodation, 'tripId'>): ID {
  s.data.accommodations[stay.id] = { ...stay, tripId: TRIP }
  return stay.id
}

/** Weekly hours, `null` = closed. */
function hours(spec: Partial<Record<number, [string, string] | null>>): OpeningHours {
  const out: OpeningHours = {}
  for (let i = 0; i < 7; i++) {
    const v = spec[i]
    out[i] = v === null ? null : v ? { open: v[0], close: v[1] } : { open: '09:00', close: '18:00' }
  }
  return out
}

export function buildDemoTrip(): TripData {
  const s: Seed = { data: emptyData(), order: 0 }

  s.data.trips[TRIP] = {
    id: TRIP,
    name: 'Japan 2027',
    startDate: START,
    endDate: END,
    destinations: ['Tokyo', 'Kyoto', 'Osaka', 'Okinawa'],
    description:
      'Two weeks from the neon of Tokyo down to the reefs of Okinawa. Cherry blossom season, so the pace stays loose.',
    coverImage: 'atlas:dusk',
    baseCurrency: 'JPY',
    createdAt: STAMP,
    updatedAt: STAMP,
  }

  /* ------------------------------------------------------------ days */

  const dayMeta: { place: string; headline?: string }[] = [
    { place: 'Tokyo', headline: 'Arrival + Shinjuku night' },
    { place: 'Tokyo', headline: 'Tokyo exploration' },
    { place: 'Tokyo', headline: 'Markets + Ginza' },
    { place: 'Tokyo', headline: 'Museums + Asakusa' },
    { place: 'Tokyo → Kyoto', headline: 'Shinkansen south' },
    { place: 'Kyoto', headline: 'Temple day' },
    { place: 'Kyoto', headline: 'Food + Gion' },
    { place: 'Kyoto', headline: 'Arashiyama + travel to Osaka' },
    { place: 'Osaka', headline: 'Castle + Dotonbori' },
    { place: 'Osaka → Okinawa', headline: 'Fly to the islands' },
    { place: 'Okinawa', headline: 'Beach day' },
    { place: 'Okinawa', headline: 'Churaumi + north coast' },
    { place: 'Okinawa' },
    { place: 'Okinawa → home', headline: 'Departure' },
  ]

  dateRange(START, END).forEach((date, i) => {
    s.data.days[`day_${date}`] = {
      id: `day_${date}`,
      tripId: TRIP,
      date,
      locationLabel: dayMeta[i]?.place,
      headline: dayMeta[i]?.headline,
    }
  })

  /* ------------------------------------------------------- locations */

  const haneda = makeLocation(s, 'loc_haneda', 'Haneda Airport (HND)', 35.5494, 139.7798, {
    address: 'Ota City, Tokyo',
  })
  const hotelShinjuku = makeLocation(s, 'loc_hotel_tokyo', 'Hotel Kaigan Shinjuku', 35.6938, 139.7036, {
    address: '3-15-2 Nishi-Shinjuku, Shinjuku City, Tokyo',
    phone: '+81 3 5321 0000',
  })
  const omoide = makeLocation(s, 'loc_omoide', 'Omoide Yokocho', 35.6936, 139.6995, {
    address: '1-2 Nishishinjuku, Shinjuku City',
  })
  const meiji = makeLocation(s, 'loc_meiji', 'Meiji Jingu', 35.6764, 139.6993, {
    address: '1-1 Yoyogikamizonocho, Shibuya City',
    openingHours: hours({ 0: ['05:20', '17:20'], 1: ['05:20', '17:20'], 2: ['05:20', '17:20'], 3: ['05:20', '17:20'], 4: ['05:20', '17:20'], 5: ['05:20', '17:20'], 6: ['05:20', '17:20'] }),
  })
  const shibuya = makeLocation(s, 'loc_shibuya', 'Shibuya Crossing', 35.6595, 139.7005)
  const tsukiji = makeLocation(s, 'loc_tsukiji', 'Tsukiji Outer Market', 35.6654, 139.7707, {
    openingHours: hours({ 0: null, 1: ['05:00', '14:00'], 2: ['05:00', '14:00'], 3: ['05:00', '14:00'], 4: ['05:00', '14:00'], 5: ['05:00', '14:00'], 6: ['05:00', '14:00'] }),
  })
  const ginza = makeLocation(s, 'loc_ginza', 'Ginza', 35.6717, 139.765)
  const teamlab = makeLocation(s, 'loc_teamlab', 'teamLab Planets', 35.6486, 139.7906, {
    address: '6-1-16 Toyosu, Koto City',
    url: 'https://www.teamlab.art/e/planets/',
  })
  const sensoji = makeLocation(s, 'loc_sensoji', 'Sensō-ji', 35.7148, 139.7967, {
    address: '2-3-1 Asakusa, Taito City',
  })
  const tnm = makeLocation(s, 'loc_tnm', 'Tokyo National Museum', 35.7188, 139.7766, {
    address: '13-9 Uenokoen, Taito City',
    // Closed Mondays — the demo books it on a Monday on purpose.
    openingHours: hours({ 1: null }),
  })
  const uenoPark = makeLocation(s, 'loc_ueno', 'Ueno Park', 35.7156, 139.7745)
  const tokyoStation = makeLocation(s, 'loc_tokyo_station', 'Tokyo Station', 35.6812, 139.7671)

  const kyotoStation = makeLocation(s, 'loc_kyoto_station', 'Kyoto Station', 34.9858, 135.7588)
  const ryokan = makeLocation(s, 'loc_ryokan', 'Ryokan Sanjo', 35.0037, 135.7788, {
    address: 'Nakagyo Ward, Kyoto',
    phone: '+81 75 221 0000',
  })
  const fushimi = makeLocation(s, 'loc_fushimi', 'Fushimi Inari Taisha', 34.9671, 135.7727, {
    address: '68 Fukakusa Yabunouchicho, Fushimi Ward',
  })
  const kiyomizu = makeLocation(s, 'loc_kiyomizu', 'Kiyomizu-dera', 34.9949, 135.785, {
    openingHours: hours({}),
  })
  const nishiki = makeLocation(s, 'loc_nishiki', 'Nishiki Market', 35.005, 135.7649)
  const gion = makeLocation(s, 'loc_gion', 'Gion Hanamikoji', 35.0036, 135.7752)
  const arashiyama = makeLocation(s, 'loc_arashiyama', 'Arashiyama Bamboo Grove', 35.017, 135.6716)
  const kinkakuji = makeLocation(s, 'loc_kinkakuji', 'Kinkaku-ji', 35.0394, 135.7292)
  const ramenKyoto = makeLocation(s, 'loc_ramen_kyoto', 'Menya Inoichi', 35.0028, 135.7615)

  const osakaStation = makeLocation(s, 'loc_osaka_station', 'Shin-Osaka Station', 34.7335, 135.5003)
  const hotelNamba = makeLocation(s, 'loc_hotel_osaka', 'Namba Base Hotel', 34.665, 135.502, {
    address: 'Chuo Ward, Osaka',
    phone: '+81 6 6211 0000',
  })
  const dotonbori = makeLocation(s, 'loc_dotonbori', 'Dotonbori', 34.6687, 135.5013)
  const osakaCastle = makeLocation(s, 'loc_osaka_castle', 'Osaka Castle', 34.6873, 135.5259, {
    openingHours: hours({}),
  })
  const kuromon = makeLocation(s, 'loc_kuromon', 'Kuromon Market', 34.6647, 135.5061)
  const itami = makeLocation(s, 'loc_itami', 'Osaka Itami Airport (ITM)', 34.7855, 135.4382)

  const naha = makeLocation(s, 'loc_naha', 'Naha Airport (OKA)', 26.1958, 127.6458)
  const resort = makeLocation(s, 'loc_resort', 'Cape Zanpa Resort', 26.4409, 127.7157, {
    address: 'Yomitan, Okinawa',
    phone: '+81 98 958 0000',
  })
  const churaumi = makeLocation(s, 'loc_churaumi', 'Churaumi Aquarium', 26.6941, 127.8779, {
    openingHours: hours({}),
  })
  const emerald = makeLocation(s, 'loc_emerald', 'Emerald Beach', 26.696, 127.877)
  const kouri = makeLocation(s, 'loc_kouri', 'Kouri Island', 26.705, 128.017)
  const shuri = makeLocation(s, 'loc_shuri', 'Shurijo Castle Park', 26.217, 127.7194)

  /* --------------------------------------------------- accommodation */

  const stayTokyo = addStay(s, {
    id: 'stay_tokyo',
    name: 'Hotel Kaigan Shinjuku',
    locationId: hotelShinjuku,
    address: '3-15-2 Nishi-Shinjuku, Shinjuku City, Tokyo',
    phone: '+81 3 5321 0000',
    checkInDate: d(0),
    checkInTime: '15:00',
    checkOutDate: d(4),
    checkOutTime: '11:00',
    cost: 148000,
    currency: 'JPY',
    bookingId: 'bkg_hotel_tokyo',
    url: 'https://example.com/bookings/kaigan',
    notes: 'Room on a high floor, west side. Luggage forwarding desk in the lobby.',
  })
  s.data.bookings['bkg_hotel_tokyo'] = {
    id: 'bkg_hotel_tokyo',
    tripId: TRIP,
    reference: 'HK-88213-JP',
    provider: 'Hotel direct',
    url: 'https://example.com/bookings/kaigan',
    cost: 148000,
    currency: 'JPY',
    status: 'confirmed',
  }

  const stayKyoto = addStay(s, {
    id: 'stay_kyoto',
    name: 'Ryokan Sanjo',
    locationId: ryokan,
    address: 'Nakagyo Ward, Kyoto',
    phone: '+81 75 221 0000',
    checkInDate: d(4),
    checkInTime: '16:00',
    checkOutDate: d(7),
    checkOutTime: '10:00',
    cost: 132000,
    currency: 'JPY',
    bookingId: 'bkg_ryokan',
    notes: 'Tatami room with breakfast. Doors lock at 23:00 — take the side entrance code.',
  })
  s.data.bookings['bkg_ryokan'] = {
    id: 'bkg_ryokan',
    tripId: TRIP,
    reference: 'RS-4471',
    provider: 'Ryokan direct',
    cost: 132000,
    currency: 'JPY',
    status: 'confirmed',
  }

  // Only the first Osaka night is booked — the second is deliberately missing.
  const stayOsaka = addStay(s, {
    id: 'stay_osaka',
    name: 'Namba Base Hotel',
    locationId: hotelNamba,
    address: 'Chuo Ward, Osaka',
    phone: '+81 6 6211 0000',
    checkInDate: d(7),
    checkInTime: '15:00',
    checkOutDate: d(8),
    checkOutTime: '11:00',
    cost: 21000,
    currency: 'JPY',
    bookingId: 'bkg_osaka',
    notes: 'Second night not booked yet — decide after seeing the castle.',
  })
  s.data.bookings['bkg_osaka'] = {
    id: 'bkg_osaka',
    tripId: TRIP,
    reference: 'NB-9932',
    provider: 'Booking site',
    cost: 21000,
    currency: 'JPY',
    status: 'confirmed',
  }

  const stayOkinawa = addStay(s, {
    id: 'stay_okinawa',
    name: 'Cape Zanpa Resort',
    locationId: resort,
    address: 'Yomitan, Okinawa',
    phone: '+81 98 958 0000',
    checkInDate: d(9),
    checkInTime: '15:00',
    checkOutDate: d(13),
    checkOutTime: '11:00',
    cost: 196000,
    currency: 'JPY',
    bookingId: 'bkg_okinawa',
    url: 'https://example.com/bookings/zanpa',
    notes: 'Sea-view room, rental car included from day two.',
  })
  s.data.bookings['bkg_okinawa'] = {
    id: 'bkg_okinawa',
    tripId: TRIP,
    reference: 'CZ-20714',
    provider: 'Resort direct',
    url: 'https://example.com/bookings/zanpa',
    cost: 196000,
    currency: 'JPY',
    status: 'confirmed',
  }

  /* -------------------------------------------------- Day 1 — arrival */

  addActivity(s, {
    id: 'act_flight_in',
    day: 0,
    // The leg departs the previous evening; on this day it is an arrival, so
    // that is what the timeline shows.
    title: 'Land at Haneda (from Amsterdam)',
    category: 'flight',
    start: '08:20',
    end: '09:15',
    duration: 55,
    location: haneda,
    transport: transport('trn_in', 'flight', 'Amsterdam (AMS)', 'Tokyo Haneda (HND)', {
      carrier: 'KLM',
      vehicleNumber: 'KL 861',
      seat: '32A / 32B',
      terminal: 'Terminal 3',
      toLocationId: haneda,
      notes: 'Departs Amsterdam 10:55 the day before, 11h25 in the air. Immigration QR codes saved offline in Bookings.',
    }),
    booking: {
      id: 'bkg_flight_in',
      reference: 'QK7T2M',
      provider: 'KLM',
      url: 'https://example.com/bookings/kl861',
      cost: 1240,
      currency: 'EUR',
      status: 'confirmed',
    },
    notes: 'Allow 45 minutes for immigration and baggage before the monorail.',
  })

  addActivity(s, {
    id: 'act_airport_train',
    day: 0,
    title: 'Monorail to Shinjuku',
    category: 'transport',
    start: '09:30',
    end: '10:30',
    location: hotelShinjuku,
    transport: transport('trn_mono', 'publicTransport', 'Haneda Airport', 'Shinjuku Station', {
      carrier: 'Tokyo Monorail + JR',
      platform: 'Monorail platform 1',
      fromLocationId: haneda,
      toLocationId: hotelShinjuku,
      notes: 'Buy the Suica card at the airport machine first.',
    }),
  })

  addActivity(s, {
    id: 'act_checkin_tokyo',
    day: 0,
    title: 'Check in — Hotel Kaigan Shinjuku',
    category: 'accommodation',
    start: '15:00',
    duration: 30,
    location: hotelShinjuku,
    accommodationId: stayTokyo,
    phone: '+81 3 5321 0000',
    notes: 'Early luggage drop is fine before 15:00.',
  })

  addActivity(s, {
    id: 'act_free_day1',
    day: 0,
    title: 'Rest and reset',
    category: 'freeTime',
    start: '11:00',
    end: '15:00',
    notes: 'Jet lag. Nothing planned on purpose.',
  })

  addActivity(s, {
    id: 'act_omoide',
    day: 0,
    title: 'Dinner at Omoide Yokocho',
    category: 'food',
    start: '19:00',
    duration: 90,
    location: omoide,
    cost: 4500,
    description: 'Yakitori alleys behind Shinjuku Station. Cash only in most stalls.',
  })

  /* ------------------------------------------------- Day 2 — Tokyo */

  addActivity(s, {
    id: 'act_meiji',
    day: 1,
    title: 'Meiji Jingu',
    category: 'culture',
    start: '09:00',
    end: '10:30',
    location: meiji,
    description: 'Forest shrine approach from Harajuku gate.',
  })

  addActivity(s, {
    id: 'act_shibuya',
    day: 1,
    title: 'Shibuya + Yoyogi walk',
    category: 'walking',
    start: '11:00',
    end: '13:00',
    location: shibuya,
  })

  addActivity(s, {
    id: 'act_lunch_shibuya',
    day: 1,
    title: 'Lunch — standing soba',
    category: 'food',
    start: '13:15',
    duration: 45,
    location: shibuya,
    cost: 1400,
  })

  addActivity(s, {
    id: 'act_teamlab',
    day: 1,
    title: 'teamLab Planets',
    category: 'event',
    start: '16:00',
    end: '18:00',
    location: teamlab,
    cost: 3800,
    booking: {
      id: 'bkg_teamlab',
      reference: 'TL-559312',
      provider: 'teamLab',
      url: 'https://www.teamlab.art/e/planets/',
      cost: 3800,
      currency: 'JPY',
      status: 'confirmed',
    },
    notes: 'Barefoot exhibit — wear shorts or roll-up trousers.',
  })

  addActivity(s, {
    id: 'act_dinner_toyosu',
    day: 1,
    title: 'Dinner in Toyosu',
    category: 'food',
    dayPart: 'evening',
    duration: 90,
    optional: true,
    description: 'Only if we still have energy after the exhibit.',
  })

  /* ------------------------------------- Day 3 — markets and Ginza */

  addActivity(s, {
    id: 'act_tsukiji',
    day: 2,
    title: 'Tsukiji Outer Market breakfast',
    category: 'food',
    start: '08:00',
    end: '10:00',
    location: tsukiji,
    cost: 3000,
    description: 'Tamagoyaki, uni, and the knife shops at the back.',
  })

  addActivity(s, {
    id: 'act_ginza',
    day: 2,
    title: 'Ginza + Itoya stationery',
    category: 'shopping',
    start: '10:45',
    end: '13:30',
    location: ginza,
  })

  addActivity(s, {
    id: 'act_free_day3',
    day: 2,
    title: 'Open afternoon',
    category: 'freeTime',
    start: '13:30',
    end: '17:00',
  })

  addActivity(s, {
    id: 'act_izakaya',
    day: 2,
    title: 'Izakaya in Ebisu',
    category: 'food',
    precision: 'relative',
    anchorNote: 'After sunset',
    duration: 120,
    cost: 6000,
  })

  /* ------------------- Day 4 — Monday: museum closed + tight hop */

  addActivity(s, {
    id: 'act_sensoji',
    day: 3,
    title: 'Sensō-ji and Nakamise',
    category: 'culture',
    start: '08:30',
    end: '10:20',
    location: sensoji,
  })

  addActivity(s, {
    id: 'act_tnm',
    day: 3,
    title: 'Tokyo National Museum',
    category: 'museum',
    start: '10:30',
    end: '13:30',
    location: tnm,
    cost: 1000,
    description: 'Honkan galleries, then the Gallery of Hōryū-ji Treasures.',
  })

  addActivity(s, {
    id: 'act_ueno_lunch',
    day: 3,
    title: 'Lunch near Ueno',
    category: 'food',
    start: '13:45',
    duration: 60,
    location: uenoPark,
    cost: 1800,
  })

  addActivity(s, {
    id: 'act_teamlab_shop',
    day: 3,
    title: 'Kappabashi kitchen street',
    category: 'shopping',
    start: '15:00',
    end: '17:00',
    location: sensoji,
    optional: true,
  })

  addActivity(s, {
    id: 'act_dinner_shinjuku',
    day: 3,
    title: 'Tonkatsu in Shinjuku',
    category: 'food',
    start: '19:00',
    duration: 90,
    location: hotelShinjuku,
    cost: 5200,
  })

  /* ------------------------------------ Day 5 — Shinkansen to Kyoto */

  addActivity(s, {
    id: 'act_checkout_tokyo',
    day: 4,
    title: 'Check out — Hotel Kaigan',
    category: 'accommodation',
    start: '11:00',
    duration: 20,
    location: hotelShinjuku,
    accommodationId: stayTokyo,
  })

  addActivity(s, {
    id: 'act_shinkansen',
    day: 4,
    title: 'Tokyo → Kyoto',
    category: 'train',
    start: '14:12',
    end: '16:24',
    location: kyotoStation,
    cost: 13320,
    transport: transport('trn_nozomi', 'train', 'Tokyo Station', 'Kyoto Station', {
      carrier: 'JR Central',
      vehicleNumber: 'Nozomi 231',
      seat: 'Car 8, seat 8A / 8B',
      platform: 'Platform 14',
      fromLocationId: tokyoStation,
      toLocationId: kyotoStation,
      notes: 'Reserved seats, right-hand side for Mount Fuji about 45 minutes in.',
    }),
    booking: {
      id: 'bkg_nozomi',
      reference: 'JR-2XK9P1',
      provider: 'JR Central',
      cost: 13320,
      currency: 'JPY',
      status: 'confirmed',
    },
    notes: 'Ekiben from the Tokyo Station platform shop before boarding.',
  })

  addActivity(s, {
    id: 'act_checkin_kyoto',
    day: 4,
    title: 'Check in — Ryokan Sanjo',
    category: 'accommodation',
    start: '17:00',
    duration: 30,
    location: ryokan,
    accommodationId: stayKyoto,
    phone: '+81 75 221 0000',
  })

  addActivity(s, {
    id: 'act_kyoto_first_dinner',
    day: 4,
    title: 'Ramen at Menya Inoichi',
    category: 'food',
    start: '19:30',
    duration: 60,
    location: ramenKyoto,
    cost: 2200,
  })

  /* ------------------------------------------ Day 6 — Kyoto temples */

  addActivity(s, {
    id: 'act_fushimi',
    day: 5,
    title: 'Fushimi Inari',
    category: 'culture',
    start: '09:00',
    end: '12:00',
    location: fushimi,
    description: 'Go early and walk past the fourth torii cluster where the crowds thin out.',
  })

  addActivity(s, {
    id: 'act_kyoto_lunch',
    day: 5,
    title: 'Lunch',
    category: 'food',
    start: '12:00',
    duration: 60,
    location: fushimi,
    cost: 1600,
  })

  addActivity(s, {
    id: 'act_kiyomizu',
    day: 5,
    title: 'Kiyomizu-dera',
    category: 'culture',
    start: '14:30',
    end: '16:30',
    location: kiyomizu,
    cost: 400,
    optional: true,
  })

  addActivity(s, {
    id: 'act_kyoto_hotel',
    day: 5,
    title: 'Back to the ryokan',
    category: 'accommodation',
    start: '17:00',
    duration: 30,
    location: ryokan,
    accommodationId: stayKyoto,
  })

  addActivity(s, {
    id: 'act_kyoto_dinner',
    day: 5,
    title: 'Kaiseki dinner',
    category: 'food',
    start: '19:30',
    end: '21:30',
    location: gion,
    cost: 18000,
    booking: {
      id: 'bkg_kaiseki',
      reference: 'GN-7781',
      provider: 'Restaurant direct',
      cost: 18000,
      currency: 'JPY',
      status: 'confirmed',
    },
    notes: 'Table for two at 19:30. Cancellation charged after 18:00 on the day.',
  })

  /* --------------------------------------- Day 7 — Kyoto food + Gion */

  addActivity(s, {
    id: 'act_nishiki',
    day: 6,
    title: 'Nishiki Market',
    category: 'food',
    start: '10:00',
    end: '12:00',
    location: nishiki,
  })

  addActivity(s, {
    id: 'act_kinkakuji',
    day: 6,
    title: 'Kinkaku-ji',
    category: 'culture',
    start: '13:30',
    end: '15:00',
    location: kinkakuji,
    cost: 500,
  })

  addActivity(s, {
    id: 'act_gion_walk',
    day: 6,
    title: 'Gion evening walk',
    category: 'walking',
    dayPart: 'evening',
    duration: 90,
    location: gion,
  })

  /* ----------------------- Day 8 — Arashiyama, then Osaka (busy day) */

  addActivity(s, {
    id: 'act_arashiyama',
    day: 7,
    title: 'Arashiyama bamboo grove',
    category: 'nature',
    start: '07:30',
    end: '09:30',
    location: arashiyama,
  })

  addActivity(s, {
    id: 'act_monkey',
    day: 7,
    title: 'Iwatayama monkey park',
    category: 'nature',
    start: '09:45',
    end: '11:30',
    location: arashiyama,
    cost: 600,
  })

  addActivity(s, {
    id: 'act_kyoto_checkout',
    day: 7,
    title: 'Collect bags + check out',
    category: 'accommodation',
    start: '12:15',
    end: '13:00',
    location: ryokan,
    accommodationId: stayKyoto,
  })

  addActivity(s, {
    id: 'act_kyoto_osaka',
    day: 7,
    title: 'Kyoto → Osaka',
    category: 'train',
    start: '13:40',
    end: '14:15',
    location: osakaStation,
    cost: 580,
    transport: transport('trn_osaka', 'train', 'Kyoto Station', 'Shin-Osaka Station', {
      carrier: 'JR West',
      vehicleNumber: 'Special Rapid',
      platform: 'Platform 4',
      fromLocationId: kyotoStation,
      toLocationId: osakaStation,
    }),
  })

  addActivity(s, {
    id: 'act_osaka_checkin',
    day: 7,
    title: 'Check in — Namba Base Hotel',
    category: 'accommodation',
    start: '15:00',
    duration: 30,
    location: hotelNamba,
    accommodationId: stayOsaka,
  })

  addActivity(s, {
    id: 'act_dotonbori',
    day: 7,
    title: 'Dotonbori at night',
    category: 'walking',
    start: '18:00',
    end: '20:00',
    location: dotonbori,
  })

  addActivity(s, {
    id: 'act_osaka_dinner',
    day: 7,
    title: 'Okonomiyaki + kushikatsu crawl',
    category: 'food',
    start: '20:00',
    end: '22:30',
    location: dotonbori,
    cost: 7000,
  })

  /* ------------------------------------------------ Day 9 — Osaka */

  addActivity(s, {
    id: 'act_kuromon',
    day: 8,
    title: 'Kuromon Market breakfast',
    category: 'food',
    start: '09:00',
    end: '10:30',
    location: kuromon,
    cost: 2500,
  })

  addActivity(s, {
    id: 'act_castle',
    day: 8,
    title: 'Osaka Castle + park',
    category: 'culture',
    start: '11:00',
    end: '14:00',
    location: osakaCastle,
    cost: 600,
  })

  addActivity(s, {
    id: 'act_osaka_free',
    day: 8,
    title: 'Umeda or back to the hotel',
    category: 'freeTime',
    start: '14:00',
    end: '18:00',
  })

  /* -------------------------------------- Day 10 — fly to Okinawa */

  addActivity(s, {
    id: 'act_to_itami',
    day: 9,
    title: 'Airport limousine bus to Itami',
    category: 'transport',
    start: '08:00',
    end: '08:50',
    location: itami,
    transport: transport('trn_bus_itami', 'bus', 'Namba OCAT', 'Itami Airport (ITM)', {
      carrier: 'Osaka Airport Transport',
      toLocationId: itami,
    }),
  })

  addActivity(s, {
    id: 'act_flight_okinawa',
    day: 9,
    title: 'Osaka → Naha',
    category: 'flight',
    start: '10:20',
    end: '12:25',
    location: naha,
    cost: 18400,
    transport: transport('trn_flight_oka', 'flight', 'Osaka Itami (ITM)', 'Naha (OKA)', {
      carrier: 'ANA',
      vehicleNumber: 'NH 1731',
      seat: '14C / 14D',
      terminal: 'Domestic terminal',
      fromLocationId: itami,
      toLocationId: naha,
    }),
    booking: {
      id: 'bkg_flight_oka',
      reference: 'ANA-5R3TQ',
      provider: 'ANA',
      cost: 18400,
      currency: 'JPY',
      status: 'confirmed',
    },
  })

  addActivity(s, {
    id: 'act_rental_car',
    day: 9,
    title: 'Pick up rental car',
    category: 'driving',
    start: '13:00',
    end: '13:45',
    location: naha,
    cost: 32000,
    transport: transport('trn_car', 'rentalCar', 'Naha Airport', 'Cape Zanpa Resort', {
      carrier: 'OTS Rent-a-Car',
      fromLocationId: naha,
      toLocationId: resort,
      notes: 'International driving permit required. ETC card included.',
    }),
    booking: {
      id: 'bkg_car',
      reference: 'OTS-77120',
      provider: 'OTS Rent-a-Car',
      cost: 32000,
      currency: 'JPY',
      status: 'confirmed',
    },
  })

  addActivity(s, {
    id: 'act_okinawa_checkin',
    day: 9,
    title: 'Check in — Cape Zanpa Resort',
    category: 'accommodation',
    start: '15:30',
    duration: 30,
    location: resort,
    accommodationId: stayOkinawa,
    phone: '+81 98 958 0000',
  })

  /* ----------------------------------------------- Day 11 — beach */

  addActivity(s, {
    id: 'act_beach',
    day: 10,
    title: 'Beach morning',
    category: 'beach',
    start: '10:00',
    end: '13:00',
    location: resort,
  })

  addActivity(s, {
    id: 'act_beach_lunch',
    day: 10,
    title: 'Lunch at the beach shack',
    category: 'food',
    start: '13:15',
    duration: 60,
    location: resort,
    cost: 2400,
  })

  addActivity(s, {
    id: 'act_zanpa_sunset',
    day: 10,
    title: 'Cape Zanpa sunset',
    category: 'nature',
    precision: 'approximate',
    start: '18:30',
    duration: 60,
    location: resort,
  })

  /* --------------------------------- Day 12 — Churaumi + north */

  addActivity(s, {
    id: 'act_drive_north',
    day: 11,
    title: 'Drive up the west coast',
    category: 'driving',
    start: '09:00',
    end: '10:30',
    location: churaumi,
    transport: transport('trn_drive_north', 'car', 'Cape Zanpa Resort', 'Churaumi Aquarium', {
      fromLocationId: resort,
      toLocationId: churaumi,
      notes: 'Route 58 north, then the expressway from Kyoda.',
    }),
  })

  addActivity(s, {
    id: 'act_churaumi',
    day: 11,
    title: 'Churaumi Aquarium',
    category: 'activity',
    start: '10:30',
    end: '13:30',
    location: churaumi,
    cost: 2180,
    booking: {
      id: 'bkg_churaumi',
      reference: 'CH-31882',
      provider: 'Okinawa Churaumi',
      cost: 2180,
      currency: 'JPY',
      status: 'confirmed',
    },
  })

  addActivity(s, {
    id: 'act_emerald',
    day: 11,
    title: 'Emerald Beach',
    category: 'beach',
    // Ten minutes to leave the aquarium and change — deliberately tight, so
    // the connection check has something honest to catch.
    start: '13:40',
    end: '15:30',
    location: emerald,
  })

  addActivity(s, {
    id: 'act_kouri',
    day: 11,
    title: 'Kouri Island bridge',
    category: 'nature',
    start: '16:00',
    end: '17:30',
    location: kouri,
    optional: true,
  })

  /* ----------------------------- Day 13 — deliberately unplanned */

  addActivity(s, {
    id: 'act_free_day13',
    day: 12,
    title: 'Unplanned',
    category: 'freeTime',
    precision: 'flexible',
    notes: 'Kept open on purpose — snorkelling if the sea is calm, otherwise Naha.',
  })

  /* ----------------------------------------------- Day 14 — home */

  addActivity(s, {
    id: 'act_shuri',
    day: 13,
    title: 'Shurijo Castle Park',
    category: 'culture',
    start: '09:00',
    end: '10:30',
    location: shuri,
    optional: true,
  })

  addActivity(s, {
    id: 'act_car_return',
    day: 13,
    title: 'Return rental car',
    category: 'driving',
    start: '11:30',
    end: '12:15',
    location: naha,
    transport: transport('trn_car_return', 'rentalCar', 'Naha city', 'Naha Airport', {
      carrier: 'OTS Rent-a-Car',
      toLocationId: naha,
      notes: 'Refuel at the stand before the airport turn-off.',
    }),
  })

  addActivity(s, {
    id: 'act_flight_home',
    day: 13,
    title: 'Naha → Tokyo → Amsterdam',
    category: 'flight',
    start: '14:35',
    duration: 18 * 60,
    location: naha,
    transport: transport('trn_home', 'flight', 'Naha (OKA)', 'Amsterdam (AMS)', {
      carrier: 'ANA / KLM',
      vehicleNumber: 'NH 1088 → KL 862',
      seat: '21A / 21B',
      fromLocationId: naha,
      notes: 'Three hour connection at Haneda. Terminal change to international.',
    }),
    booking: {
      id: 'bkg_flight_home',
      reference: 'QK7T2M',
      provider: 'KLM',
      cost: 0,
      currency: 'EUR',
      status: 'confirmed',
    },
  })

  /* ------------------------------------------------------- ideas */

  const ideas: ActivitySeed[] = [
    {
      id: 'idea_golden_gai',
      day: null,
      title: 'Golden Gai bar hop',
      category: 'event',
      location: omoide,
      duration: 120,
      notes: 'Some bars charge a seating fee. Cash.',
    },
    {
      id: 'idea_sushi',
      day: null,
      title: 'Sushi counter in Toyosu',
      category: 'food',
      location: tsukiji,
      duration: 90,
      cost: 12000,
      notes: 'Needs booking about a month ahead.',
    },
    {
      id: 'idea_nara',
      day: null,
      title: 'Nara day trip',
      category: 'culture',
      duration: 360,
      description: 'Todai-ji and the deer park. About 45 minutes from Kyoto.',
    },
    {
      id: 'idea_onsen',
      day: null,
      title: 'Onsen afternoon',
      category: 'activity',
      duration: 150,
      notes: 'Check tattoo policy first.',
    },
    {
      id: 'idea_snorkel',
      day: null,
      title: 'Blue Cave snorkelling',
      category: 'beach',
      location: resort,
      duration: 180,
      cost: 6500,
      description: 'Morning slots have the calmest water.',
    },
    {
      id: 'idea_teamlab_borderless',
      day: null,
      title: 'Kyoto Railway Museum',
      category: 'museum',
      location: kyotoStation,
      duration: 120,
      optional: true,
    },
  ]
  for (const idea of ideas) addActivity(s, idea)

  return s.data
}
