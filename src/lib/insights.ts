// Auswertungen: Durchschnittswerte pro Sorte, Geschmacksprofil, Empfehlungen.
import type { RatingData, StrainData } from './model'
import { AROMAS, EFFECTS, TERPENES, optLabel } from './taxonomy'

export type R = RatingData & { a?: string }

export type StrainStats = {
  n: number
  avg: number
  aromas: Record<string, number>
  effects: Record<string, number>
  raters: Set<string>
}

/** Anteil (0–1) der Bewertungen, die ein Aroma nennen bzw. mittlere Wirkungsstärke (0–3). */
export function statsFor(ratings: R[]): StrainStats {
  const s: StrainStats = { n: ratings.length, avg: 0, aromas: {}, effects: {}, raters: new Set() }
  if (!ratings.length) return s
  for (const r of ratings) {
    s.avg += r.overall
    if (r.a) s.raters.add(r.a)
    for (const a of new Set([...r.aromas, ...r.tastes])) s.aromas[a] = (s.aromas[a] ?? 0) + 1
    for (const [e, v] of Object.entries(r.effects)) s.effects[e] = (s.effects[e] ?? 0) + v
  }
  s.avg /= ratings.length
  for (const k in s.aromas) s.aromas[k] /= ratings.length
  for (const k in s.effects) s.effects[k] /= ratings.length
  return s
}

export function byStrain(ratings: R[]) {
  const m = new Map<string, R[]>()
  for (const r of ratings) {
    const l = m.get(r.strainId)
    if (l) l.push(r)
    else m.set(r.strainId, [r])
  }
  return m
}

type Vec = Record<string, number>
const add = (v: Vec, k: string, x: number) => (v[k] = (v[k] ?? 0) + x)

/** Merkmale einer Sorte: Terpene und Aromen (aus Stammdaten + Gruppenbewertungen). */
function features(s: StrainData, stats?: StrainStats): Vec {
  const v: Vec = {}
  s.terpenes.forEach((t, i) => add(v, 't:' + t, 1 - i * 0.2))
  for (const a of s.aromas) add(v, 'a:' + a, 0.6)
  if (stats) {
    for (const [a, x] of Object.entries(stats.aromas)) add(v, 'a:' + a, x)
    for (const [e, x] of Object.entries(stats.effects)) add(v, 'e:' + e, x / 3)
  }
  add(v, 'y:' + s.type, 0.5)
  return v
}

const dot = (a: Vec, b: Vec) => Object.keys(a).reduce((s, k) => s + a[k] * (b[k] ?? 0), 0)
const norm = (a: Vec) => Math.sqrt(dot(a, a)) || 1

export type TasteProfile = { vec: Vec; topTerpenes: string[]; topAromas: string[]; topEffects: string[]; n: number }

export function tasteProfile(mine: R[], strains: Map<string, StrainData>): TasteProfile {
  const vec: Vec = {}
  for (const r of mine) {
    const s = strains.get(r.strainId)
    const w = r.overall - 2.5 // 1★ → negativ, 5★ → stark positiv
    if (s) for (const [k, x] of Object.entries(features(s))) add(vec, k, x * w)
    for (const a of new Set([...r.aromas, ...r.tastes])) add(vec, 'a:' + a, w)
    for (const [e, x] of Object.entries(r.effects)) add(vec, 'e:' + e, (x / 3) * w)
  }
  const top = (p: string, n = 3) =>
    Object.entries(vec)
      .filter(([k, x]) => k.startsWith(p) && x > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k]) => k.slice(2))
  return { vec, topTerpenes: top('t:'), topAromas: top('a:'), topEffects: top('e:'), n: mine.length }
}

export type Recommendation = { strain: StrainData; score: number; reason: string }

export function recommend(profile: TasteProfile, strains: StrainData[], group: Map<string, R[]>, tried: Set<string>, limit = 6): Recommendation[] {
  const out: Recommendation[] = []
  const pn = norm(profile.vec)
  for (const s of strains) {
    if (tried.has(s.id)) continue
    const rs = group.get(s.id) ?? []
    const st = rs.length ? statsFor(rs) : undefined
    const f = features(s, st)
    const sim = profile.n ? dot(profile.vec, f) / (pn * norm(f)) : 0
    const social = st ? (st.avg - 3) * 0.15 * Math.min(1, st.n / 3) : 0
    const score = sim + social
    const shared = profile.topTerpenes.filter((t) => s.terpenes.includes(t))
    const sharedA = profile.topAromas.filter((a) => s.aromas.includes(a) || (st?.aromas[a] ?? 0) > 0.3)
    let reason = ''
    if (shared.length) reason = 'Terpene, die du magst: ' + shared.map((t) => optLabel(TERPENES, t)).join(', ')
    else if (sharedA.length) reason = 'Aromen, die du magst: ' + sharedA.map((a) => optLabel(AROMAS, a)).join(', ')
    else if (st && st.avg >= 4) reason = `In der Gruppe beliebt (Ø ${st.avg.toFixed(1)} ★)`
    else reason = 'Mal was Neues'
    out.push({ strain: s, score, reason })
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}

export const effectLabel = (id: string) => optLabel(EFFECTS, id)
