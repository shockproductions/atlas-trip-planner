/**
 * Native shell integration.
 *
 * Capacitor plugins are imported lazily so the same bundle runs unchanged in a
 * browser, in Electron and inside the iOS/Android WebView. Nothing here is
 * required for the app to work — it only adjusts platform chrome.
 */

/**
 * Register the offline shell. Only meaningful for the web build — Electron and
 * Capacitor already load their code from disk.
 */
function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return
  if (!('serviceWorker' in navigator)) return
  if (!location.protocol.startsWith('http')) return
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline shell is an enhancement, not a requirement */
    })
  })
}

export async function initNativeShell(): Promise<void> {
  if (typeof window === 'undefined') return
  registerServiceWorker()

  const capacitor = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  if (!capacitor?.isNativePlatform?.()) return

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    const dark = document.documentElement.getAttribute('data-theme') === 'dark'
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
  } catch {
    /* status bar plugin not installed for this platform */
  }

  try {
    const { App } = await import('@capacitor/app')
    // Android back button: leave the app only from a top-level view.
    await App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back()
      else void App.exitApp()
    })
  } catch {
    /* app plugin unavailable */
  }
}
