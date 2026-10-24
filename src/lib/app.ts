// Zentraler App-Zustand: Entsperren, persönliche Daten, Gruppen, Geräte-Kopplung, Backup.
import * as Y from 'yjs'
import { signal, computed } from '@preact/signals'
import { joinRoom, type DataPayload } from 'trystero'
import {
  aesDecrypt,
  aesEncrypt,
  b64,
  deriveKey,
  fromUtf8,
  openSealed,
  randomBytes,
  randomId,
  randomPassword,
  sealTo,
  sha256hex,
  unb64,
  utf8,
} from './crypto'
import { deleteDocStorage, local, persistDoc, wipeAll } from './store'
import {
  createVault,
  hasVault,
  hydrate,
  loadIdentityData,
  newIdentity,
  saveIdentity,
  unlock,
  type Identity,
  type IdentityData,
  type Signed,
} from './vault'
import {
  GroupModel,
  ownKey,
  type BringData,
  type ContentRef,
  type EventData,
  type ModData,
  type RatingData,
  type RekeyData,
  type ReportData,
  type RsvpData,
  type StrainData,
  type VoteData,
  type VoteResult,
} from './model'
import { APP_ID, Peering, roomIdFor, type Hello } from './sync'
import { STARTER_STRAINS } from './strains'

export type GroupEntry = {
  docId: string
  name: string
  roomId: string
  password: string
  founder?: string
  joined: number
  rekeyT?: number
  prev?: { roomId: string; password: string; until: number }
}

export type Phase = 'loading' | 'welcome' | 'locked' | 'ready'
export const phase = signal<Phase>('loading')
export const me = signal<Identity | null>(null)
let identityData: IdentityData | null = null
let masterKey: CryptoKey | null = null

export const personal = new Y.Doc()
export const personalVersion = signal(0)
personal.on('update', () => personalVersion.value++)
export const pProfile = personal.getMap<string>('profile')
export const pGroups = personal.getMap<GroupEntry>('groups')
export const pPrivate = personal.getMap<RatingData>('private')
export const pStrains = personal.getMap<StrainData>('strains')
export const pWishlist = personal.getMap<number>('wishlist')
export const pPhotos = personal.getMap<Uint8Array>('photos')

export const deviceName = signal(local.get('deviceName') || guessDevice())
function guessDevice() {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/iPad/.test(ua)) return 'iPad'
  if (/Android/.test(ua)) return 'Android'
  if (/Mac/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows-PC'
  return 'Computer'
}
export function setDeviceName(n: string) {
  deviceName.value = n
  local.set('deviceName', n)
  devicePeering?.announce()
}

export const profile = computed(() => {
  personalVersion.value
  return { name: pProfile.get('name') || 'Unbekannt', avatar: pProfile.get('avatar') || '🌸' }
})

// ---------- Gruppen ----------

export class GroupRuntime {
  doc = new Y.Doc()
  model: GroupModel
  peering?: Peering
  legacy?: Peering
  private unpersist?: () => void
  private credKey = ''
  private handledRekeys = new Set<string>()
  private stopWatch?: () => void

  constructor(public entry: GroupEntry) {
    this.model = new GroupModel(
      this.doc,
      () => this.entry.founder,
      () => me.peek()?.id,
    )
  }

  async start(key: CryptoKey) {
    this.unpersist = await persistDoc(this.doc, 'g:' + this.entry.docId, key)
    this.connect()
    const onVersion = () => void this.afterChange()
    this.stopWatch = this.model.version.subscribe(onVersion)
  }

  private hello = (): Hello => ({ member: me.peek()?.id, ...profile.peek(), device: deviceName.peek() })

  connect() {
    const e = this.entry
    const key = `${e.roomId}|${e.password}|${e.prev?.roomId ?? ''}`
    if (key === this.credKey) return
    this.credKey = key
    this.peering?.destroy()
    this.legacy?.destroy()
    this.legacy = undefined
    const common = {
      hello: this.hello,
      getRekeys: () => this.model.rawRekeys(),
      onRekeys: (recs: unknown[]) => this.importRekeys(recs),
    }
    this.peering = new Peering({ roomId: e.roomId, password: e.password, doc: this.doc, mode: 'full', ...common })
    if (e.prev && e.prev.until > Date.now())
      this.legacy = new Peering({ roomId: e.prev.roomId, password: e.prev.password, mode: 'legacy', ...common })
    groupsTick.value++
  }

  update(entry: GroupEntry) {
    this.entry = entry
    this.model.bump()
    this.connect()
  }

  /** Wechsel-Hinweise aus dem alten Raum übernehmen (sie sind signiert und werden geprüft). */
  private importRekeys(recs: unknown[]) {
    const map = this.model.map<RekeyData>('rekeys')
    this.doc.transact(() => {
      for (const r of recs) {
        if (!Array.isArray(r) || r.length !== 2) continue
        const [k, rec] = r as [string, Signed<RekeyData>]
        if (typeof k === 'string' && rec?.d && rec.s && !map.has(k)) map.set(k, rec)
      }
    }, 'rekey-import')
  }

  private async afterChange() {
    const m = me.peek()
    if (!m) return
    const snap = this.model.snapshot()
    // Gründer beim ersten Kontakt merken
    if (!this.entry.founder && snap.info) setEntry({ ...this.entry, founder: snap.info.founder })
    // Eigenen Mitgliedseintrag aktuell halten
    const mine = snap.members.get(m.id)
    const p = profile.peek()
    const raw = this.model.map('members').get(m.id)
    if (!snap.banned.has(m.id) && (!raw || (mine && (mine.name !== p.name || mine.avatar !== p.avatar)))) {
      await this.model.put(m, 'members', m.id, { id: m.id, name: p.name, avatar: p.avatar, signPub: m.signPub, dhPub: m.dhPub, t: Date.now() })
    }
    // Angenommene Abstimmung, die ich gestartet habe? Dann den Umzug selbst ausführen.
    for (const v of snap.votes)
      if (v.a === m.id && v.kind === 'remove' && v.status === 'passed' && !snap.rekeys.some((r) => r.reason === 'vote:' + v.id) && !this.handledRekeys.has('vote:' + v.id)) {
        this.handledRekeys.add('vote:' + v.id)
        void executeVote(this, v)
      }
    // Schlüsselwechsel (durch Admin, Ablehnung oder Abstimmung)?
    for (const rk of [...snap.rekeys].sort((x, y) => x.t - y.t)) {
      const sealed = rk.payloads[m.id]
      if (!sealed || rk.t <= (this.entry.rekeyT ?? 0) || this.handledRekeys.has(rk.id)) continue
      this.handledRekeys.add(rk.id)
      try {
        const creds = await openSealed<{ roomId: string; password: string }>(m.dhKey, sealed)
        setEntry({
          ...this.entry,
          roomId: creds.roomId,
          password: creds.password,
          rekeyT: rk.t,
          prev: { roomId: this.entry.roomId, password: this.entry.password, until: Date.now() + 14 * 864e5 },
        })
        this.peering?.pushRekeys()
      } catch (e) {
        console.warn('Schlüsselwechsel konnte nicht geöffnet werden', e)
      }
    }
  }

  destroy() {
    this.stopWatch?.()
    this.peering?.destroy()
    this.legacy?.destroy()
    this.unpersist?.()
    this.doc.destroy()
  }
}

export const groups = new Map<string, GroupRuntime>()
export const groupsTick = signal(0)
export const activeGroupId = signal<string | null>(local.get('activeGroup'))
export function setActiveGroup(id: string | null) {
  activeGroupId.value = id
  local.set('activeGroup', id)
}
export const activeGroup = computed(() => {
  groupsTick.value
  const id = activeGroupId.value
  return (id && groups.get(id)) || groups.values().next().value || null
})

function setEntry(e: GroupEntry) {
  pGroups.set(e.docId, e)
}

let syncing: Promise<void> = Promise.resolve()
function syncGroups() {
  syncing = syncing.then(async () => {
    if (!masterKey) return
    for (const [id, e] of pGroups.entries()) {
      const rt = groups.get(id)
      if (rt) rt.update(e)
      else {
        const n = new GroupRuntime(e)
        groups.set(id, n)
        await n.start(masterKey)
      }
    }
    for (const [id, rt] of groups)
      if (!pGroups.has(id)) {
        rt.destroy()
        groups.delete(id)
        void deleteDocStorage('g:' + id)
      }
    groupsTick.value++
  })
  return syncing
}

export async function createGroup(name: string, password = randomPassword()) {
  const m = me.peek()!
  const e: GroupEntry = { docId: randomId(), name: name.trim(), roomId: await roomIdFor(name, password), password, founder: m.id, joined: Date.now() }
  setEntry(e)
  await syncGroups()
  const rt = groups.get(e.docId)!
  await rt.model.put(m, 'info', 'info', { name: e.name, founder: m.id, t: Date.now() })
  setActiveGroup(e.docId)
  return rt
}

export async function joinGroup(name: string, password: string, founder?: string) {
  const roomId = await roomIdFor(name, password)
  const existing = [...pGroups.values()].find((g) => g.roomId === roomId)
  if (existing) {
    setActiveGroup(existing.docId)
    return groups.get(existing.docId)
  }
  const e: GroupEntry = { docId: randomId(), name: name.trim(), roomId, password, founder, joined: Date.now() }
  setEntry(e)
  await syncGroups()
  setActiveGroup(e.docId)
  return groups.get(e.docId)
}

export function leaveGroup(docId: string) {
  pGroups.delete(docId)
  if (activeGroupId.peek() === docId) setActiveGroup(null)
}

export function inviteLink(rt: GroupRuntime) {
  const payload = b64(utf8(JSON.stringify({ n: rt.entry.name, p: rt.entry.password, f: rt.entry.founder })))
  return `${location.origin}${location.pathname}#/join?i=${payload}`
}

export function parseInvite(i: string): { n: string; p: string; f?: string } | null {
  try {
    const v = JSON.parse(fromUtf8(unb64(i)))
    return typeof v.n === 'string' && typeof v.p === 'string' ? v : null
  } catch {
    return null
  }
}

/** Admin: Rolle setzen. */
export async function setRole(rt: GroupRuntime, target: string, role: 'admin' | 'member') {
  const m = me.peek()!
  await rt.model.put(m, 'roles', ownKey(m.id) + randomId(), { target, role, t: Date.now() })
}

/**
 * Gruppe in einen neuen Raum umziehen lassen. Weil es keinen Server gibt, der jemanden aussperren könnte,
 * bekommen alle verbleibenden freigegebenen Mitglieder neue, für sie persönlich verschlüsselte Zugangsdaten.
 */
async function relocate(rt: GroupRuntime, target: string, reason: string) {
  const m = me.peek()!
  const snap = rt.model.snapshot()
  if (snap.rekeys.some((r) => r.reason === reason)) return
  const creds = { roomId: 'fp-' + (await sha256hex(randomBytes(32))).slice(0, 40), password: randomPassword(5) }
  const payloads: RekeyData['payloads'] = {}
  for (const mem of snap.members.values())
    if (mem.id !== target && !snap.banned.has(mem.id) && (snap.approved.has(mem.id) || mem.id === m.id))
      payloads[mem.id] = await sealTo(mem.dhPub, creds)
  const id = ownKey(m.id) + randomId()
  await rt.model.put(m, 'rekeys', id, { id, t: Date.now() + 1, payloads, reason })
}

/** Admin: Mitglied sofort entfernen. */
export async function removeMember(rt: GroupRuntime, target: string) {
  const m = me.peek()!
  await rt.model.put(m, 'roles', ownKey(m.id) + randomId(), { target, role: 'ban', t: Date.now() })
  await relocate(rt, target, 'ban:' + target)
}

/** Beliebiges Mitglied: Wartende Person freigeben. */
export async function approveMember(rt: GroupRuntime, target: string) {
  const m = me.peek()!
  await rt.model.put(m, 'approvals', ownKey(m.id) + target, { target, t: Date.now() })
}

/** Beliebiges Mitglied: Wartende Person ablehnen – sie verliert mit dem Umzug den Zugang. */
export async function rejectPending(rt: GroupRuntime, target: string) {
  const m = me.peek()!
  await rt.model.put(m, 'roles', ownKey(m.id) + randomId(), { target, role: 'ban', t: Date.now() })
  await relocate(rt, target, 'ban:' + target)
}

// ---------- Moderation ----------

export async function moderate(rt: GroupRuntime, d: Omit<ModData, 'id' | 't'>) {
  const m = me.peek()!
  const id = ownKey(m.id) + randomId()
  await rt.model.put(m, 'mod', id, { ...d, id, t: Date.now() })
}

export async function report(rt: GroupRuntime, ref: ContentRef, reason: string) {
  const m = me.peek()!
  const id = ownKey(m.id) + randomId()
  await rt.model.put(m, 'reports', id, { id, ref, reason, t: Date.now() })
}

export async function dismissReport(rt: GroupRuntime, r: ReportData & { a: string }) {
  // Nur eigene Meldungen lassen sich löschen; Admins blenden sie über „erledigt“ lokal aus
  const m = me.peek()!
  if (r.a === m.id) await rt.model.put(m, 'reports', r.id, { ...r, deleted: true })
}

export async function startVote(rt: GroupRuntime, d: Omit<VoteData, 'id' | 't'>) {
  const m = me.peek()!
  const id = ownKey(m.id) + randomId()
  await rt.model.put(m, 'votes', id, { ...d, id, t: Date.now() })
  await castBallot(rt, id, true)
  return id
}

export async function castBallot(rt: GroupRuntime, vote: string, yes: boolean) {
  const m = me.peek()!
  await rt.model.put(m, 'ballots', ownKey(m.id) + vote, { vote, yes, t: Date.now() })
}

/** Angenommene Abstimmung zum Entfernen umsetzen (Umzug). */
export async function executeVote(rt: GroupRuntime, v: VoteResult) {
  if (v.kind === 'remove' && v.status === 'passed' && v.target) await relocate(rt, v.target, 'vote:' + v.id)
}

// ---------- Treffen ----------

export async function saveEvent(rt: GroupRuntime, d: Omit<EventData, 't' | 'id'> & { id?: string }) {
  const m = me.peek()!
  const id = d.id ?? ownKey(m.id) + randomId()
  await rt.model.put(m, 'events', id, { ...d, id, t: Date.now() })
  return id
}

export async function rsvp(rt: GroupRuntime, event: string, status: RsvpData['status']) {
  const m = me.peek()!
  await rt.model.put(m, 'rsvps', ownKey(m.id) + event, { event, status, t: Date.now() })
}

export async function addBring(rt: GroupRuntime, event: string, text: string, strainId?: string) {
  const m = me.peek()!
  const id = ownKey(m.id) + randomId()
  await rt.model.put(m, 'brings', id, { id, event, text, strainId, t: Date.now() })
}

export async function removeBring(rt: GroupRuntime, b: BringData) {
  const m = me.peek()!
  await rt.model.put(m, 'brings', b.id, { ...b, deleted: true })
}

// ---------- Eigene Geräte ----------

let devicePeering: Peering | null = null
export const devicePeers = signal<Record<string, Hello>>({})

async function startDevicePeering(id: IdentityData) {
  devicePeering?.destroy()
  const roomId = 'fpdev-' + (await sha256hex('device\n' + id.deviceSecret)).slice(0, 40)
  devicePeering = new Peering({ roomId, password: id.deviceSecret, doc: personal, mode: 'full', hello: () => ({ device: deviceName.peek() }) })
  devicePeering.peers.subscribe((p) => (devicePeers.value = p))
}

type Bundle = { identity: IdentityData; personal: Uint8Array }

export type PairRequest = { device: string; accept: () => void; reject: () => void }
export const pairRequest = signal<PairRequest | null>(null)

/** Altes Gerät: Kopplungsraum öffnen und auf das neue Gerät warten. */
export function startPairing(onDone: () => void) {
  const code = randomId(15)
  const room = joinRoom({ appId: APP_ID, password: code }, 'fppair-' + code)
  const hi = room.makeAction<{ device: string }>('hi')
  const bundle = room.makeAction('bundle')
  hi.onMessage = (data, { peerId }) => {
    pairRequest.value = {
      device: String(data?.device ?? 'Unbekanntes Gerät').slice(0, 40),
      accept: () => {
        pairRequest.value = null
        void bundle.send({ identity: identityData!, personal: Y.encodeStateAsUpdate(personal) } as unknown as DataPayload, { target: peerId }).then(() => {
          setTimeout(() => void room.leave(), 3000)
          onDone()
        })
      },
      reject: () => {
        pairRequest.value = null
      },
    }
  }
  const link = `${location.origin}${location.pathname}#/pair?c=${code}`
  return { link, code, cancel: () => void room.leave() }
}

/** Neues Gerät: dem Kopplungsraum beitreten und die Identität empfangen. */
export function receivePairing(code: string, onStatus: (s: string) => void): Promise<Bundle> {
  return new Promise((resolve) => {
    const room = joinRoom({ appId: APP_ID, password: code }, 'fppair-' + code)
    const hi = room.makeAction<{ device: string }>('hi')
    const bundle = room.makeAction('bundle')
    onStatus('Suche das andere Gerät …')
    room.onPeerJoin = (peer) => {
      onStatus('Verbunden – bitte auf dem anderen Gerät bestätigen.')
      void hi.send({ device: deviceName.peek() }, { target: peer })
    }
    bundle.onMessage = (raw) => {
      const data = raw as unknown as Bundle
      onStatus('Daten empfangen.')
      void room.leave()
      resolve({ identity: data.identity, personal: new Uint8Array(data.personal as unknown as ArrayBuffer) })
    }
  })
}

// ---------- Start, Konto, Sperre ----------

export async function boot() {
  phase.value = (await hasVault()) ? 'locked' : 'welcome'
}

async function open(key: CryptoKey, id: IdentityData) {
  masterKey = key
  identityData = id
  me.value = await hydrate(id)
  await persistDoc(personal, 'personal', key)
  pGroups.observe(() => void syncGroups())
  await syncGroups()
  await startDevicePeering(id)
  phase.value = 'ready'
}

export async function unlockWithPin(pin: string) {
  const key = await unlock(pin)
  if (!key) return false
  const id = await loadIdentityData(key)
  if (!id) return false
  await open(key, id)
  return true
}

export type Restore = { identity: IdentityData; personal?: Uint8Array; groups?: Record<string, Uint8Array> }

export async function createAccount(opts: { pin: string; name?: string; avatar?: string; restore?: Restore }) {
  const key = await createVault(opts.pin)
  const id = opts.restore?.identity ?? (await newIdentity())
  await saveIdentity(key, id)
  await open(key, id)
  if (opts.restore?.personal) Y.applyUpdate(personal, opts.restore.personal, 'restore')
  if (opts.name) pProfile.set('name', opts.name)
  if (opts.avatar) pProfile.set('avatar', opts.avatar)
  await syncGroups()
  for (const [docId, u] of Object.entries(opts.restore?.groups ?? {})) {
    const rt = groups.get(docId)
    if (rt) Y.applyUpdate(rt.doc, u, 'restore')
  }
}

export function setProfile(name: string, avatar: string) {
  personal.transact(() => {
    pProfile.set('name', name)
    pProfile.set('avatar', avatar)
  })
  for (const rt of groups.values()) {
    rt.model.bump()
    rt.peering?.announce()
  }
}

export function lockNow() {
  location.reload()
}

export async function resetEverything() {
  await wipeAll()
  location.href = location.pathname + location.search
}

// ---------- Backup ----------

type BackupPayload = { v: 1; identity: IdentityData; personal: string; groups: Record<string, string>; t: number }

export async function exportBackup(password: string): Promise<Blob> {
  const payload: BackupPayload = {
    v: 1,
    identity: identityData!,
    personal: b64(Y.encodeStateAsUpdate(personal)),
    groups: Object.fromEntries([...groups].map(([id, rt]) => [id, b64(Y.encodeStateAsUpdate(rt.doc))])),
    t: Date.now(),
  }
  const salt = randomBytes(16)
  const data = await aesEncrypt(await deriveKey(password, salt), utf8(JSON.stringify(payload)))
  return new Blob([JSON.stringify({ flowerpower: 1, salt: b64(salt), data: b64(data) })], { type: 'application/json' })
}

export async function readBackup(file: File, password: string): Promise<Restore> {
  const j = JSON.parse(await file.text())
  if (!j?.flowerpower) throw new Error('Das ist keine FlowerPower-Sicherung.')
  let raw: Uint8Array
  try {
    raw = await aesDecrypt(await deriveKey(password, unb64(j.salt)), unb64(j.data))
  } catch {
    throw new Error('Falsches Passwort für die Sicherung.')
  }
  const p = JSON.parse(fromUtf8(raw)) as BackupPayload
  return {
    identity: p.identity,
    personal: unb64(p.personal),
    groups: Object.fromEntries(Object.entries(p.groups).map(([k, v]) => [k, unb64(v)])),
  }
}

/** Sicherung in ein bestehendes Konto einspielen (nur gleiche Identität). */
export async function mergeBackup(r: Restore) {
  if (r.identity.id !== me.peek()?.id) throw new Error('Diese Sicherung gehört zu einer anderen Identität.')
  if (r.personal) Y.applyUpdate(personal, r.personal, 'restore')
  await syncGroups()
  for (const [docId, u] of Object.entries(r.groups ?? {})) groups.get(docId) && Y.applyUpdate(groups.get(docId)!.doc, u, 'restore')
}

// ---------- Sorten ----------

/** Alle Sorten, die gerade sichtbar sind: Startliste + Gruppe + eigene private. */
export function allStrains(rt: GroupRuntime | null): (StrainData & { a?: string; origin: 'start' | 'group' | 'private' })[] {
  const out = new Map<string, StrainData & { a?: string; origin: 'start' | 'group' | 'private' }>()
  for (const s of STARTER_STRAINS) out.set(s.id, { ...s, origin: 'start' })
  if (rt) for (const s of rt.model.snapshot().strains) out.set(s.id, { ...s, origin: 'group' })
  for (const s of pStrains.values()) if (!s.deleted) out.set(s.id, { ...s, origin: 'private' })
  return [...out.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

export function findStrain(rt: GroupRuntime | null, id: string) {
  return allStrains(rt).find((s) => s.id === id)
}
