// Gemeinsamer Zugriff der Seiten auf Gruppe, Snapshot und eigene Daten.
import { activeGroup, allStrains, groupsTick, me, pPrivate, personalVersion, profile, type GroupRuntime } from '../lib/app'
import { isMutedAt, type Authored, type MemberData, type RatingData, type SessionData, type Snapshot } from '../lib/model'

const EMPTY: Snapshot = {
  members: new Map(),
  admins: new Set(),
  approved: new Set(),
  pending: new Set(),
  banned: new Set(),
  bannedAt: new Map(),
  muted: new Map(),
  hidden: new Map(),
  strains: [],
  ratings: [],
  comments: [],
  reactions: [],
  sessions: [],
  rekeys: [],
  events: [],
  rsvps: [],
  brings: [],
  reports: [],
  votes: [],
}

export type ViewRating = Authored<RatingData> & { private?: boolean }

export function useData() {
  groupsTick.value
  personalVersion.value
  const rt: GroupRuntime | null = activeGroup.value
  if (rt) rt.model.version.value
  const snap = rt ? rt.model.snapshot() : EMPTY
  const m = me.value!
  const strains = allStrains(rt)
  const strainMap = new Map(strains.map((s) => [s.id, s]))
  const priv: ViewRating[] = [...pPrivate.values()].filter((r) => !r.deleted).map((r) => ({ ...r, a: m.id, private: true }))
  const sessions = new Map(snap.sessions.map((s) => [s.id, s]))
  // Bewertungen einer offenen Tasting-Runde bleiben verdeckt, bis der Host aufdeckt.
  const visible = (r: Authored<RatingData>) => {
    if (!r.sessionId || r.a === m.id) return true
    const s = sessions.get(r.sessionId)
    return !s || s.status !== 'open'
  }
  const group: ViewRating[] = snap.ratings.filter(visible)
  const mine = [...priv, ...snap.ratings.filter((r) => r.a === m.id)].sort((a, b) => b.t - a.t)
  return { rt, snap, me: m, profile: profile.value, strains, strainMap, priv, group, mine, sessions }
}

export function memberOf(snap: Snapshot, id: string, fallback?: { name: string; avatar: string }): Pick<MemberData, 'name' | 'avatar'> {
  return snap.members.get(id) ?? fallback ?? { name: 'Unbekannt', avatar: '❔' }
}

export function onlineMembers(rt: GroupRuntime | null): Set<string> {
  const s = new Set<string>()
  if (!rt?.peering) return s
  for (const h of Object.values(rt.peering.peers.value)) if (h.member) s.add(h.member)
  return s
}

export const openSessions = (sessions: Map<string, Authored<SessionData>>) => [...sessions.values()].filter((s) => s.status === 'open')

/** Darf ich gerade in der Gruppe schreiben? */
export function myStatus(snap: Snapshot, me: string) {
  const muted = isMutedAt(snap, me, Date.now())
  const until = muted ? Math.max(...(snap.muted.get(me) ?? []).filter(([f, u]) => Date.now() >= f && Date.now() <= u).map(([, u]) => u)) : 0
  return {
    admin: snap.admins.has(me),
    pending: snap.pending.has(me),
    banned: snap.banned.has(me),
    muted,
    mutedUntil: until,
  }
}

/** Kommende Treffen (ab 6 Std. vor jetzt), abgesagte zuletzt. */
export const upcomingEvents = (snap: Snapshot) => snap.events.filter((e) => e.start > Date.now() - 6 * 3600e3)
