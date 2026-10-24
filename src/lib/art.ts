// Generative „Terpen-Blüten“: jede Sorte bekommt ein eigenes, reproduzierbares Bild.
// Farben kommen aus den Terpenen, die Form aus dem Typ (Indica breit & rund, Sativa schmal & strahlig),
// Details (Drehung, Funkeln, Trichome) aus einem Hash des Namens.
import type { StrainData } from './model'

/** Zwei Töne je Terpen: Grundfarbe und helle Spitze. */
export const TERP_COLORS: Record<string, [string, string]> = {
  myrcen: ['#8c3f6e', '#f0a05a'],
  limonen: ['#e9b52f', '#fff09a'],
  caryophyllen: ['#a3402b', '#f08b5a'],
  pinen: ['#2f7d55', '#a8e08a'],
  linalool: ['#7a64c4', '#e2d4ff'],
  humulen: ['#7f8a33', '#e3d27a'],
  terpinolen: ['#2aa69a', '#b6f5df'],
  ocimen: ['#e2703f', '#ffd6a0'],
  bisabolol: ['#d9a98c', '#fff1d6'],
  nerolidol: ['#6d4c37', '#c9a37f'],
}
const CBD: [string, string] = ['#3d8fbf', '#bfe8ff']
const FALLBACK = ['myrcen', 'caryophyllen', 'limonen', 'pinen', 'linalool', 'terpinolen', 'ocimen', 'humulen']

const SHAPE: Record<string, { n: number; len: number; wid: number }> = {
  indica: { n: 5, len: 0.78, wid: 0.62 },
  'indica-hybrid': { n: 6, len: 0.84, wid: 0.5 },
  hybrid: { n: 7, len: 0.9, wid: 0.42 },
  'sativa-hybrid': { n: 9, len: 0.96, wid: 0.32 },
  sativa: { n: 11, len: 1, wid: 0.24 },
  cbd: { n: 8, len: 0.86, wid: 0.4 },
}

export function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [p(a), p(b)]
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

/** Die drei Leitfarben einer Sorte (auch für Punkte, Akzente, Teilen-Karte). */
export function strainPalette(s: Pick<StrainData, 'id' | 'terpenes' | 'type'>): [string, string][] {
  const terps = s.terpenes.filter((t) => TERP_COLORS[t])
  const r = rng(hash(s.id))
  while (terps.length < 3) {
    const t = FALLBACK[Math.floor(r() * FALLBACK.length)]
    if (!terps.includes(t)) terps.push(t)
  }
  const pal = terps.slice(0, 3).map((t) => TERP_COLORS[t])
  if (s.type === 'cbd') pal[0] = CBD
  return pal
}

/** Blütenblatt als Pfad, Spitze zeigt nach oben, Basis im Ursprung. */
function petal(len: number, wid: number) {
  const w = wid * len
  return `M0 0 C ${-w} ${-len * 0.25} ${-w * 0.7} ${-len * 0.8} 0 ${-len} C ${w * 0.7} ${-len * 0.8} ${w} ${-len * 0.25} 0 0 Z`
}

export function strainArtSvg(s: Pick<StrainData, 'id' | 'name' | 'terpenes' | 'type' | 'aromas'>, animated = false): string {
  const seed = hash(s.id + s.name)
  const r = rng(seed)
  const pal = strainPalette(s)
  const shape = SHAPE[s.type] ?? SHAPE.hybrid
  const id = 'a' + seed.toString(36)
  const rot0 = r() * 360
  const bgA = mix('#07100c', pal[0][0], 0.32)
  const bgB = mix('#030605', pal[1][0], 0.18)
  const glow = pal[0][1]

  const rings = [
    { R: 78, n: shape.n, c: pal[0], o: 0.92, spin: 90 },
    { R: 58, n: shape.n, c: pal[1], o: 0.9, spin: -70 },
    { R: 38, n: Math.max(5, shape.n - 1), c: pal[2], o: 0.95, spin: 55 },
  ]
  let defs = `<radialGradient id="${id}bg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="${bgA}"/><stop offset="1" stop-color="${bgB}"/></radialGradient>
<radialGradient id="${id}gl" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${glow}" stop-opacity=".55"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
<filter id="${id}n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="${seed % 97}"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 0"/></filter>`
  let body = ''
  rings.forEach((ring, i) => {
    defs += `<linearGradient id="${id}p${i}" x1="0" y1="0" x2="0" y2="-1" gradientUnits="objectBoundingBox"><stop offset="0" stop-color="${ring.c[0]}"/><stop offset="1" stop-color="${ring.c[1]}"/></linearGradient>`
    const off = rot0 + i * (180 / ring.n) + r() * 12
    const len = ring.R * shape.len * (0.92 + r() * 0.12)
    let petals = ''
    for (let k = 0; k < ring.n; k++) {
      const jitter = 1 + (r() - 0.5) * 0.08
      petals += `<path d="${petal(len * jitter, shape.wid)}" transform="rotate(${(off + (360 / ring.n) * k).toFixed(1)})" fill="url(#${id}p${i})" fill-opacity="${ring.o}"/>`
    }
    const anim = animated ? ` class="${id}r${i}"` : ''
    body += `<g${anim}>${petals}</g>`
  })
  // Trichome im Zentrum
  let tri = ''
  for (let k = 0; k < 26; k++) {
    const a = r() * Math.PI * 2
    const d = Math.sqrt(r()) * 15
    tri += `<circle cx="${(Math.cos(a) * d).toFixed(1)}" cy="${(Math.sin(a) * d).toFixed(1)}" r="${(0.8 + r() * 1.6).toFixed(1)}" fill="${k % 3 ? '#fff7e0' : pal[0][1]}" fill-opacity="${(0.55 + r() * 0.45).toFixed(2)}"/>`
  }
  // Funken je Aroma
  let sparks = ''
  const nSparks = 4 + Math.min(8, s.aromas.length * 2)
  for (let k = 0; k < nSparks; k++) {
    const a = r() * Math.PI * 2
    const d = 82 + r() * 14
    sparks += `<circle class="${animated ? id + 's' : ''}" cx="${(100 + Math.cos(a) * d).toFixed(1)}" cy="${(100 + Math.sin(a) * d).toFixed(1)}" r="${(0.6 + r() * 1.4).toFixed(1)}" fill="${pal[k % 3][1]}" style="animation-delay:${(r() * 3).toFixed(2)}s"/>`
  }
  const style = animated
    ? `<style>
.${id}r0{animation:${id}spin 60s linear infinite;transform-origin:0 0}
.${id}r1{animation:${id}spin2 45s linear infinite;transform-origin:0 0}
.${id}r2{animation:${id}spin 32s linear infinite;transform-origin:0 0}
.${id}b{animation:${id}breathe 6s ease-in-out infinite;transform-origin:100px 100px}
.${id}s{animation:${id}tw 3.2s ease-in-out infinite}
@keyframes ${id}spin{to{transform:rotate(360deg)}}
@keyframes ${id}spin2{to{transform:rotate(-360deg)}}
@keyframes ${id}breathe{50%{transform:scale(1.04)}}
@keyframes ${id}tw{50%{opacity:.15}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>`
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">${style}<defs>${defs}</defs>
<rect width="200" height="200" fill="url(#${id}bg)"/>
<circle cx="100" cy="100" r="92" fill="url(#${id}gl)"/>
${sparks}
<g class="${animated ? id + 'b' : ''}"><g transform="translate(100 100)">${body}<circle r="17" fill="${mix(pal[2][0], '#1a120a', 0.45)}"/>${tri}</g></g>
<rect width="200" height="200" filter="url(#${id}n)" opacity=".07"/>
</svg>`
}

const cache = new Map<string, string>()
export function strainArtUrl(s: Pick<StrainData, 'id' | 'name' | 'terpenes' | 'type' | 'aromas'>, animated = false): string {
  const k = `${s.id}|${s.name}|${s.type}|${s.terpenes.join()}|${s.aromas.length}|${animated}`
  let u = cache.get(k)
  if (!u) {
    u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(strainArtSvg(s, animated))
    cache.set(k, u)
  }
  return u
}
