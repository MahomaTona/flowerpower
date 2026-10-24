// Netzdiagramm für Aroma- und Wirkungsprofile.

export type Series = { label: string; values: Record<string, number>; color: string }

export function Radar({ axes, series, size = 300 }: { axes: { id: string; label: string }[]; series: Series[]; size?: number }) {
  if (axes.length < 3) return null
  const c = size / 2
  const r = c - 30
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2
    return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v] as const
  }
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, Math.max(0.03, Math.min(1, v))).join(',')).join(' ')
  return (
    <figure style={{ margin: 0 }}>
      <svg class="radar" viewBox={`-60 0 ${size + 120} ${size}`} width="100%" style={{ maxWidth: size + 120, display: 'block', margin: '0 auto' }} role="img" aria-label={'Profil: ' + axes.map((a) => a.label).join(', ')}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon points={poly(axes.map(() => f))} fill="none" stroke="var(--line)" stroke-width="1" />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, 1)
          return <line x1={c} y1={c} x2={x} y2={y} stroke="var(--line)" stroke-width="1" />
        })}
        {series.map((s) => (
          <polygon points={poly(axes.map((a) => s.values[a.id] ?? 0))} fill={s.color} fill-opacity="0.18" stroke={s.color} stroke-width="2" stroke-linejoin="round" />
        ))}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 1.17)
          const anchor = Math.abs(x - c) < 8 ? 'middle' : x > c ? 'start' : 'end'
          return (
            <text x={x} y={y} text-anchor={anchor} dominant-baseline="middle">
              {a.label}
            </text>
          )
        })}
      </svg>
      {series.length > 1 && (
        <figcaption class="row wrap center small" style={{ justifyContent: 'center', gap: '0.8rem' }}>
          {series.map((s) => (
            <span class="row" style={{ gap: 4 }}>
              <i style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: 'inline-block' }} />
              {s.label}
            </span>
          ))}
        </figcaption>
      )}
    </figure>
  )
}

export const SERIES_COLORS = ['var(--accent)', 'var(--accent-2)', '#d9785f', '#5fa8d9', '#b48cff', '#e8c547', '#6fd3b5', '#f28ab2']
