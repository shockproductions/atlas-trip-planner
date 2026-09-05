// @ts-check
'use strict'

/**
 * Electron shell for the desktop build.
 *
 * Its job is small but specific: give the planner real windows. Panels opened
 * from the app (map, ideas, a single day) become genuine OS windows that can
 * live on a second monitor, and every window's position and size is remembered
 * between sessions.
 */

const { app, BrowserWindow, shell, Menu } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const DEV_SERVER = process.env.ATLAS_DEV_SERVER
const INDEX_FILE = path.join(__dirname, '..', 'dist', 'index.html')
const STATE_FILE = path.join(app.getPath('userData'), 'window-state.json')

/** @type {Record<string, {x?:number,y?:number,width:number,height:number,maximized?:boolean}>} */
let windowState = {}

function loadState() {
  try {
    windowState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
  } catch {
    windowState = {}
  }
}

function saveState() {
  try {
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true })
    fs.writeFileSync(STATE_FILE, JSON.stringify(windowState, null, 2))
  } catch {
    /* state is a convenience; never fail startup over it */
  }
}

/** Remember where a window was, keyed by its role. */
function trackWindow(win, key, fallback) {
  const saved = windowState[key] ?? fallback
  if (saved.x != null && saved.y != null) win.setPosition(saved.x, saved.y)
  if (saved.maximized) win.maximize()

  const record = () => {
    if (win.isDestroyed()) return
    const maximized = win.isMaximized()
    const bounds = maximized ? win.getNormalBounds() : win.getBounds()
    windowState[key] = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      maximized,
    }
    saveState()
  }

  win.on('resized', record)
  win.on('moved', record)
  win.on('maximize', record)
  win.on('unmaximize', record)
  win.on('close', record)
}

function loadInto(win, hash) {
  if (DEV_SERVER) {
    void win.loadURL(hash ? `${DEV_SERVER}/${hash}` : DEV_SERVER)
  } else {
    void win.loadFile(INDEX_FILE, hash ? { hash: hash.replace(/^#/, '') } : undefined)
  }
}

function createWindow(key, options, hash) {
  const saved = windowState[key]
  const win = new BrowserWindow({
    width: saved?.width ?? options.width,
    height: saved?.height ?? options.height,
    minWidth: 380,
    minHeight: 420,
    title: options.title,
    backgroundColor: '#0e1013',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  })

  trackWindow(win, key, { width: options.width, height: options.height })
  loadInto(win, hash)

  // Panels the app opens with window.open become real windows; anything
  // external goes to the user's browser.
  win.webContents.setWindowOpenHandler(({ url, frameName }) => {
    const isInternal =
      url.startsWith('file://') || (DEV_SERVER != null && url.startsWith(DEV_SERVER))
    if (!isInternal) {
      void shell.openExternal(url)
      return { action: 'deny' }
    }
    const panelKey = frameName || `panel-${Date.now()}`
    const bounds = windowState[panelKey]
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: bounds?.width ?? 940,
        height: bounds?.height ?? 760,
        x: bounds?.x,
        y: bounds?.y,
        minWidth: 360,
        minHeight: 400,
        backgroundColor: '#0e1013',
        autoHideMenuBar: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
      },
    }
  })

  win.webContents.on('did-create-window', (child, { frameName }) => {
    trackWindow(child, frameName || `panel-${Date.now()}`, { width: 940, height: 760 })
  })

  return win
}

function buildMenu() {
  const isMac = process.platform === 'darwin'
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac ? [{ role: 'appMenu' }] : []),
      {
        label: 'File',
        submenu: [
          {
            label: 'New Window',
            accelerator: 'CmdOrCtrl+Shift+N',
            click: () =>
              createWindow(`main-${Date.now()}`, {
                width: 1440,
                height: 920,
                title: 'Atlas',
              }),
          },
          { type: 'separator' },
          isMac ? { role: 'close' } : { role: 'quit' },
        ],
      },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
    ]),
  )
}

app.whenReady().then(() => {
  loadState()
  buildMenu()
  createWindow('main', { width: 1440, height: 920, title: 'Atlas — Trip Planner' })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow('main', { width: 1440, height: 920, title: 'Atlas — Trip Planner' })
    }
  })
})

app.on('window-all-closed', () => {
  saveState()
  if (process.platform !== 'darwin') app.quit()
})
