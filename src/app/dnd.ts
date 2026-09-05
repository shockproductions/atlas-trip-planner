import type { ID } from '@/domain/types'

/**
 * Drag-and-drop coordination.
 *
 * `dataTransfer` payloads are unreadable during `dragover`, so the dragged
 * item is also kept here. Drop targets can therefore react to *what* is being
 * dragged while the pointer is still moving.
 */

export interface DragPayload {
  kind: 'activity'
  activityId: ID
  /** Day the drag started from, or null when dragged out of the ideas inbox. */
  fromDayId: ID | null
}

export const DND_MIME = 'application/x-atlas-activity'

let current: DragPayload | null = null

export function beginDrag(payload: DragPayload, event: React.DragEvent): void {
  current = payload
  try {
    event.dataTransfer.setData(DND_MIME, JSON.stringify(payload))
    event.dataTransfer.setData('text/plain', payload.activityId)
    event.dataTransfer.effectAllowed = 'move'
  } catch {
    /* some environments restrict dataTransfer; the module-level copy still works */
  }
}

export function endDrag(): void {
  current = null
}

export const getDrag = (): DragPayload | null => current

export function readDrop(event: React.DragEvent): DragPayload | null {
  try {
    const raw = event.dataTransfer.getData(DND_MIME)
    if (raw) return JSON.parse(raw) as DragPayload
  } catch {
    /* fall through to the in-memory payload */
  }
  return current
}

/** True when the event carries an activity drag (ours or a plain-text fallback). */
export function isActivityDrag(event: React.DragEvent): boolean {
  if (current) return true
  return Array.from(event.dataTransfer.types ?? []).includes(DND_MIME)
}
