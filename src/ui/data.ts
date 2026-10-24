// Gemeinsamer Zugriff der Seiten auf Gruppe, Snapshot und eigene Daten.
import { activeGroup, allStrains, groupsTick, me, pPrivate, personalVersion, profile, type GroupRuntime } from '../lib/app'
import type { Authored, MemberData, RatingData, SessionData, Snapshot } from '../lib/model'

const EMPTY: Snapshot = {
  members: new Map(),
  admins: new Set(),
  banned: new Set(),
  bannedAt: new Map(),
  strains: [],
  ratings: [],
  comments: [],
  reactions: [],
  sessions: [],
  rekeys: [],
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
