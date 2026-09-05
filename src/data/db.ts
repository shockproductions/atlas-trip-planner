import { COLLECTIONS, emptyData, type CollectionName, type TripData } from '@/domain/types'

/**
 * Local-first storage.
 *
 * Each collection is its own IndexedDB object store keyed by id, so the
 * itinerary is never written as one opaque blob and a single activity edit
 * touches a single record. Where IndexedDB is unavailable (tests, private
 * modes, some WebViews) we fall back to localStorage with the same shape.
 *
 * Nothing here touches the network: the trip is fully usable offline.
 */

const DB_NAME = 'atlas'
const DB_VERSION = 1
const LS_PREFIX = 'atlas:'

type Row = { id: string }

let dbPromise: Promise<IDBDatabase | null> | null = null

function hasIndexedDB(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

function openDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDB()) return Promise.resolve(null)
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    let req: IDBOpenDBRequest
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of COLLECTIONS) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => resolve(null)
    req.onblocked = () => resolve(null)
  })
  return dbPromise
}

/* ------------------------------------------------------ localStorage fallback */

function lsRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function lsWrite(key: string, value: unknown): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value))
  } catch {
    /* storage full or unavailable — in-memory state still works */
  }
}

/* ----------------------------------------------------------------- public API */

export async function loadAll(): Promise<TripData> {
  const data = emptyData()
  const db = await openDb()

  if (!db) {
    for (const name of COLLECTIONS) {
      const rows = lsRead<Row[]>(name, [])
      for (const row of rows) {
        ;(data[name] as Record<string, Row>)[row.id] = row
      }
    }
    return data
  }

  await Promise.all(
    COLLECTIONS.map(
      (name) =>
        new Promise<void>((resolve) => {
          try {
            const req = db.transaction(name, 'readonly').objectStore(name).getAll()
            req.onsuccess = () => {
              for (const row of req.result as Row[]) {
                ;(data[name] as Record<string, Row>)[row.id] = row
              }
              resolve()
            }
            req.onerror = () => resolve()
          } catch {
            resolve()
          }
        }),
    ),
  )
  return data
}

/**
 * Mirror in-memory state to storage. `previousIds` lets us issue deletes for
 * records that disappeared without rewriting whole collections.
 */
export async function persist(
  data: TripData,
  previousIds: Record<CollectionName, Set<string>>,
): Promise<Record<CollectionName, Set<string>>> {
  const nextIds = {} as Record<CollectionName, Set<string>>
  for (const name of COLLECTIONS) nextIds[name] = new Set(Object.keys(data[name]))

  const db = await openDb()
  if (!db) {
    for (const name of COLLECTIONS) lsWrite(name, Object.values(data[name]))
    return nextIds
  }

  await new Promise<void>((resolve) => {
    let tx: IDBTransaction
    try {
      tx = db.transaction(COLLECTIONS as unknown as string[], 'readwrite')
    } catch {
      resolve()
      return
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
    tx.onabort = () => resolve()
    for (const name of COLLECTIONS) {
      const store = tx.objectStore(name)
      for (const row of Object.values(data[name])) store.put(row)
      for (const id of previousIds[name] ?? []) {
        if (!nextIds[name].has(id)) store.delete(id)
      }
    }
  })

  return nextIds
}

export async function clearAll(): Promise<void> {
  const db = await openDb()
  if (!db) {
    for (const name of COLLECTIONS) lsWrite(name, [])
    return
  }
  await new Promise<void>((resolve) => {
    const tx = db.transaction(COLLECTIONS as unknown as string[], 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
    for (const name of COLLECTIONS) tx.objectStore(name).clear()
  })
}

/* ------------------------------------------------------------------ settings */

/** Small UI/app preferences. Always localStorage — tiny and read synchronously. */
export function readSetting<T>(key: string, fallback: T): T {
  return lsRead<T>('setting:' + key, fallback)
}

export function writeSetting(key: string, value: unknown): void {
  lsWrite('setting:' + key, value)
}

export const emptyIdSets = (): Record<CollectionName, Set<string>> => {
  const out = {} as Record<CollectionName, Set<string>>
  for (const name of COLLECTIONS) out[name] = new Set()
  return out
}
