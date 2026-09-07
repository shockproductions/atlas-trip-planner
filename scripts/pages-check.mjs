#!/usr/bin/env node
/**
 * Proves the built site works the way GitHub Pages serves it: from a project
 * subpath (`/<repo>/`), not the domain root. That is where relative-base bugs,
 * broken manifests and a service worker with the wrong scope show up.
 *
 * Checks that the app boots, seeds itself from the published trip rather than
 * the bundled demo, and renders on a phone-sized viewport.
 *
 *   npm run pages:check
 */
import puppeteer from 'puppeteer-core'
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => existsSync(p))

if (!CHROME) {
  console.error('No Chrome/Edge found; skipping.')
  process.exit(0)
}

const BASE_PATH = '/atlas-trip-planner'
const PORT = 5196
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.map': 'application/json',
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (!url.pathname.startsWith(BASE_PATH)) {
    res.writeHead(404).end('outside base')
    return
  }
  let rel = url.pathname.slice(BASE_PATH.length) || '/'
  if (rel.endsWith('/')) rel += 'index.html'
  const file = join('dist', normalize(rel).replace(/^([/\\])+/, ''))
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end('not found: ' + rel)
    return
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
})
await new Promise((r) => server.listen(PORT, r))
const site = `http://localhost:${PORT}${BASE_PATH}/`

let passed = 0
const failures = []
const check = (name, ok, detail) => {
  if (ok) {
    passed++
    console.log('  ok   ' + name)
  } else {
    failures.push(name + (detail ? ' — ' + detail : ''))
    console.log('  FAIL ' + name + (detail ? '\n       ' + detail : ''))
  }
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1400, height: 900 })
  const problems = []
  page.on('pageerror', (e) => problems.push(String(e)))
  page.on('response', (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`)
  })

  console.log('\nDesktop, served from ' + BASE_PATH + '/')
  await page.goto(site, { waitUntil: 'networkidle2' })
  await wait(2500)

  const text = await page.evaluate(() => document.body.innerText)
  check('the app boots', text.length > 50, text.slice(0, 120))
  check('seeds from the published trip, not the demo', text.includes('Sydney 2026'), text.slice(0, 200))
  check('does not fall back to the Japan demo', !text.includes('Japan 2027'))

  const seeded = await page.evaluate(() => {
    const raw = localStorage.getItem('atlas:setting:publishedRevision')
    return raw ? JSON.parse(raw) : null
  })
  check('records the published revision it adopted', typeof seeded === 'string' && seeded.length > 0, String(seeded))

  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel=manifest]')
    if (!link) return { ok: false, why: 'no manifest link' }
    const res = await fetch(link.href)
    if (!res.ok) return { ok: false, why: 'HTTP ' + res.status }
    const m = await res.json()
    const icon = new URL(m.icons[0].src, link.href).href
    const iconRes = await fetch(icon)
    return { ok: true, name: m.name, display: m.display, iconOk: iconRes.ok, start: m.start_url }
  })
  check('the web app manifest resolves on a subpath', manifest.ok, manifest.why)
  check('the manifest is installable (standalone + icon)', manifest.display === 'standalone' && manifest.iconOk)

  const trip = await page.evaluate(async () => {
    const res = await fetch('./trips/sydney-2026.json', { cache: 'no-store' })
    return { ok: res.ok, status: res.status, type: res.headers.get('content-type') }
  })
  check('the published trip is fetchable at a relative path', trip.ok, 'HTTP ' + trip.status)

  console.log('\nPhone (iPhone-sized viewport)')
  const phone = await browser.newPage()
  phone.on('pageerror', (e) => problems.push('phone: ' + String(e)))
  await phone.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  await phone.goto(site, { waitUntil: 'networkidle2' })
  await wait(2500)
  const phoneText = await phone.evaluate(() => document.body.innerText)
  check('renders on a phone viewport', phoneText.includes('Sydney 2026'), phoneText.slice(0, 150))
  const overflows = await phone.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  check('no horizontal overflow on a phone', overflows <= 1, 'overflow ' + overflows + 'px')
  await phone.screenshot({ path: 'screenshots/pages-phone.png' })

  await page.screenshot({ path: 'screenshots/pages-desktop.png' })

  check('no console or network errors', problems.length === 0, problems.slice(0, 4).join(' | '))
} finally {
  await browser.close()
  server.close()
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) process.exit(1)
