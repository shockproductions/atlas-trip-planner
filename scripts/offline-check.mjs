/**
 * Offline verification for the web build.
 *
 * Serves `dist/` (so the service worker is active), loads the app, edits the
 * trip, then cuts the network and reloads. Everything the itinerary needs must
 * still be there. Run `npm run build` first.
 */

import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'
import { preview } from 'vite'

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => existsSync(p))

if (!existsSync('dist/index.html')) {
  console.error('dist/ not found — run `npm run build` first.')
  process.exit(1)
}
if (!CHROME) {
  console.error('No Chrome/Edge found; skipping offline check.')
  process.exit(0)
}

const assert = (cond, message) => {
  if (!cond) throw new Error(message)
}

const server = await preview({ preview: { port: 5196, strictPort: true } })
const base = 'http://localhost:5196'
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1500, height: 950 })

let failed = false
try {
  await page.goto(`${base}/#/trip/trip_japan_2027/plan`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.rail__day', { timeout: 20000 })

  // Wait for the service worker to take control of the page.
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, { timeout: 20000 })
  console.log('  ok   service worker registered and controlling')

  const days = await page.$$('.rail__day')
  await days[8].click()
  await page.waitForSelector('input[placeholder^="Add to this day"]')
  await page.type('input[placeholder^="Add to this day"]', '11:30 Offline marker')
  await page.keyboard.press('Enter')
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('.act__title')].some((e) =>
        e.textContent?.includes('Offline marker'),
      ),
    { timeout: 8000 },
  )
  await new Promise((r) => setTimeout(r, 600)) // let the debounced write land
  console.log('  ok   edit made while online')

  await page.setOfflineMode(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.rail__day', { timeout: 20000 })

  const dayCount = await page.$$eval('.rail__day', (els) => els.length)
  assert(dayCount === 14, `offline reload showed ${dayCount} days`)
  console.log('  ok   app shell loads with the network off')

  const days2 = await page.$$('.rail__day')
  await days2[8].click()
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('.act__title')].some((e) =>
        e.textContent?.includes('Offline marker'),
      ),
    { timeout: 8000 },
  )
  console.log('  ok   the edit survived, offline')

  await page.goto(`${base}/#/trip/trip_japan_2027/bookings`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.panel-card', { timeout: 15000 })
  const text = await page.$eval('body', (el) => el.innerText)
  assert(text.includes('JR-2XK9P1'), 'booking references unavailable offline')
  assert(text.includes('Ryokan Sanjo'), 'accommodation unavailable offline')
  console.log('  ok   bookings and accommodation readable offline')

  await page.setOfflineMode(false)
  console.log('\nOffline check passed')
} catch (error) {
  failed = true
  console.error('\nOffline check FAILED\n', error)
} finally {
  await browser.close()
  await server.close()
}

process.exit(failed ? 1 : 0)
