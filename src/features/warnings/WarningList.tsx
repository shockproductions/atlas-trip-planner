import type { Warning } from '@/domain/warnings'
import { Icon } from '@/ui/Icon'
import { useUiStore } from '@/store/uiStore'

/**
 * Warnings are advisory: they point, they never act. Clicking one selects the
 * activity it refers to so the user can decide what, if anything, to change.
 */
export function WarningList({
  warnings,
  compact = false,
  onPickDay,
}: {
  warnings: Warning[]
  compact?: boolean
  onPickDay?: (dayId: string) => void
}) {
  const selectActivity = useUiStore((s) => s.selectActivity)
  const hoverActivity = useUiStore((s) => s.hoverActivity)

  if (!warnings.length) return null

  const shown = compact ? warnings.slice(0, 3) : warnings

  return (
    <div className="stack stack--tight">
      {shown.map((w) => {
        const target = w.activityIds[0]
        const clickable = Boolean(target || (onPickDay && w.dayId))
        const Tag = clickable ? 'button' : 'div'
        return (
          <Tag
            key={w.id}
            className={`warn${w.severity === 'info' ? ' warn--info' : ''}${clickable ? ' warn--button' : ''}`}
            onClick={
              clickable
                ? () => {
                    if (target) selectActivity(target)
                    if (onPickDay && w.dayId) onPickDay(w.dayId)
                  }
                : undefined
            }
            onMouseEnter={target ? () => hoverActivity(target) : undefined}
            onMouseLeave={target ? () => hoverActivity(null) : undefined}
          >
            <span className="warn__icon">
              <Icon name={w.severity === 'info' ? 'bulb' : 'alert'} size={14} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span>{w.message}</span>
              {w.detail ? <span className="warn__detail">{w.detail}</span> : null}
            </span>
          </Tag>
        )
      })}
      {compact && warnings.length > shown.length ? (
        <div className="muted" style={{ fontSize: 11.5, paddingLeft: 4 }}>
          +{warnings.length - shown.length} more
        </div>
      ) : null}
    </div>
  )
}
