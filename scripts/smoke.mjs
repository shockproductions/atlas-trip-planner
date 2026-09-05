/**
 * Browser smoke test.
 *
 * Drives the built app in a real browser through the workflows that matter:
 * the demo loads, the planner opens a day, an activity can be created and
 * edited, an idea can be dragged onto a day, the map renders pins, travel mode
 * works, and everything survives a reload (offline persistence).
 *
 * Usage: node scripts/smoke.mjs [--headful] [--shots]
 */

import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync } from 'node:fs'
import { createServer } from 'vite'

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => existsSync(p))

const HEADFUL = process.argv.includes('--headful')
const SHOTS = process.argv.includes('--shots')
const SHOT_DIR = 'screenshots'

let passed = 0
const failures = []

async function check(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ok   ${name}`)
  } catch (error) {
    failures.push({ name, error })
    console.log(`  FAIL ${name}\n       ${error.message.split('\n')[0]}`)
  }
}

const assert = (cond, message) => {
  if (!cond) throw new Error(message)
}

/** The trip id in the current hash route, else the stored active trip. */
async function currentTripId(page) {
  const match = /#\/trip\/([^/]+)/.exec(page.url())
  if (match) return match[1]
  return page.evaluate(() => {
    const raw = localStorage.getItem('atlas:setting:activeTripId')
    return raw ? JSON.parse(raw) : ''
  })
}

async function textOf(page, selector) {
  return page.$eval(selector, (el) => el.textContent?.trim() ?? '')
}

async function shot(page, name) {
  if (!SHOTS) return
  if (!existsSync(SHOT_DIR)) mkdirSync(SHOT_DIR)
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png` })
}

/** Drag helper: HTML5 drag events, dispatched with a shared DataTransfer. */
async function dragTo(page, fromSelector, toSelector) {
  await page.evaluate(
    (from, to) => {
      const source = document.querySelector(from)
      const target = document.querySelector(to)
      if (!source || !target) throw new Error(`missing ${from} or ${to}`)
      const dt = new DataTransfer()
      const fire = (el, type) =>
        el.dispatchEvent(
          new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }),
        )
      fire(source, 'dragstart')
      fire(target, 'dragenter')
      fire(target, 'dragover')
      fire(target, 'drop')
      fire(source, 'dragend')
    },
    fromSelector,
    toSelector,
  )
}

async function main() {
  if (!CHROME) {
    console.error('No Chrome/Edge found; skipping browser smoke test.')
    process.exit(0)
  }

  const server = await createServer({ server: { port: 5199, strictPort: true } })
  await server.listen()
  const base = 'http://localhost:5199'

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: !HEADFUL,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000 })

  const consoleErrors = []
  const track = (target) => {
    target.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text())
    })
    target.on('pageerror', (e) => consoleErrors.push(String(e)))
    target.on('response', (r) => {
      if (r.status() >= 400) consoleErrors.push(`HTTP ${r.status()} ${r.url()}`)
    })
  }
  track(page)

  try {
    console.log('\nDesktop')
    await page.goto(base, { waitUntil: 'networkidle2' })
    await page.waitForSelector('.hero__name', { timeout: 15000 })

    await check('demo trip loads on first launch', async () => {
      const name = await page.$eval('.hero__name', (el) => el.value)
      assert(name === 'Japan 2027', `expected the demo trip, got ${name}`)
    })

    await check('dashboard reports the trip shape', async () => {
      const stats = await page.$$eval('.stat', (els) =>
        els.map((el) => ({
          value: el.querySelector('.stat__value')?.textContent,
          label: el.querySelector('.stat__label')?.textContent,
        })),
      )
      const byLabel = Object.fromEntries(stats.map((s) => [s.label, s.value]))
      assert(byLabel.Days === '14', `days: ${byLabel.Days}`)
      assert(byLabel['Days planned'] === '13/14', `planned: ${byLabel['Days planned']}`)
      assert(Number(byLabel.Warnings) > 0, 'expected the demo to raise warnings')
    })

    await check('dashboard lists itinerary warnings', async () => {
      const warnings = await page.$$eval('.warn', (els) => els.map((e) => e.textContent))
      assert(warnings.length > 0, 'no warnings rendered')
      assert(
        warnings.some((w) => w.includes('No accommodation')),
        'missing-accommodation warning not shown',
      )
    })
    await shot(page, '01-overview')

    console.log('\nPlanner workspace')
    await page.goto(`${base}/#/trip/trip_japan_2027/plan`, { waitUntil: 'networkidle2' })
    await page.waitForSelector('.rail__day')

    await check('three panels render side by side', async () => {
      const rail = await page.$$('.rail__day')
      assert(rail.length === 14, `expected 14 day rows, got ${rail.length}`)
      assert(await page.$('.timeline'), 'itinerary panel missing')
      // The map chunk loads on demand, so give it a moment to arrive.
      await page.waitForSelector('.map__canvas', { timeout: 15000 })
    })

    await check('opening a day shows its activities', async () => {
      const days = await page.$$('.rail__day')
      await days[5].click() // 17 Mar — temple day
      await page.waitForFunction(
        () => document.querySelector('.dayhead__date')?.textContent?.includes('17'),
        { timeout: 5000 },
      )
      const titles = await page.$$eval('.act__title', (els) => els.map((e) => e.textContent))
      assert(titles.some((t) => t.includes('Fushimi Inari')), `got ${titles.join(' | ')}`)
    })

    await check('free time appears as an explicit block', async () => {
      const gaps = await page.$$eval('.gap__btn', (els) => els.map((e) => e.textContent))
      assert(gaps.length > 0, 'no free-time block on a day with a 2.5h hole')
      assert(gaps.some((g) => g.includes('Free')), gaps.join(' | '))
    })

    await check('quick add parses a leading time', async () => {
      await page.type('input[placeholder^="Add to this day"]', '15:15 Coffee stop')
      await page.keyboard.press('Enter')
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('.act__title')].some((e) =>
            e.textContent?.includes('Coffee stop'),
          ),
        { timeout: 5000 },
      )
      const times = await page.$$eval('.act__time input', (els) => els.map((e) => e.value))
      assert(times.includes('15:15'), `times: ${times.join(',')}`)
    })

    await check('the new activity opens in the inspector', async () => {
      await page.waitForSelector('.insp__title')
      const title = await page.$eval('.insp__title', (el) => el.value)
      assert(title === 'Coffee stop', `inspector shows ${title}`)
    })

    await check('editing the title updates the timeline live', async () => {
      await page.click('.insp__title', { clickCount: 3 })
      await page.type('.insp__title', 'Coffee and cake')
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('.act__title')].some((e) =>
            e.textContent?.includes('Coffee and cake'),
          ),
        { timeout: 5000 },
      )
    })

    await check('editing the time inline re-sorts the day', async () => {
      // The time cell in the row is editable: move it to first thing.
      const index = await page.$$eval('.act', (rows) =>
        rows.findIndex((r) => r.querySelector('.act__title')?.textContent?.includes('Coffee and cake')),
      )
      assert(index >= 0, 'could not find the row to retime')
      const inputs = await page.$$('.act__time input')
      await inputs[index].click({ clickCount: 3 })
      await inputs[index].type('06:30')
      await page.keyboard.press('Enter')
      await page.waitForFunction(
        () =>
          document
            .querySelectorAll('.act__title')[0]
            ?.textContent?.includes('Coffee and cake'),
        { timeout: 5000 },
      )
      const first = await page.$$eval('.act__time input', (els) => els[0].value)
      assert(first === '06:30', `first row shows ${first}`)
    })

    await shot(page, '02-planner')

    console.log('\nIdeas and drag-and-drop')
    await check('an idea can be dragged onto a day', async () => {
      await page.evaluate(() => {
        const tab = [...document.querySelectorAll('.segmented button')].find((b) =>
          b.textContent?.includes('Ideas'),
        )
        tab?.click()
      })
      await page.waitForSelector('.idea')
      const before = await page.$$eval('.idea', (els) => els.length)
      const title = await textOf(page, '.idea__title')

      await dragTo(page, '.idea', '.day-drop')

      await page.waitForFunction(
        (expected) => document.querySelectorAll('.idea').length === expected,
        { timeout: 5000 },
        before - 1,
      )
      await page.waitForFunction(
        () => document.querySelectorAll('.act__title').length > 0,
        { timeout: 5000 },
      )
      const scheduled = await page.$$eval('.act__title', (els) =>
        els.map((e) => e.textContent?.trim()),
      )
      assert(
        scheduled.some((t) => t?.includes(title)),
        `“${title}” did not land on the day: ${scheduled.join(' | ')}`,
      )
    })

    console.log('\nMap')
    await page.goto(`${base}/#/trip/trip_japan_2027/map`, { waitUntil: 'networkidle2' })
    await check('map renders pins for located activities', async () => {
      await page.waitForSelector('.pin', { timeout: 10000 })
      const pins = await page.$$('.pin')
      assert(pins.length > 5, `only ${pins.length} pins`)
    })

    await check('clicking a pin selects its activity', async () => {
      await page.click('.pin')
      await page.waitForFunction(
        () => document.querySelectorAll('.mappop__title').length > 0,
        { timeout: 5000 },
      )
    })
    await shot(page, '03-map')

    console.log('\nBookings')
    await page.goto(`${base}/#/trip/trip_japan_2027/bookings`, { waitUntil: 'networkidle2' })
    await check('stays, journeys and references are listed', async () => {
      await page.waitForSelector('.panel-card')
      const body = await page.$eval('body', (el) => el.innerText)
      assert(body.includes('Ryokan Sanjo'), 'accommodation missing')
      assert(body.includes('Nozomi 231'), 'transport detail missing')
      assert(body.includes('JR-2XK9P1'), 'booking reference missing')
    })

    console.log('\nTravel mode')
    await page.goto(`${base}/#/trip/trip_japan_2027/today`, { waitUntil: 'networkidle2' })
    await check('travel mode shows a focused day', async () => {
      await page.waitForSelector('.travel__title')
      assert((await page.$$('.big-btn')).length > 0, 'no large actions rendered')
    })
    await shot(page, '04-travel')

    console.log('\nPersistence')
    await check('edits survive a reload', async () => {
      await page.goto(`${base}/#/trip/trip_japan_2027/plan`, { waitUntil: 'networkidle2' })
      await page.reload({ waitUntil: 'networkidle2' })
      await page.waitForSelector('.rail__day')
      const days = await page.$$('.rail__day')
      await days[5].click()
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('.act__title')].some((e) =>
            e.textContent?.includes('Coffee and cake'),
          ),
        { timeout: 8000 },
      )
    })


    console.log('\nTrip creation')
    await page.goto(`${base}/#/trips`, { waitUntil: 'networkidle2' })
    await check('a new trip can be created from scratch', async () => {
      await page.waitForSelector('.panel-card')
      await page.evaluate(() => {
        const button = [...document.querySelectorAll('button')].find((b) =>
          b.textContent?.includes('New trip'),
        )
        button?.click()
      })
      await page.waitForSelector('.modal')
      await page.type('.modal input.input', 'Lisbon weekend')
      await page.evaluate(() => {
        const setValue = (el, value) => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
          setter.call(el, value)
          el.dispatchEvent(new Event('input', { bubbles: true }))
        }
        const dates = [...document.querySelectorAll('.modal input[type="date"]')]
        setValue(dates[0], '2027-06-04')
        setValue(dates[1], '2027-06-07')
        const dests = [...document.querySelectorAll('.modal input')].find(
          (i) => i.placeholder === 'Tokyo, Kyoto, Osaka',
        )
        setValue(dests, 'Lisbon, Sintra')
      })
      await page.evaluate(() => {
        const create = [...document.querySelectorAll('.modal__foot button')].find((b) =>
          b.textContent?.includes('Create trip'),
        )
        create?.click()
      })
      await page.waitForSelector('.hero__name', { timeout: 8000 })
      const name = await page.$eval('.hero__name', (el) => el.value)
      assert(name === 'Lisbon weekend', `new trip opened as ${name}`)
    })

    await check('the new trip starts empty but well formed', async () => {
      const stats = await page.$$eval('.stat', (els) =>
        Object.fromEntries(
          els.map((el) => [
            el.querySelector('.stat__label')?.textContent,
            el.querySelector('.stat__value')?.textContent,
          ]),
        ),
      )
      assert(stats.Days === '4', `expected 4 days, got ${stats.Days}`)
      assert(stats.Activities === '0', `expected no activities, got ${stats.Activities}`)
    })

    await check('a hotel can be added to the trip', async () => {
      const id = await currentTripId(page)
      await page.goto(`${base}/#/trip/${id}/bookings`, { waitUntil: 'networkidle2' })
      await page.evaluate(() => {
        const button = [...document.querySelectorAll('button')].find((b) =>
          b.textContent?.includes('Add stay'),
        )
        button?.click()
      })
      // The stay's name lives in an input, so check its value, not innerText.
      await page.waitForFunction(
        () => document.querySelector('.panel-card__head .inline-edit')?.value === 'New stay',
        { timeout: 5000 },
      )
      const nameInput = await page.$('.panel-card__head .inline-edit')
      await nameInput.click({ clickCount: 3 })
      await nameInput.type('Hotel do Chiado')
      await page.waitForFunction(
        () =>
          document.querySelector('.panel-card__head .inline-edit')?.value === 'Hotel do Chiado',
        { timeout: 5000 },
      )
    })

    await check('the stay shows on the days it covers', async () => {
      const id = await currentTripId(page)
      await page.goto(`${base}/#/trip/${id}/timeline`, { waitUntil: 'networkidle2' })
      await page.waitForSelector('.wday')
      const footers = await page.$$eval('.wday__stay', (els) => els.map((e) => e.textContent))
      assert(
        footers.some((f) => f?.includes('Hotel do Chiado')),
        `no day shows the stay: ${footers.join(' | ')}`,
      )
    })

    await check('a trip can be deleted', async () => {
      await page.goto(`${base}/#/trips`, { waitUntil: 'networkidle2' })
      await page.waitForSelector('.panel-card')
      const before = await page.$$eval('.panel-card', (els) => els.length)
      await page.evaluate(() => {
        const card = [...document.querySelectorAll('.panel-card')].find((c) =>
          c.textContent?.includes('Lisbon weekend'),
        )
        card?.querySelector('button[aria-label^="Delete"]')?.click()
      })
      await page.waitForSelector('.modal')
      await page.evaluate(() => {
        const confirm = [...document.querySelectorAll('.modal__foot button')].find(
          (b) => b.textContent?.trim() === 'Delete',
        )
        confirm?.click()
      })
      await page.waitForFunction(
        (expected) => document.querySelectorAll('.panel-card').length === expected,
        { timeout: 5000 },
        before - 1,
      )
      const body = await page.$eval('body', (el) => el.innerText)
      assert(!body.includes('Lisbon weekend'), 'deleted trip still listed')
    })
    console.log('\nMobile (390x844)')
    const phone = await browser.newPage()
    track(phone)
    await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
    await phone.goto(`${base}/#/trip/trip_japan_2027/today`, { waitUntil: 'networkidle2' })
    await check('mobile shows the tab bar and hides the desktop nav', async () => {
      await phone.waitForSelector('.tabbar')
      const navVisible = await phone.$eval('.nav', (el) => getComputedStyle(el).display !== 'none')
        .catch(() => false)
      assert(!navVisible, 'desktop sidebar should be hidden on a phone')
      const tabs = await phone.$$('.tabbar__item')
      assert(tabs.length === 5, `expected 5 tabs, got ${tabs.length}`)
    })

    await check('mobile planner falls back to the weekly view', async () => {
      await phone.goto(`${base}/#/trip/trip_japan_2027/plan`, { waitUntil: 'networkidle2' })
      await phone.waitForSelector('.wday', { timeout: 8000 })
      const cards = await phone.$$('.wday')
      assert(cards.length === 14, `expected 14 day cards, got ${cards.length}`)
    })

    await check('tapping a day opens the full day view', async () => {
      const cards = await phone.$$('.wday')
      await cards[5].click()
      await phone.waitForSelector('.timeline', { timeout: 8000 })
    })
    if (SHOTS) {
      if (!existsSync(SHOT_DIR)) mkdirSync(SHOT_DIR)
      await phone.screenshot({ path: `${SHOT_DIR}/05-mobile.png` })
    }
    await phone.close()

    await check('no uncaught errors in the console', () => {
      // Tile requests can fail on a slow or blocked network; that is not a bug
      // in the app, and the itinerary keeps working regardless.
      const ignorable = (t) => /tile\.openstreetmap|ERR_INTERNET_DISCONNECTED/.test(t)
      const real = consoleErrors.filter((t) => !ignorable(t))
      assert(real.length === 0, real.slice(0, 3).join('\n'))
    })
  } finally {
    await browser.close()
    await server.close()
  }

  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length) {
    for (const f of failures) console.error(`\n${f.name}\n${f.error.stack}`)
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
