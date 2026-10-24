// Eine Bewertung als schönes Bild (1080×1350) – zum Teilen im Gruppenchat.
import { strainArtUrl, strainPalette } from './art'
import type { RatingData, StrainData } from './model'
import { ALL_EFFECTS, AROMAS, FORMS, STRAIN_TYPES, opt, optLabel } from './taxonomy'

const W = 1080
const H = 1350

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
  }
  ctx.closePath()
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const t = line ? line + ' ' + w : w
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line)
      line = w
    } else line = t
  }
  if (line) lines.push(line)
  return lines
}

export async function renderShareCard(opts: {
  strain: StrainData
  rating: RatingData
  author: { name: string; avatar: string }
  brand?: string
}): Promise<Blob> {
  const { strain, rating, author } = opts
  const serif = '"Fraunces Variable", Georgia, serif'
  const sans = '"Inter Variable", system-ui, sans-serif'
  await Promise.all([document.fonts.load(`600 90px ${serif}`), document.fonts.load(`italic 400 40px ${serif}`), document.fonts.load(`500 30px ${sans}`)]).catch(() => {})

  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  const pal = strainPalette(strain)
  ctx.fillStyle = '#080c0a'
  ctx.fillRect(0, 0, W, H)

  const art = await loadImage(strainArtUrl(strain))
  ctx.drawImage(art, 0, -60, W, W)
  const g = ctx.createLinearGradient(0, 420, 0, H)
  g.addColorStop(0, 'rgba(8,12,10,0)')
  g.addColorStop(0.42, 'rgba(8,12,10,0.88)')
  g.addColorStop(1, 'rgba(8,12,10,1)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const X = 84
  let y = 690
  ctx.fillStyle = 'rgba(251,244,226,0.7)'
  ctx.font = `600 26px ${sans}`
  ctx.letterSpacing = '6px'
  ctx.fillText(optLabel(STRAIN_TYPES, strain.type).toUpperCase(), X, y)
  ctx.letterSpacing = '0px'

  ctx.fillStyle = '#fbf4e2'
  ctx.font = `560 104px ${serif}`
  const nameLines = wrap(ctx, strain.name, W - X * 2).slice(0, 2)
  for (const l of nameLines) {
    y += 106
    ctx.fillText(l, X, y)
  }

  // Sterne
  y += 70
  for (let i = 0; i < 5; i++) {
    star(ctx, X + 26 + i * 64, y - 18, 26)
    ctx.fillStyle = i < rating.overall ? '#f0cf86' : 'rgba(251,244,226,0.16)'
    ctx.fill()
  }
  ctx.font = `600 34px ${sans}`
  ctx.fillStyle = 'rgba(251,244,226,0.7)'
  const form = opt(FORMS, rating.form)
  if (form) ctx.fillText(`${form.icon ?? ''} ${form.label}${rating.vapeTemp ? ` · ${rating.vapeTemp} °C` : ''}`, X + 350, y - 6)

  // Chips: Aromen + stärkste Wirkungen
  y += 48
  const chips = [
    ...[...new Set([...rating.aromas, ...rating.tastes])].slice(0, 5).map((a) => {
      const o = opt(AROMAS, a)
      return `${o?.icon ?? ''} ${o?.label ?? a}`
    }),
    ...Object.entries(rating.effects)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([e]) => {
        const o = opt(ALL_EFFECTS, e)
        return `${o?.icon ?? ''} ${o?.label ?? e}`
      }),
  ]
  ctx.font = `500 30px ${sans}`
  let cx = X
  let rows = 0
  for (const [i, t] of chips.entries()) {
    const w = ctx.measureText(t).width + 44
    if (cx + w > W - X) {
      cx = X
      y += 66
      if (++rows >= 2) break
    }
    roundRect(ctx, cx, y, w, 54, 27)
    ctx.fillStyle = i < 5 ? 'rgba(255,255,255,0.08)' : pal[i % 3][0] + '55'
    ctx.fill()
    ctx.strokeStyle = 'rgba(251,244,226,0.16)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = '#fbf4e2'
    ctx.fillText(t, cx + 22, y + 37)
    cx += w + 12
  }

  // Notiz
  if (rating.note) {
    y += 112
    ctx.font = `italic 400 40px ${serif}`
    ctx.fillStyle = '#f1e6c8'
    const lines = wrap(ctx, `„${rating.note}“`, W - X * 2 - 30).slice(0, 2)
    ctx.fillStyle = pal[0][1]
    ctx.fillRect(X, y - 36, 4, lines.length * 52)
    ctx.fillStyle = '#f1e6c8'
    lines.forEach((l, i) => ctx.fillText(l, X + 28, y + i * 52))
  }

  // Fußzeile
  ctx.fillStyle = 'rgba(251,244,226,0.14)'
  ctx.fillRect(X, H - 120, W - X * 2, 2)
  ctx.font = `500 30px ${sans}`
  ctx.fillStyle = 'rgba(251,244,226,0.8)'
  const d = new Date(rating.date + 'T12:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
  ctx.fillText(`${author.avatar} ${author.name} · ${d}`, X, H - 64)
  if (opts.brand) {
    ctx.font = `600 34px ${serif}`
    ctx.fillStyle = '#d6b06a'
    const bw = ctx.measureText(opts.brand).width
    ctx.fillText(opts.brand, W - X - bw, H - 62)
  }

  return new Promise((res) => c.toBlob((b) => res(b!), 'image/png'))
}

export async function shareOrDownload(blob: Blob, name: string) {
  const file = new File([blob], name, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch {
      /* abgebrochen → Download */
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
