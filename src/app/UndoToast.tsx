import { useEffect, useRef, useState } from 'react'
import { useTripStore } from '@/store/tripStore'
import { Icon } from '@/ui/Icon'

const VISIBLE_MS = 4200

/** Non-destructive operations are silent; this only surfaces the way back. */
export function UndoToast() {
  const historyDepth = useTripStore((s) => s.past.length)
  const lastAction = useTripStore((s) => s.lastAction)
  const undo = useTripStore((s) => s.undo)
  const [message, setMessage] = useState<string | null>(null)
  const previousDepth = useRef(historyDepth)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const grew = historyDepth > previousDepth.current
    previousDepth.current = historyDepth
    // Only announce actions worth a second look; typing is not one of them.
    if (!grew || !lastAction || QUIET.has(lastAction)) return
    setMessage(lastAction)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setMessage(null), VISIBLE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [historyDepth, lastAction])

  if (!message) return null

  return (
    <div className="toast" role="status">
      <span>{message}</span>
      <button
        onClick={() => {
          undo()
          setMessage(null)
        }}
      >
        <Icon name="undo" size={12} /> Undo
      </button>
    </div>
  )
}

/** Edits that happen continuously as you type shouldn't raise a toast. */
const QUIET = new Set([
  'Edit activity',
  'Edit trip',
  'Edit day',
  'Edit location',
  'Edit transport',
  'Edit booking',
  'Edit accommodation',
  'Add note',
  'Change time',
])
