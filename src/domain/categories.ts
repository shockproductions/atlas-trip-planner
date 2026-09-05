import type { ActivityCategory, TransportMode } from './types'
import type { IconName } from '@/ui/Icon'

export interface CategoryMeta {
  label: string
  icon: IconName
  /** CSS custom-property suffix; see `--cat-*` tokens in theme.css. */
  tone: string
  /** True for categories that move you between places. */
  isTransport?: boolean
}

export const CATEGORY_META: Record<ActivityCategory, CategoryMeta> = {
  flight: { label: 'Flight', icon: 'plane', tone: 'transit', isTransport: true },
  train: { label: 'Train', icon: 'train', tone: 'transit', isTransport: true },
  driving: { label: 'Driving', icon: 'car', tone: 'transit', isTransport: true },
  transport: { label: 'Transport', icon: 'bus', tone: 'transit', isTransport: true },
  accommodation: { label: 'Accommodation', icon: 'bed', tone: 'stay' },
  food: { label: 'Food', icon: 'utensils', tone: 'food' },
  beach: { label: 'Beach', icon: 'beach', tone: 'water' },
  nature: { label: 'Nature', icon: 'nature', tone: 'nature' },
  culture: { label: 'Culture', icon: 'culture', tone: 'culture' },
  museum: { label: 'Museum', icon: 'museum', tone: 'culture' },
  shopping: { label: 'Shopping', icon: 'shopping', tone: 'shopping' },
  event: { label: 'Event', icon: 'ticket', tone: 'event' },
  walking: { label: 'Walking', icon: 'walking', tone: 'active' },
  activity: { label: 'Activity', icon: 'compass', tone: 'active' },
  freeTime: { label: 'Free time', icon: 'freeTime', tone: 'free' },
  other: { label: 'Other', icon: 'dot', tone: 'neutral' },
}

export const TRANSPORT_META: Record<TransportMode, { label: string; icon: IconName; category: ActivityCategory }> = {
  flight: { label: 'Flight', icon: 'plane', category: 'flight' },
  train: { label: 'Train', icon: 'train', category: 'train' },
  bus: { label: 'Bus', icon: 'bus', category: 'transport' },
  car: { label: 'Car', icon: 'car', category: 'driving' },
  rentalCar: { label: 'Rental car', icon: 'car', category: 'driving' },
  ferry: { label: 'Ferry', icon: 'ferry', category: 'transport' },
  walking: { label: 'Walking', icon: 'walking', category: 'walking' },
  publicTransport: { label: 'Public transport', icon: 'bus', category: 'transport' },
  other: { label: 'Other', icon: 'route', category: 'transport' },
}

export const categoryMeta = (c: ActivityCategory): CategoryMeta => CATEGORY_META[c] ?? CATEGORY_META.other

/** Typical duration (minutes) suggested when creating an activity of a category. */
export const DEFAULT_DURATION: Partial<Record<ActivityCategory, number>> = {
  food: 75,
  museum: 120,
  culture: 90,
  beach: 180,
  nature: 150,
  shopping: 90,
  event: 120,
  walking: 60,
  activity: 120,
  accommodation: 30,
}
