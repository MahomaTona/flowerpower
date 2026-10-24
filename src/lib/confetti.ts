// Kleines Konfetti ohne Bibliothek – für Momente, die man feiern sollte.

const COLORS = ['--accent', '--accent-2', '--good', '--danger']

export function confetti(opts: { count?: number; origin?: { x: number; y: number } } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const css = getComputedStyle(document.documentElement)
  const palette = [...COLORS.map((c) => css.getPropertyValue(c).trim()).filter(Boolean), '#ffffff', '#ffd36e']
  const c = document.createElement('canvas')
  c.className = 'confetti'
  const dpr = Math.min(2, devicePixelRatio || 1)
  c.width = innerWidth * dpr
  c.height = innerHeight * dpr
  document.body.appendChild(c)
  const ctx = c.getContext('2d')!
  ctx.scale(dpr, dpr)
  const ox = (opts.origin?.x ?? 0.5) * innerWidth
  const oy = (opts.origin?.y ?? 0.35) * innerHeight
  const parts = Array.from({ length: opts.count ?? 140 }, () => {
    const a = Math.random() * Math.PI * 2
    const v = 4 + Math.random() * 9
    return {
      x: ox,
      y: oy,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 6,
      w: 5 + Math.random() * 7,
      h: 3 + Math.random() * 5,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      color: palette[Math.floor(Math.random() * palette.length)],
      shape: Math.random() < 0.3 ? 'petal' : 'rect',
    }
  })
  const start = performance.now()
  const frame = (t: number) => {
    const age = t - start
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    for (const p of parts) {
      p.vy += 0.22
      p.vx *= 0.985
      p.vy *= 0.985
      p.x += p.vx
      p.y += p.vy
      p.r += p.vr
      ctx.save()
      ctx.globalAlpha = Math.max(0, 1 - age / 2600)
      ctx.translate(p.x, p.y)
      ctx.rotate(p.r)
      ctx.fillStyle = p.color
      if (p.shape === 'petal') {
        ctx.beginPath()
        ctx.ellipse(0, 0, p.w * 0.5, p.w, 0, 0, Math.PI * 2)
        ctx.fill()
      } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1)
      ctx.restore()
    }
    if (age < 2800) requestAnimationFrame(frame)
    else c.remove()
  }
  requestAnimationFrame(frame)
}

/** Meilensteine für probierte Sorten. */
export const MILESTONES = [1, 5, 10, 25, 50, 100]
