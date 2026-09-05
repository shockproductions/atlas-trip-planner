/** Short, collision-safe ids. Prefixed so records are readable in devtools. */
export function newId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
  return `${prefix}_${rand}`
}

export const now = (): string => new Date().toISOString()
