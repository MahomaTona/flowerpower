// Datenmodell einer Gruppe. Jeder Eintrag ist vom Autor signiert; beim Lesen wird geprüft,
// dass Signatur, Autor und Schlüssel zusammenpassen. Fremde Einträge lassen sich so nicht fälschen.
//
// Gruppenregeln (alle Geräte werten sie gleich aus, es gibt keinen Server, der entscheidet):
// - Neue Mitglieder sind „wartend“, bis ein freigegebenes Mitglied sie freigibt.
// - Admins (Gründer + ernannte) können sofort ausblenden, stummschalten und entfernen.
// - Jedes Mitglied kann Abstimmungen starten: entfernen, stummschalten, ausblenden.
//   Angenommen bei ⅔ der Abstimmenden nach 48 h (mind. 3 Stimmen) oder vorher bei ⅔ aller Stimmberechtigten.
import * as Y from 'yjs'
import { signal } from '@preact/signals'
import { idFromPub, verify, type Sealed } from './crypto'
import { signMsg, signRec, type Identity, type Signed } from './vault'

export type MemberData = { id: string; name: string; avatar: string; signPub: string; dhPub: string; t: number }
export type InfoData = { name: string; founder: string; t: number }
export type RoleData = { target: string; role: 'admin' | 'member' | 'ban'; t: number }
export type ApprovalData = { target: string; t: number }

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
export type SessionData = { id: string; strainId: string; batch?: string; eventId?: string; t: number; status: 'open' | 'revealed' | 'closed' }
/** reason: Schlüssel der Entfernung (Rollen-Eintrag oder Abstimmung), nötig wenn kein Admin umzieht. */
export type RekeyData = { id: string; t: number; payloads: Record<string, Sealed>; reason?: string }

export type EventData = {
  id: string
  title: string
  /** Beginn als Zeitstempel (ms) */
  start: number
  place: string
  note?: string
  strains: string[]
  status: 'planned' | 'cancelled'
  t: number
  deleted?: boolean
}
export type RsvpData = { event: string; status: 'yes' | 'maybe' | 'no'; t: number }
export type BringData = { id: string; event: string; text: string; strainId?: string; t: number; deleted?: boolean }

/** Inhalte, die ausgeblendet, gemeldet oder abgestimmt werden können. */
export type ContentMap = 'ratings' | 'comments' | 'strains' | 'events'
export type ContentRef = { map: ContentMap; id: string }
export const refKey = (r: ContentRef) => `${r.map}:${r.id}`

export type ModData = {
  id: string
  action: 'hide' | 'unhide' | 'mute' | 'unmute'
  ref?: ContentRef
  target?: string
  /** Ende der Stummschaltung (ms), fehlt = unbefristet */
  until?: number
  reason?: string
  t: number
}
export type ReportData = { id: string; ref: ContentRef; reason: string; t: number; deleted?: boolean }
export type VoteData = {
  id: string
  kind: 'remove' | 'mute' | 'hide'
  target?: string
  ref?: ContentRef
  /** Dauer der Stummschaltung in ms */
  duration?: number
  reason?: string
  t: number
}
export type BallotData = { vote: string; yes: boolean; t: number }

export const VOTE_WINDOW = 48 * 3600e3

export type VoteResult = Authored<VoteData> & {
  eligible: number
  yes: number
  no: number
  myBallot?: boolean
  deadline: number
  status: 'open' | 'passed' | 'failed'
  /** Zeitpunkt der Entscheidung */
  decidedAt?: number
}

export type Authored<T> = T & { a: string }

export type Snapshot = {
  info?: InfoData
  founder?: string
  members: Map<string, MemberData>
  admins: Set<string>
  /** Freigegeben (Gründer, Admins und alle, die ein freigegebenes Mitglied bestätigt hat) */
  approved: Set<string>
  /** Wartebereich: Mitglieder ohne Freigabe */
  pending: Set<string>
  banned: Set<string>
  /** Zeitpunkt des Entfernens je Mitglied */
  bannedAt: Map<string, number>
  /** Stummschaltungen: Mitglied → Zeiträume [von, bis] */
  muted: Map<string, [number, number][]>
  /** Ausgeblendete Inhalte (refKey) → Grund */
  hidden: Map<string, string>
  strains: Authored<StrainData>[]
  ratings: Authored<RatingData>[]
  comments: Authored<CommentData>[]
  reactions: Authored<ReactionData>[]
  sessions: Authored<SessionData>[]
  rekeys: Authored<RekeyData>[]
  events: Authored<EventData>[]
  rsvps: Authored<RsvpData>[]
  brings: Authored<BringData>[]
  reports: Authored<ReportData>[]
  votes: VoteResult[]
}

type MapName =
  | 'info'
  | 'members'
  | 'roles'
  | 'approvals'
  | 'strains'
  | 'ratings'
  | 'comments'
  | 'reactions'
  | 'sessions'
  | 'rekeys'
  | 'events'
  | 'rsvps'
  | 'brings'
  | 'mod'
  | 'reports'
  | 'votes'
  | 'ballots'

export const ownKey = (a: string) => `${a}~`

export function isMutedAt(snap: Pick<Snapshot, 'muted'>, a: string, t: number) {
  return (snap.muted.get(a) ?? []).some(([from, until]) => t >= from && t <= until)
}

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
    /** Eigene ID – eigene Beiträge sieht man auch, solange man wartet. */
    private self: () => string | undefined,
  ) {
    this.photos = doc.getMap('photos')
    doc.on('update', () => this.bump())
    // Abstimmungen laufen zeitbasiert ab, auch ohne neue Daten
    setInterval(() => this.bump(), 60_000)
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

  /** Alle gültig signierten Einträge einer Liste, deren Schlüssel dem Autor gehört. */
  private signed<T>(name: MapName, members: Map<string, MemberData>) {
    const out: Signed<T>[] = []
    this.map<T>(name).forEach((rec, key) => {
      if (rec?.d && key.startsWith(ownKey(rec.a)) && this.checkBy(name, rec, members)) out.push(rec)
    })
    return out.sort((x, y) => ((x.d as { t: number }).t ?? 0) - ((y.d as { t: number }).t ?? 0))
  }

  snapshot(): Snapshot {
    const v = this.version.peek()
    if (this.cache?.v === v) return this.cache.s
    const now = Date.now()
    const self = this.self()

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

    // 1) Freigaben: ausgehend vom Gründer, jedes freigegebene Mitglied kann weitere freigeben
    const approvals = this.signed<ApprovalData>('approvals', members)
    const roles = this.signed<RoleData>('roles', members)
    const approved = new Set<string>(founder ? [founder] : [])
    for (const r of roles) if (r.d.role === 'admin' && r.a === founder) approved.add(r.d.target)
    for (let changed = true; changed; ) {
      changed = false
      for (const ap of approvals)
        if (approved.has(ap.a) && !approved.has(ap.d.target)) {
          approved.add(ap.d.target)
          changed = true
        }
    }

    // 2) Rollen in zeitlicher Reihenfolge. Admins dürfen alles (außer gegen den Gründer);
    //    freigegebene Mitglieder dürfen Wartende ablehnen.
    const admins = new Set<string>(founder ? [founder] : [])
    const bannedAt = new Map<string, number>()
    const roleBans = new Map<string, Signed<RoleData>>()
    for (const r of roles) {
      if (r.d.target === founder) continue
      const isAdmin = admins.has(r.a)
      if (r.d.role === 'ban' && (isAdmin || (approved.has(r.a) && !approved.has(r.d.target) && !bannedAt.has(r.a)))) {
        bannedAt.set(r.d.target, r.d.t)
        admins.delete(r.d.target)
        roleBans.set(r.d.target, r)
      } else if (!isAdmin) continue
      else if (r.d.role === 'admin') {
        admins.add(r.d.target)
        approved.add(r.d.target)
        bannedAt.delete(r.d.target)
      } else if (r.d.role === 'member') {
        admins.delete(r.d.target)
        bannedAt.delete(r.d.target)
      }
    }

    // 3) Moderation durch Admins
    const hidden = new Map<string, string>()
    const muted = new Map<string, [number, number][]>()
    const addMute = (target: string, from: number, until: number) => muted.set(target, [...(muted.get(target) ?? []), [from, until]])
    for (const m of this.signed<ModData>('mod', members)) {
      if (!admins.has(m.a)) continue
      const d = m.d
      if (d.action === 'hide' && d.ref) hidden.set(refKey(d.ref), d.reason || 'Von einem Admin ausgeblendet')
      else if (d.action === 'unhide' && d.ref) hidden.delete(refKey(d.ref))
      else if (d.action === 'mute' && d.target && d.target !== founder) addMute(d.target, d.t, d.until ?? Infinity)
      else if (d.action === 'unmute' && d.target) {
        const list = muted.get(d.target) ?? []
        muted.set(
          d.target,
          list.map(([f, u]) => [f, Math.min(u, d.t)] as [number, number]),
        )
      }
    }

    // 4) Abstimmungen
    const isMember = (a: string) => approved.has(a) && !bannedAt.has(a)
    const ballots = new Map<string, Map<string, Signed<BallotData>>>()
    for (const b of this.signed<BallotData>('ballots', members)) {
      const m = ballots.get(b.d.vote) ?? new Map()
      m.set(b.a, b) // neuerer Stimmzettel ersetzt älteren
      ballots.set(b.d.vote, m)
    }
    const votes: VoteResult[] = []
    for (const vr of this.signed<VoteData>('votes', members)) {
      const d = vr.d
      if (!isMember(vr.a) || (d.kind !== 'hide' && (!d.target || d.target === founder))) continue
      const eligibleSet = [...approved].filter((a) => isMember(a) && a !== d.target)
      const bs = [...(ballots.get(d.id)?.values() ?? [])].filter((b) => eligibleSet.includes(b.a))
      const yesB = bs.filter((b) => b.d.yes).sort((x, y) => x.d.t - y.d.t)
      const yes = yesB.length
      const no = bs.length - yes
      const deadline = d.t + VOTE_WINDOW
      const minVotes = Math.min(3, eligibleSet.length)
      const early = yes >= Math.max(minVotes, Math.ceil((eligibleSet.length * 2) / 3))
      let status: VoteResult['status'] = 'open'
      let decidedAt: number | undefined
      if (early) {
        status = 'passed'
        decidedAt = yesB[Math.max(minVotes, Math.ceil((eligibleSet.length * 2) / 3)) - 1]?.d.t ?? now
      } else if (now >= deadline) {
        status = bs.length >= minVotes && yes >= (bs.length * 2) / 3 ? 'passed' : 'failed'
        decidedAt = deadline
      }
      votes.push({ ...d, a: vr.a, eligible: eligibleSet.length, yes, no, deadline, status, decidedAt, myBallot: self ? ballots.get(d.id)?.get(self)?.d.yes : undefined })
      if (status !== 'passed' || decidedAt === undefined) continue
      if (d.kind === 'remove' && d.target && !bannedAt.has(d.target)) {
        bannedAt.set(d.target, decidedAt)
        admins.delete(d.target)
      } else if (d.kind === 'mute' && d.target) addMute(d.target, decidedAt, decidedAt + (d.duration ?? 7 * 864e5))
      else if (d.kind === 'hide' && d.ref) hidden.set(refKey(d.ref), 'Per Abstimmung ausgeblendet')
    }
    votes.sort((x, y) => y.t - x.t)
    const banned = new Set(bannedAt.keys())
    const pending = new Set([...members.keys()].filter((a) => !approved.has(a) && !banned.has(a)))
    const selfAdmin = !!self && admins.has(self)
    const snapMuted = { muted }

    const collect = <T extends object>(name: MapName, opts: { filter?: (a: string, d: T) => boolean; content?: ContentMap } = {}) => {
      const out: Authored<T>[] = []
      this.map<T>(name).forEach((rec, key) => {
        if (!rec?.d || !key.startsWith(ownKey(rec.a))) return
        const t = (rec.d as { t?: number }).t ?? Infinity
        const ban = bannedAt.get(rec.a)
        if (ban !== undefined && t > ban) return
        // Wartende sehen nur ihre eigenen Beiträge, Stummgeschaltete werden ignoriert
        if (!approved.has(rec.a) && rec.a !== self) return
        if (isMutedAt(snapMuted, rec.a, t) && rec.a !== self) return
        if ((rec.d as { deleted?: boolean }).deleted || (opts.filter && !opts.filter(rec.a, rec.d))) return
        if (opts.content && !selfAdmin && hidden.has(`${opts.content}:${(rec.d as { id?: string }).id}`)) return
        if (this.checkBy(name, rec, members)) out.push({ ...rec.d, a: rec.a })
      })
      return out
    }

    // Umzüge: Admins jederzeit; andere nur mit gültigem Grund und Zugangsdaten für alle Verbleibenden
    const rekeys = collect<RekeyData>('rekeys', {
      filter: (a, d) => {
        if (admins.has(a)) return true
        if (!d.reason) return false
        const target = d.reason.startsWith('vote:')
          ? votes.find((x) => x.id === d.reason!.slice(5) && x.status === 'passed' && x.kind === 'remove')?.target
          : d.reason.startsWith('ban:') && roleBans.has(d.reason.slice(4))
            ? d.reason.slice(4)
            : undefined
        if (!target) return false
        return [...approved].every((m) => m === target || bannedAt.has(m) || !!d.payloads[m] || (members.get(m)?.t ?? 0) > d.t)
      },
    })

    const s: Snapshot = {
      info,
      founder,
      members,
      admins,
      approved,
      pending,
      banned,
      bannedAt,
      muted,
      hidden,
      strains: collect<StrainData>('strains', { content: 'strains' }),
      ratings: collect<RatingData>('ratings', { content: 'ratings' }).sort((x, y) => y.t - x.t),
      comments: collect<CommentData>('comments', { content: 'comments' }).sort((x, y) => x.t - y.t),
      reactions: collect<ReactionData>('reactions', { filter: (_a, d) => d.active }),
      sessions: collect<SessionData>('sessions').sort((x, y) => y.t - x.t),
      rekeys,
      events: collect<EventData>('events', { content: 'events' }).sort((x, y) => x.start - y.start),
      // Zusagen und Mitbringsel Entfernter zählen nicht mehr
      rsvps: collect<RsvpData>('rsvps', { filter: (a) => !bannedAt.has(a) }),
      brings: collect<BringData>('brings', { filter: (a) => !bannedAt.has(a) }).sort((x, y) => x.t - y.t),
      reports: collect<ReportData>('reports').sort((x, y) => y.t - x.t),
      votes,
    }
    this.cache = { v, s }
    return s
  }

  async put<T>(me: Identity, name: MapName, key: string, d: T) {
    // Autor steckt im Datensatz-Rahmen, nicht in den Daten (Snapshot-Objekte bringen ihn mit)
    const { a: _a, ...data } = d as T & { a?: string }
    const clean = JSON.parse(JSON.stringify(data)) as T
    const rec = await signRec(me, name, clean)
    this.map<T>(name).set(key, rec)
  }

  rawRekeys(): [string, Signed<RekeyData>][] {
    return [...this.map<RekeyData>('rekeys').entries()]
  }
}
