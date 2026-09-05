/**
 * A single stroke-icon set. One component, one path table — keeps the visual
 * language consistent and avoids pulling in an icon dependency.
 */
export type IconName = keyof typeof PATHS

const PATHS = {
  plane: 'M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2a.5.5 0 0 0-.5.8l3.9 4.3-2.1 2.1-2.4-.4a.5.5 0 0 0-.5.8L5 16l1.9 2.6a.5.5 0 0 0 .8-.4l-.3-2.5 2.1-2.1 4.3 3.9a.5.5 0 0 0 .8-.5Z',
  train:
    'M8 3h8a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3ZM5 10h14M9 20l-2 2M15 20l2 2M9 13h.01M15 13h.01',
  car: 'M5 17H4a1 1 0 0 1-1-1v-3.3a2 2 0 0 1 .4-1.2l2-2.7A2 2 0 0 1 7 8h10a2 2 0 0 1 1.6.8l2 2.7a2 2 0 0 1 .4 1.2V16a1 1 0 0 1-1 1h-1M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm10 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm-6 0h6M3.5 12.5h17',
  bus: 'M6 3h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM4 10h16M8 17v2M16 17v2M8 14h.01M16 14h.01',
  ferry: 'M3 18c1.5 0 2-1 3.5-1s2 1 3.5 1 2-1 3.5-1 2 1 3.5 1 2-1 3.5-1M5 15l1.5-5h11L19 15M9 10V7h6v3M12 4v3',
  bed: 'M3 18v-7m0 0V7m0 4h18v7M3 14h18M7 11V9a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2',
  utensils: 'M7 3v8m0 0v10M4.5 3v5a2.5 2.5 0 0 0 5 0V3M17.5 3c-1.4 1-2.5 3-2.5 6 0 2 .8 3 2.5 3.2V21',
  beach:
    'M3 20c1.6 0 2.2-1 3.8-1s2.2 1 3.8 1 2.2-1 3.8-1 2.2 1 3.8 1M12 17V9M12 9c0-3 2.5-5 5.5-5S23 6 23 9M12 9c0-3-2.5-5-5.5-5S1 6 1 9',
  nature:
    'M12 21v-5m0 0 4.5-3.2A5.5 5.5 0 0 0 12 3a5.5 5.5 0 0 0-4.5 9.8L12 16Z',
  culture:
    'M4 21h16M5 21V10m14 11V10M3 10l9-6 9 6M9 21v-6h6v6M9.5 13.5h5',
  museum: 'M3 21h18M4 21V9m4 12V9m8 12V9m4 12V9M2 9l10-6 10 6M6 21h12',
  shopping: 'M5 8h14l-1 12H6L5 8Zm3.5 0V6a3.5 3.5 0 1 1 7 0v2',
  ticket:
    'M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3.5a2.5 2.5 0 0 0 0-5V8Zm10-2v2m0 3v2m0 3v2',
  walking: 'M13 4.5a1.5 1.5 0 1 0 0-.01M11 21l1.5-6-2.5-2.5V9l3-2 2.5 2 2.5 1M10 12 8 15l-2 6',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.5 5.5-2 5-5 2 2-5 5-2Z',
  freeTime: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4v4l2.5 2.5',
  dot: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  pin: 'M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4.5V12l3 2',
  calendar: 'M7 3v3m10-3v3M4 8.5h16M5 6h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
  alert: 'M12 4.5 2.8 20h18.4L12 4.5Zm0 5V14m0 3h.01',
  check: 'M5 12.5 10 17.5 19 7',
  close: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  trash: 'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13h8l1-13M10 11v6m4-6v6',
  copy: 'M9 9h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Zm-1-5h9M5 8v9',
  grip: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  chevronRight: 'M9 5l7 7-7 7',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronDown: 'M5 9l7 7 7-7',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5.5 12.5L21 21',
  phone:
    'M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z',
  link: 'M10 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1 1M14 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1-1',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  wallet:
    'M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3M3 7h16a2 2 0 0 1 2 2v2h-5a2 2 0 0 0 0 4h5',
  layers: 'M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 17.5l9 5 9-5',
  settings:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm8.5 3a8.5 8.5 0 0 0-.2-1.8l2-1.5-2-3.4-2.3 1a8.5 8.5 0 0 0-3-1.8L14.5 2h-4l-.5 2.5a8.5 8.5 0 0 0-3 1.8l-2.3-1-2 3.4 2 1.5a8.6 8.6 0 0 0 0 3.6l-2 1.5 2 3.4 2.3-1a8.5 8.5 0 0 0 3 1.8l.5 2.5h4l.5-2.5a8.5 8.5 0 0 0 3-1.8l2.3 1 2-3.4-2-1.5c.13-.58.2-1.18.2-1.8Z',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  grid: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
  home: 'M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8Z',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3Z',
  play: 'M7 4.5v15l13-7.5-13-7.5Z',
  skip: 'M6 6l8 6-8 6V6Zm11 0v12',
  undo: 'M9 8H5V4M5.5 8a8 8 0 1 1-1.2 6',
  redo: 'M15 8h4V4M18.5 8a8 8 0 1 0 1.2 6',
  window: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Zm0 3.5h18',
  detach: 'M13 4h7v7M20 4l-8 8M18 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5.5',
  filter: 'M4 5h16l-6 7v6l-4 2v-8L4 5Z',
  route: 'M6.5 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm11 12a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM6.5 8.5V13a3 3 0 0 0 3 3h5a3 3 0 0 1 3 3v-3.5',
  moon: 'M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z',
  sun: 'M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.5 1.5m11.2 11.2 1.5 1.5M19.1 4.9l-1.5 1.5M6.4 17.6l-1.5 1.5',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Zm2 14h13',
  note: 'M5 4h9l5 5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm9 0v5h5M8 13h8M8 17h5',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z',
  arrowRight: 'M4 12h15m-6-6 6 6-6 6',
  arrowLeft: 'M20 12H5m6-6-6 6 6 6',
  drag: 'M12 3 9.5 5.5h5L12 3Zm0 18 2.5-2.5h-5L12 21ZM3 12l2.5-2.5v5L3 12Zm18 0-2.5 2.5v-5L21 12ZM12 8v8M8 12h8',
} as const

interface IconProps {
  name: IconName
  size?: number
  className?: string
  strokeWidth?: number
  'aria-hidden'?: boolean
}

export function Icon({ name, size = 16, className, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
