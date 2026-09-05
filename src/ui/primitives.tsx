import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from './Icon'
import { categoryMeta } from '@/domain/categories'
import type { ActivityCategory } from '@/domain/types'

/* ------------------------------------------------------ category icon */

export function CategoryIcon({
  category,
  size = 'md',
}: {
  category: ActivityCategory
  size?: 'sm' | 'md' | 'lg'
}) {
  const meta = categoryMeta(category)
  const cls = size === 'md' ? '' : ` cat--${size}`
  return (
    <span className={`cat cat--${meta.tone}${cls}`} title={meta.label}>
      <Icon name={meta.icon} size={size === 'lg' ? 18 : size === 'sm' ? 12 : 15} />
    </span>
  )
}

/* --------------------------------------------------------------- field */

export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint ? <span className="field__label" style={{ fontWeight: 400 }}>{hint}</span> : null}
    </label>
  )
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch__track" />
      <span>{label}</span>
    </label>
  )
}

/* --------------------------------------------------------------- modal */

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`modal${wide ? ' modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
      >
        <div className="modal__head">
          <div className="modal__title" id={titleId}>
            {title}
          </div>
          <div className="topbar__spacer" />
          <button className="btn btn--ghost btn--icon btn--sm" onClick={onClose} aria-label="Close">
            <Icon name="close" size={15} />
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

/** Destructive actions confirm; everything else just happens (and can be undone). */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn--danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ color: 'var(--ink-2)', lineHeight: 1.55 }}>{message}</p>
    </Modal>
  )
}

/* ------------------------------------------------------------- split */

interface SplitProps {
  children: [ReactNode, ReactNode]
  /** Fraction of the container taken by the first pane. */
  size: number
  onSize: (next: number) => void
  min?: number
  max?: number
  className?: string
  /** `row` splits left/right, `column` splits top/bottom. */
  direction?: 'row' | 'column'
}

/** Two panes with a draggable divider. Sizes are fractions, persisted by callers. */
export function Split({
  children,
  size,
  onSize,
  min = 0.12,
  max = 0.6,
  className = '',
  direction = 'row',
}: SplitProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const vertical = direction === 'column'

  const startDrag = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault()
      const el = ref.current
      if (!el) return
      setDragging(true)
      const rect = el.getBoundingClientRect()
      const move = (e: PointerEvent) => {
        const fraction = vertical
          ? (e.clientY - rect.top) / rect.height
          : (e.clientX - rect.left) / rect.width
        onSize(Math.min(max, Math.max(min, fraction)))
      }
      const up = () => {
        setDragging(false)
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    },
    [max, min, onSize, vertical],
  )

  return (
    <div className={`split ${vertical ? 'split--v ' : ''}${className}`} ref={ref}>
      <div className="split__pane" style={{ flex: `0 0 ${(size * 100).toFixed(3)}%` }}>
        {children[0]}
      </div>
      <div
        className={`split__handle${dragging ? ' is-dragging' : ''}`}
        onPointerDown={startDrag}
        onDoubleClick={() => onSize((min + max) / 2)}
        role="separator"
        aria-orientation={vertical ? 'horizontal' : 'vertical'}
        aria-label="Resize panel"
        tabIndex={0}
        onKeyDown={(e) => {
          const dec = vertical ? 'ArrowUp' : 'ArrowLeft'
          const inc = vertical ? 'ArrowDown' : 'ArrowRight'
          if (e.key === dec) onSize(Math.max(min, size - 0.02))
          if (e.key === inc) onSize(Math.min(max, size + 0.02))
        }}
      />
      <div className="split__pane" style={{ flex: '1 1 0' }}>
        {children[1]}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- misc */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <Icon name={icon} size={22} />
      <div className="empty__title">{title}</div>
      {body ? <div className="empty__body">{body}</div> : null}
      {action}
    </div>
  )
}

/** Tracks a media query. Used for the desktop/mobile layout split. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  const snapshot = useCallback(
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false),
    [query],
  )
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
