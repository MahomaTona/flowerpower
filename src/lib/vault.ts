// PIN-Sperre und Identität. Ein zufälliger Hauptschlüssel verschlüsselt alle Daten;
// er selbst liegt nur mit der PIN verschlüsselt im Speicher.
import {
  aesDecrypt,
  aesEncrypt,
  canon,
  deriveKey,
  genDhKeys,
  genSigningKeys,
  idFromPub,
  importAes,
  importDhPriv,
  importSignPriv,
  randomBytes,
  randomId,
  sign,
} from './crypto'
import { kv, secret } from './store'

type LockRec = { salt: Uint8Array; iter: number; wrapped: Uint8Array }

export type IdentityData = {
  id: string
  signPub: string
  signPriv: JsonWebKey
  dhPub: string
  dhPriv: JsonWebKey
  /** Geheimnis für den Abgleich zwischen den eigenen Geräten. */
  deviceSecret: string
  created: number
}

export type Identity = IdentityData & { signKey: CryptoKey; dhKey: CryptoKey }

export const hasVault = async () => !!(await kv.get<LockRec>('lock'))

async function wrap(pin: string, master: Uint8Array): Promise<LockRec> {
  const salt = randomBytes(16)
  const iter = 400_000
  return { salt, iter, wrapped: await aesEncrypt(await deriveKey(pin, salt, iter), master) }
}

export async function createVault(pin: string): Promise<CryptoKey> {
  const master = randomBytes(32)
  await kv.set('lock', await wrap(pin, master))
  return importAes(master)
}

async function unwrapRaw(pin: string): Promise<Uint8Array | null> {
  const rec = await kv.get<LockRec>('lock')
  if (!rec) return null
  try {
    return await aesDecrypt(await deriveKey(pin, rec.salt, rec.iter), rec.wrapped)
  } catch {
    return null
  }
}

export async function unlock(pin: string): Promise<CryptoKey | null> {
  const raw = await unwrapRaw(pin)
  return raw ? importAes(raw) : null
}

export async function changePin(oldPin: string, newPin: string): Promise<boolean> {
  const raw = await unwrapRaw(oldPin)
  if (!raw) return false
  await kv.set('lock', await wrap(newPin, raw))
  return true
}

export async function newIdentity(): Promise<IdentityData> {
  const s = await genSigningKeys()
  const d = await genDhKeys()
  return {
    id: await idFromPub(s.pub),
    signPub: s.pub,
    signPriv: s.priv,
    dhPub: d.pub,
    dhPriv: d.priv,
    deviceSecret: randomId(24),
    created: Date.now(),
  }
}

export const saveIdentity = (key: CryptoKey, id: IdentityData) => secret.set(key, 'identity', id)
export const loadIdentityData = (key: CryptoKey) => secret.get<IdentityData>(key, 'identity')

export async function hydrate(d: IdentityData): Promise<Identity> {
  return { ...d, signKey: await importSignPriv(d.signPriv), dhKey: await importDhPriv(d.dhPriv) }
}

export type Signed<T> = { d: T; a: string; s: string }

/** Der Map-Name gehört zur Signatur, damit ein Datensatz nicht in eine andere Liste verschoben werden kann. */
export const signMsg = (map: string, a: string, d: unknown) => `${map}\n${a}\n${canon(d)}`

export async function signRec<T>(me: Identity, map: string, d: T): Promise<Signed<T>> {
  return { d, a: me.id, s: await sign(me.signKey, signMsg(map, me.id, d)) }
}
