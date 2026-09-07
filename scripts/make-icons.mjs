#!/usr/bin/env node
/**
 * Rasterises public/favicon.svg into the PNG icons the installable web app
 * needs: Android/Chrome want 192 and 512, iOS ignores SVG apple-touch-icons
 * and wants a 180.
 *
 * Uses the Chrome that is already required for `npm run smoke`, so this adds
 * no dependency. Re-run it only when the icon itself changes.
 *
 *   node scripts/make-icons.mjs
 */
import puppeteer from 'puppeteer-core'
import { existsSync, readFileSync } from 'node:fs'

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => existsSync(p))

if (!CHROME) {
  console.error('No Chrome/Edge found; cannot rasterise icons.')
  process.exit(1)
}

const svg = readFileSync('public/favicon.svg', 'utf8')
const sizes = [
  { size: 192, file: 'public/icon-192.png' },
  { size: 512, file: 'public/icon-512.png' },
  { size: 180, file: 'public/apple-touch-icon.png' },
]

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
try {
  const page = await browser.newPage()
  for (const { size, file } of sizes) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 })
    await page.setContent(
      `<style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    )
    await page.screenshot({ path: file, omitBackground: true })
    console.log(`wrote ${file} (${size}x${size})`)
  }
} finally {
  await browser.close()
}
