// Kleine Hülle um WebCrypto: Base64, Hashes, AES-GCM, ECDSA-Signaturen, ECDH-Versiegelung.

const enc = new TextEncoder()
const dec = new TextDecoder()

export const utf8 = (s: string) => enc.encode(s)
export const fromUtf8 = (b: Uint8Array) => dec.decode(b)
const bs = (u: Uint8Array) => u as unknown as BufferSource
const subtle = crypto.subtle

export function b64(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function unb64(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n))
export const randomId = (n = 9) => b64(randomBytes(n))

export async function sha256(data: Uint8Array | string): Promise<Uint8Array> {
  const u = typeof data === 'string' ? utf8(data) : data
  return new Uint8Array(await subtle.digest('SHA-256', bs(u)))
}

export async function sha256hex(data: Uint8Array | string): Promise<string> {
  return [...(await sha256(data))].map((x) => x.toString(16).padStart(2, '0')).join('')
}

/** JSON mit sortierten Schlüsseln, damit Signaturen unabhängig von der Reihenfolge sind. */
export function canon(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null)
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']'
  const o = v as Record<string, unknown>
  return (
    '{' +
    Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => JSON.stringify(k) + ':' + canon(o[k]))
      .join(',') +
    '}'
  )
}

// ---------- AES-GCM ----------

export async function deriveKey(secret: string, salt: Uint8Array, iterations = 310_000): Promise<CryptoKey> {
  const base = await subtle.importKey('raw', bs(utf8(secret)), 'PBKDF2', false, ['deriveKey'])
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: bs(salt), iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export const importAes = (raw: Uint8Array) =>
  subtle.importKey('raw', bs(raw), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])

/** Ergebnis: 12 Byte IV gefolgt vom Chiffrat. */
export async function aesEncrypt(key: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  const iv = randomBytes(12)
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: bs(iv) }, key, bs(data)))
  const out = new Uint8Array(12 + ct.length)
  out.set(iv)
  out.set(ct, 12)
  return out
}

export async function aesDecrypt(key: CryptoKey, blob: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(
    await subtle.decrypt({ name: 'AES-GCM', iv: bs(blob.subarray(0, 12)) }, key, bs(blob.subarray(12))),
  )
}

export const encryptJson = async (key: CryptoKey, v: unknown) => aesEncrypt(key, utf8(JSON.stringify(v)))
export const decryptJson = async <T>(key: CryptoKey, b: Uint8Array): Promise<T> =>
  JSON.parse(fromUtf8(await aesDecrypt(key, b)))

// ---------- Signaturen (ECDSA P-256) ----------

const SIGN = { name: 'ECDSA', namedCurve: 'P-256' } as const
const SIGN_ALG = { name: 'ECDSA', hash: 'SHA-256' } as const

export async function genSigningKeys() {
  const kp = await subtle.generateKey(SIGN, true, ['sign', 'verify'])
  return {
    priv: await subtle.exportKey('jwk', kp.privateKey),
    pub: b64(await subtle.exportKey('raw', kp.publicKey)),
  }
}

export const importSignPriv = (jwk: JsonWebKey) => subtle.importKey('jwk', jwk, SIGN, false, ['sign'])

export async function sign(key: CryptoKey, msg: string): Promise<string> {
  return b64(await subtle.sign(SIGN_ALG, key, bs(utf8(msg))))
}

const pubCache = new Map<string, Promise<CryptoKey>>()
export async function verify(pub: string, msg: string, sig: string): Promise<boolean> {
  try {
    let k = pubCache.get(pub)
    if (!k) {
      k = subtle.importKey('raw', bs(unb64(pub)), SIGN, false, ['verify'])
      pubCache.set(pub, k)
    }
    return await subtle.verify(SIGN_ALG, await k, bs(unb64(sig)), bs(utf8(msg)))
  } catch {
    return false
  }
}

/** Kurze, stabile Nutzer-ID aus dem öffentlichen Signaturschlüssel. */
export async function idFromPub(pub: string): Promise<string> {
  return b64((await sha256(unb64(pub))).subarray(0, 12))
}

// ---------- Versiegeln für einen Empfänger (ECDH P-256 + HKDF + AES-GCM) ----------

const DH = { name: 'ECDH', namedCurve: 'P-256' } as const

export async function genDhKeys() {
  const kp = await subtle.generateKey(DH, true, ['deriveBits'])
  return {
    priv: await subtle.exportKey('jwk', kp.privateKey),
    pub: b64(await subtle.exportKey('raw', kp.publicKey)),
  }
}

export const importDhPriv = (jwk: JsonWebKey) => subtle.importKey('jwk', jwk, DH, false, ['deriveBits'])

async function sharedKey(priv: CryptoKey, pub: string): Promise<CryptoKey> {
  const pubKey = await subtle.importKey('raw', bs(unb64(pub)), DH, false, [])
  const bits = await subtle.deriveBits({ name: 'ECDH', public: pubKey }, priv, 256)
  const hk = await subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey'])
  return subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: bs(utf8('flowerpower-seal')) },
    hk,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export type Sealed = { e: string; c: string }

export async function sealTo(pub: string, value: unknown): Promise<Sealed> {
  const eph = await subtle.generateKey(DH, true, ['deriveBits'])
  const key = await sharedKey(eph.privateKey, pub)
  return { e: b64(await subtle.exportKey('raw', eph.publicKey)), c: b64(await encryptJson(key, value)) }
}

export async function openSealed<T>(priv: CryptoKey, s: Sealed): Promise<T> {
  const key = await sharedKey(priv, s.e)
  return decryptJson<T>(key, unb64(s.c))
}

/** Gut merkbares Zufallspasswort aus Wortsilben. */
export function randomPassword(words = 4): string {
  const syl = ['ka', 'lo', 'mi', 'ru', 'ze', 'ta', 'no', 'vi', 'sa', 'pe', 'du', 'ri', 'fo', 'la', 'ne', 'bo', 'ki', 'ma']
  const r = randomBytes(words * 3)
  const parts: string[] = []
  for (let w = 0; w < words; w++) parts.push(syl[r[w * 3] % syl.length] + syl[r[w * 3 + 1] % syl.length] + (r[w * 3 + 2] % 90 + 10))
  return parts.join('-')
}
