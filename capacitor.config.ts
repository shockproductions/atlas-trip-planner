import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor wraps the same `dist/` build as the desktop app into native
 * Android and iOS shells. Run `npm run cap:sync` after a build, then
 * `npx cap add android` / `npx cap add ios` once to create the native projects.
 */
const config: CapacitorConfig = {
  appId: 'com.atlas.tripplanner',
  appName: 'Atlas',
  webDir: 'dist',
  backgroundColor: '#0e1013',
  android: {
    backgroundColor: '#0e1013',
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#0e1013',
  },
  server: {
    // Keeps history/hash routing working inside the WebView.
    androidScheme: 'https',
  },
}

export default config
