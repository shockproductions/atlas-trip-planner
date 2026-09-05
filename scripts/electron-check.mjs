/**
 * Verifies the Electron shell boots and renders the app from `dist/`.
 * Uses the remote debugging port rather than a visible window, so it can run
 * unattended. Run `npm run build` first.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import puppeteer from 'puppeteer-core'

const require = createRequire(import.meta.url)
const electron = require('electron')
if (!existsSync('dist/index.html')) {
  console.error('dist/ not found — run `npm run build` first.')
  process.exit(1)
}

// A stray ELECTRON_RUN_AS_NODE would start plain Node instead of the shell.
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(electron, ['electron/main.cjs', '--remote-debugging-port=9333'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env,
})
let stderr = ''
child.stderr.on('data', (d) => (stderr += d))

const deadline = Date.now() + 30000
let targets = null
while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 700))
  try {
    const res = await fetch('http://127.0.0.1:9333/json/list')
    const list = await res.json()
    if (list.length) {
      targets = list
      break
    }
  } catch {
    /* not up yet */
  }
}

if (!targets) {
  child.kill()
  console.error('Electron did not open a window in time.')
  console.error(stderr.split(String.fromCharCode(10)).slice(0, 12).join(String.fromCharCode(10)))
  process.exit(1)
}

const page = targets.find((t) => t.type === 'page')
console.log('  ok   Electron window opened')
console.log(`  ok   title: ${page?.title}`)

let failed = false
try {
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:9333',
    defaultViewport: null,
  })
  const [main] = await browser.pages()
  await main.waitForSelector('.rail__day, .hero__name', { timeout: 20000 })
  console.log('  ok   app rendered from dist/')

  // Tear off the map panel — it must become a second, real window.
  await main.goto(`${page.url.split('#')[0]}#/trip/trip_japan_2027/plan`)
  await main.waitForSelector('.panel__head', { timeout: 20000 })
  const before = (await browser.pages()).length
  await main.evaluate(() => {
    const buttons = [...document.querySelectorAll('button[aria-label="Detach panel"]')]
    buttons[0]?.click()
  })
  await new Promise((r) => setTimeout(r, 2500))
  const pages = await browser.pages()
  if (pages.length <= before) throw new Error('detaching a panel did not open a window')
  const panel = pages[pages.length - 1]
  await panel.waitForSelector('.map__canvas, .topbar__title', { timeout: 20000 })
  const panelTitle = await panel.title()
  console.log(`  ok   detached panel window opened (${panelTitle})`)

  browser.disconnect()
  console.log('')
  console.log('Electron check passed')
} catch (error) {
  failed = true
  console.error('')
  console.error('Electron check FAILED:', error.message)
} finally {
  child.kill()
}

process.exit(failed ? 1 : 0)
