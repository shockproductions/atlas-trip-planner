import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ID } from '@/domain/types'
import { listDays } from '@/domain/selectors'
import { useTripStore } from '@/store/tripStore'
import { useUiStore } from '@/store/uiStore'

const VIEWS = ['overview', 'plan', 'timeline', 'map', 'ideas', 'bookings'] as const

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/**
 * Desktop keyboard shortcuts. Deliberately few, and none of them destructive:
 * undo/redo, day navigation, panel toggles and view jumps.
 */
export function useKeyboardShortcuts(tripId: ID | null): void {
  const navigate = useNavigate()

  useEffect(() => {
    if (!tripId) return

    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey

      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) useTripStore.getState().redo()
        else useTripStore.getState().undo()
        return
      }

      if (isTypingTarget(event.target) || mod || event.altKey) return

      const ui = useUiStore.getState()
      const store = useTripStore.getState()

      switch (event.key) {
        case 'j':
        case 'k': {
          const days = listDays(store.data, tripId)
          const index = days.findIndex((d) => d.id === ui.selectedDayId)
          const next = days[Math.max(0, Math.min(days.length - 1, (index < 0 ? 0 : index) + (event.key === 'j' ? 1 : -1)))]
          if (next) {
            ui.selectDay(next.id)
            event.preventDefault()
          }
          break
        }
        case 'n': {
          // Focus the day's quick-add field rather than opening a dialog.
          const input = document.querySelector<HTMLInputElement>(
            '.panel input[placeholder^="Add to this day"], input[placeholder^="Save an idea"]',
          )
          if (input) {
            input.focus()
            event.preventDefault()
          }
          break
        }
        case 'm':
          ui.setDock('map')
          break
        case 'i':
          ui.setDock('ideas')
          break
        case 'Escape':
          if (ui.selectedActivityId) {
            ui.selectActivity(null)
            event.preventDefault()
          }
          break
        default: {
          const digit = Number(event.key)
          if (digit >= 1 && digit <= VIEWS.length) {
            navigate(`/trip/${tripId}/${VIEWS[digit - 1]}`)
            event.preventDefault()
          }
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tripId, navigate])
}
