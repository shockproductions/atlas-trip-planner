/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Map tiles — see .env.example. */
  readonly VITE_MAP_TILE_URL?: string
  readonly VITE_MAP_API_KEY?: string
  readonly VITE_MAP_ATTRIBUTION?: string
  readonly VITE_MAP_MAX_ZOOM?: string
  /** `owner/repo` the propose-a-change flow targets. */
  readonly VITE_REPO?: string
  /** Branch proposals are opened against. */
  readonly VITE_REPO_BRANCH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
