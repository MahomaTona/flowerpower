// Datenmodell einer Gruppe. Jeder Eintrag ist vom Autor signiert; beim Lesen wird geprüft,
// dass Signatur, Autor und Schlüssel zusammenpassen. Fremde Einträge lassen sich so nicht fälschen.
import * as Y from 'yjs'
import { signal } from '@preact/signals'
import { idFromPub, verify, type Sealed } from './crypto'
import { signMsg, signRec, type Identity, type Signed } from './vault'

export type MemberData = { id: string; name: string; avatar: string; signPub: string; dhPub: string; t: number }
export type InfoData = { name: string; founder: string; t: number }
export type RoleData = { target: string; role: 'admin' | 'member' | 'ban'; t: number }

export type StrainData = {
  id: string
  name: string
  type: string
  lineage?: string
  breeder?: string
  thc?: [number, number]
  cbd?: [number, number]
  terpenes: string[]
  aromas: string[]
  t: number
  deleted?: boolean
}

export type RatingData = {
  id: string
  strainId: string
  t: number
  /** Tag des Konsums, YYYY-MM-DD */
  date: string
  source?: string
  batch?: string
  form?: string
  vapeTemp?: number
  quality: Record<string, number>
  burn?: string
  ash?: string
  aromas: string[]
  tastes: string[]
  /** Wirkung → Stärke 1–3 */
  effects: Record<string, number>
  overall: number
  again?: boolean
  note?: string
  photo?: { id: string; hash: string }
  sessionId?: string
  deleted?: boolean
}

export type CommentData = { id: string; on: string; text: string; t: number; deleted?: boolean }
export type ReactionData = { on: string; e: string; active: boolean; t: number }
export type SessionData = { id: string; strainId: string; batch?: string; t: number; status: 'open' | 'revealed' | 'closed' }
export type RekeyData = { id: string; t: number; payloads: Record<string, Sealed> }

export type Authored<T> = T & { a: string }

export type Snapshot = {
  info?: InfoData
  founder?: string
  members: Map<string, MemberData>
  admins: Set<string>
  banned: Set<string>
  /** Zeitpunkt des Entfernens je Mitglied */
  bannedAt: Map<string, number>
  strains: Authored<StrainData>[]
  ratings: Authored<RatingData>[]
  comments: Authored<CommentData>[]
  reactions: Authored<ReactionData>[]
  sessions: Authored<SessionData>[]
  rekeys: Authored<RekeyData>[]
}

type MapName = 'info' | 'members' | 'roles' | 'strains' | 'ratings' | 'comments' | 'reactions' | 'sessions' | 'rekeys'

export const ownKey = (a: string) => `${a}~`

export class GroupModel {
  readonly version = signal(0)
  readonly photos: Y.Map<Uint8Array>
  private valid = new Map<string, boolean>()
  private pending = new Set<string>()
  private cache?: { v: number; s: Snapshot }
  private scheduled = false

  constructor(
    readonly doc: Y.Doc,
    /** Gründer-ID, die wir bereits kennen (aus Einladung oder erstem Kontakt). */
    private founderHint: () => string | undefined,
  ) {
    this.photos = doc.getMap('photos')
    doc.on('update', () => this.bump())
  }

  map<T>(n: MapName) {
    return this.doc.getMap<Signed<T>>(n)
  }

  bump() {
    if (this.scheduled) return
    this.scheduled = true
    setTimeout(() => {
      this.scheduled = false
      this.version.value++
    }, 30)
  }

  /** Signaturprüfung mit Cache. undefined = wird gerade geprüft. */
  private check(rec: Signed<unknown>, run: () => Promise<boolean>): boolean | undefined {
    const k = rec.s
    const v = this.valid.get(k)
    if (v !== undefined) return v
    if (!this.pending.has(k)) {
      this.pending.add(k)
      run()
        .catch(() => false)
        .then((ok) => {
          this.valid.set(k, ok)
          this.pending.delete(k)
          this.bump()
        })
    }
    return undefined
  }

  private checkBy(map: MapName, rec: Signed<unknown>, members: Map<string, MemberData>) {
    const m = members.get(rec.a)
    if (!m) return false
    return this.check(rec, () => verify(m.signPub, signMsg(map, rec.a, rec.d), rec.s)) === true
  }

  snapshot(): Snapshot {
    const v = this.version.peek()
    if (this.cache?.v === v) return this.cache.s

    const members = new Map<string, MemberData>()
    this.map<MemberData>('members').forEach((rec, key) => {
      const d = rec?.d
      if (!d || rec.a !== key || d.id !== key) return
      const ok = this.check(rec, async () =>
        (await idFromPub(d.signPub)) === rec.a && verify(d.signPub, signMsg('members', rec.a, d), rec.s),
      )
      if (ok) members.set(key, d)
    })

    let info: InfoData | undefined
    const infoRec = this.map<InfoData>('info').get('info')
    const hint = this.founderHint()
    if (infoRec && infoRec.a === infoRec.d.founder && (!hint || hint === infoRec.a) && this.checkBy('info', infoRec, members))
      info = infoRec.d
    const founder = hint ?? info?.founder

    // Rollen in zeitlicher Reihenfolge anwenden – nur Admins dürfen Rollen vergeben.
    const admins = new Set<string>(founder ? [founder] : [])
    const bannedAt = new Map<string, number>()
    const roles: Signed<RoleData>[] = []
    this.map<RoleData>('roles').forEach((rec, key) => {
      if (rec?.d && key.startsWith(ownKey(rec.a)) && this.checkBy('roles', rec, members)) roles.push(rec)
    })
    roles.sort((x, y) => x.d.t - y.d.t)
    for (const r of roles) {
      if (!admins.has(r.a) || r.d.target === founder) continue
      if (r.d.role === 'admin') {
        admins.add(r.d.target)
        bannedAt.delete(r.d.target)
      } else if (r.d.role === 'ban') {
        bannedAt.set(r.d.target, r.d.t)
        admins.delete(r.d.target)
      } else {
        admins.delete(r.d.target)
        bannedAt.delete(r.d.target)
      }
    }
    const banned = new Set(bannedAt.keys())

    const collect = <T extends object>(name: MapName, filter?: (a: string, d: T) => boolean) => {
      const out: Authored<T>[] = []
      this.map<T>(name).forEach((rec, key) => {
        if (!rec?.d || !key.startsWith(ownKey(rec.a))) return
        const ban = bannedAt.get(rec.a)
        if (ban !== undefined && ((rec.d as { t?: number }).t ?? Infinity) > ban) return
        if ((rec.d as { deleted?: boolean }).deleted || (filter && !filter(rec.a, rec.d))) return
        if (this.checkBy(name, rec, members)) out.push({ ...rec.d, a: rec.a })
      })
      return out
    }

    const s: Snapshot = {
      info,
      founder,
      members,
      admins,
      banned,
      bannedAt,
      strains: collect<StrainData>('strains'),
      ratings: collect<RatingData>('ratings').sort((x, y) => y.t - x.t),
      comments: collect<CommentData>('comments').sort((x, y) => x.t - y.t),
      reactions: collect<ReactionData>('reactions', (_a, d) => d.active),
      sessions: collect<SessionData>('sessions').sort((x, y) => y.t - x.t),
      rekeys: collect<RekeyData>('rekeys', (a) => admins.has(a)),
    }
    this.cache = { v, s }
    return s
  }

  async put<T>(me: Identity, name: MapName, key: string, d: T) {
    // Autor steckt im Datensatz-Rahmen, nicht in den Daten (Snapshot-Objekte bringen ihn mit)
    const { a: _a, ...data } = d as T & { a?: string }
    const rec = await signRec(me, name, data as T)
    this.map<T>(name).set(key, rec)
  }

  rawRekeys(): [string, Signed<RekeyData>][] {
    return [...this.map<RekeyData>('rekeys').entries()]
  }
}
