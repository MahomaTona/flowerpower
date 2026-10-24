// Lokaler Speicher: IndexedDB für verschlüsselte Daten, localStorage nur für unkritische Einstellungen
// (Theme, diskreter Modus), die schon vor dem Entsperren gebraucht werden.
import * as Y from 'yjs'
import { aesDecrypt, aesEncrypt, decryptJson, encryptJson } from './crypto'

/** ?p=name trennt Profile im selben Browser – praktisch zum Testen mit mehreren Nutzern. */
export const profile = new URLSearchParams(location.search).get('p') || ''
const ns = 'fp' + (profile ? '-' + profile : '') + '.'

export const local = {
  get: (k: string) => {
    try {
      return localStorage.getItem(ns + k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(ns + k)
      else localStorage.setItem(ns + k, v)
    } catch {
      /* privater Modus o. Ä. */
    }
  },
}

const DB_NAME = 'flowerpower' + (profile ? '-' + profile : '')
let dbp: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  if (!dbp)
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1)
      r.onupgradeneeded = () => {
        const d = r.result
        d.createObjectStore('kv')
        const u = d.createObjectStore('updates', { keyPath: 'id', autoIncrement: true })
        u.createIndex('doc', 'doc')
      }
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
  return dbp
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

async function tx(store: string, mode: IDBTransactionMode) {
  return (await db()).transaction(store, mode).objectStore(store)
}

export const kv = {
  get: async <T>(k: string): Promise<T | undefined> => req((await tx('kv', 'readonly')).get(k)),
  set: async (k: string, v: unknown) => req((await tx('kv', 'readwrite')).put(v, k)),
  del: async (k: string) => req((await tx('kv', 'readwrite')).delete(k)),
}

/** Verschlüsselter Wert im kv-Store. */
export const secret = {
  get: async <T>(key: CryptoKey, k: string): Promise<T | undefined> => {
    const b = await kv.get<Uint8Array>(k)
    return b ? decryptJson<T>(key, b) : undefined
  },
  set: async (key: CryptoKey, k: string, v: unknown) => kv.set(k, await encryptJson(key, v)),
}

type UpdateRec = { id?: number; doc: string; blob: Uint8Array }

async function getUpdates(doc: string): Promise<UpdateRec[]> {
  const s = await tx('updates', 'readonly')
  return req(s.index('doc').getAll(IDBKeyRange.only(doc)))
}

async function replaceUpdates(doc: string, blob: Uint8Array) {
  const d = await db()
  const t = d.transaction('updates', 'readwrite')
  const s = t.objectStore('updates')
  const keys = await req(s.index('doc').getAllKeys(IDBKeyRange.only(doc)))
  for (const k of keys) s.delete(k)
  s.add({ doc, blob })
  await new Promise((res, rej) => {
    t.oncomplete = res
    t.onerror = () => rej(t.error)
  })
}

export async function deleteDocStorage(doc: string) {
  const s = await tx('updates', 'readwrite')
  const keys = await req(s.index('doc').getAllKeys(IDBKeyRange.only(doc)))
  for (const k of keys) await req(s.delete(k))
}

export async function wipeAll() {
  try {
    ;(await db()).close()
  } catch {
    /* egal */
  }
  await new Promise((res) => {
    const r = indexedDB.deleteDatabase(DB_NAME)
    r.onsuccess = r.onerror = r.onblocked = res
  })
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(ns)) localStorage.removeItem(k)
  } catch {
    /* egal */
  }
}

/**
 * Lädt ein Y.Doc aus dem verschlüsselten Speicher und schreibt jede weitere Änderung
 * verschlüsselt mit. Gibt eine Funktion zum Abmelden zurück.
 */
export async function persistDoc(doc: Y.Doc, name: string, key: CryptoKey): Promise<() => void> {
  const recs = await getUpdates(name)
  const loaded: Uint8Array[] = []
  for (const r of recs) {
    try {
      loaded.push(await aesDecrypt(key, r.blob))
    } catch {
      console.warn('Konnte gespeicherten Datensatz nicht entschlüsseln', name)
    }
  }
  if (loaded.length) Y.applyUpdate(doc, Y.mergeUpdates(loaded), 'persist')
  let count = recs.length
  const compact = async () => {
    await replaceUpdates(name, await aesEncrypt(key, Y.encodeStateAsUpdate(doc)))
    count = 1
  }
  if (count > 30) await compact()

  let queue: Uint8Array[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = async () => {
    timer = undefined
    if (!queue.length) return
    const merged = Y.mergeUpdates(queue)
    queue = []
    // Erst verschlüsseln, dann die Transaktion öffnen – sonst schließt IndexedDB sie während des await
    const blob = await aesEncrypt(key, merged)
    const s = await tx('updates', 'readwrite')
    await req(s.add({ doc: name, blob }))
    if (++count > 150) await compact()
  }
  const onUpdate = (u: Uint8Array, origin: unknown) => {
    if (origin === 'persist') return
    queue.push(u)
    if (!timer) timer = setTimeout(flush, 250)
  }
  doc.on('update', onUpdate)
  const onHide = () => void flush()
  addEventListener('pagehide', onHide)
  return () => {
    doc.off('update', onUpdate)
    removeEventListener('pagehide', onHide)
    void flush()
  }
}
