import { create } from 'zustand'
import { readSetting, writeSetting } from '@/data/db'
import type { ActivityCategory, ID } from '@/domain/types'

export type ThemeSetting = 'system' | 'light' | 'dark'
export type DockView = 'map' | 'ideas' | 'warnings'

interface PanelSizes {
  /** Fractions of the workspace width; the middle pane takes the remainder. */
  rail: number
  dock: number
  /** Fraction of the dock's height given to the map/ideas half. */
  inspector: number
}

export interface UiState {
  theme: ThemeSetting
  setTheme: (t: ThemeSetting) => void

  /** The day currently open in the planner. */
  selectedDayId: ID | null
  selectDay: (id: ID | null) => void

  /** The activity shown in the inspector and highlighted on the map. */
  selectedActivityId: ID | null
  selectActivity: (id: ID | null) => void

  /** Transient highlight driven by hovering a map pin or a warning. */
  hoveredActivityId: ID | null
  hoverActivity: (id: ID | null) => void

  dock: DockView
  setDock: (d: DockView) => void
  dockOpen: boolean
  toggleDock: (open?: boolean) => void

  panels: PanelSizes
  setPanels: (p: Partial<PanelSizes>) => void

  /** Map filters — shared by the dock map and the full map view. */
  mapDayFilter: ID | 'all'
  setMapDayFilter: (v: ID | 'all') => void
  mapCategories: ActivityCategory[] | null
  toggleMapCategory: (c: ActivityCategory) => void
  clearMapCategories: () => void
  showRoutes: boolean
  toggleRoutes: () => void

  /** Travel mode pins the app to today's execution view. */
  travelMode: boolean
  setTravelMode: (v: boolean) => void

  warningsMuted: boolean
  setWarningsMuted: (v: boolean) => void
}

const persistKey = <T,>(key: string, value: T): T => {
  writeSetting(key, value)
  return value
}

export const useUiStore = create<UiState>((set, get) => ({
  theme: readSetting<ThemeSetting>('theme', 'system'),
  setTheme: (theme) => set({ theme: persistKey('theme', theme) }),

  selectedDayId: null,
  selectDay: (selectedDayId) => set({ selectedDayId }),

  selectedActivityId: null,
  selectActivity: (selectedActivityId) => set({ selectedActivityId }),

  hoveredActivityId: null,
  hoverActivity: (hoveredActivityId) => set({ hoveredActivityId }),

  dock: readSetting<DockView>('dock', 'map'),
  setDock: (dock) => set({ dock: persistKey('dock', dock), dockOpen: true }),
  dockOpen: readSetting<boolean>('dockOpen', true),
  toggleDock: (open) =>
    set((s) => ({ dockOpen: persistKey('dockOpen', open ?? !s.dockOpen) })),

  panels: readSetting<PanelSizes>('panels', { rail: 0.19, dock: 0.34, inspector: 0.5 }),
  setPanels: (p) => set({ panels: persistKey('panels', { ...get().panels, ...p }) }),

  mapDayFilter: 'all',
  setMapDayFilter: (mapDayFilter) => set({ mapDayFilter }),
  mapCategories: null,
  toggleMapCategory: (c) =>
    set((s) => {
      const current = s.mapCategories
      if (!current) return { mapCategories: [c] }
      const next = current.includes(c) ? current.filter((x) => x !== c) : [...current, c]
      return { mapCategories: next.length ? next : null }
    }),
  clearMapCategories: () => set({ mapCategories: null }),
  showRoutes: readSetting<boolean>('showRoutes', true),
  toggleRoutes: () => set((s) => ({ showRoutes: persistKey('showRoutes', !s.showRoutes) })),

  travelMode: false,
  setTravelMode: (travelMode) => set({ travelMode }),

  warningsMuted: readSetting<boolean>('warningsMuted', false),
  setWarningsMuted: (v) => set({ warningsMuted: persistKey('warningsMuted', v) }),
}))
