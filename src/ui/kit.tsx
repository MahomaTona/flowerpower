// Wiederverwendbare Bausteine: Chips, Sterne, Slider, Sheets, Icons, QR …
import { signal } from '@preact/signals'
import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import QRCode from 'qrcode'
import type { Opt } from '../lib/taxonomy'

// ---------- Router ----------

function parse() {
  const h = location.hash.slice(1) || '/feed'
  const [path, q = ''] = h.split('?')
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(q) }
}
export const route = signal(parse())
addEventListener('hashchange', () => {
  route.value = parse()
  scrollTo(0, 0)
})
export const go = (to: string) => (location.hash = to)
export const back = () => (history.length > 1 ? history.back() : go('/feed'))

// ---------- Toast ----------

export const toastMsg = signal<string | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined
export function toast(m: string) {
  toastMsg.value = m
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastMsg.value = null), 2600)
}
export const Toast = () => (toastMsg.value ? <div class="toast" role="status">{toastMsg.value}</div> : null)

// ---------- Icons ----------

const paths: Record<string, string> = {
  feed: 'M4 6h16M4 12h16M4 18h10',
  strains: 'M12 21c0-6 0-9 0-13M12 8c-3-3-7-3-8-2 1 4 4 6 8 6M12 8c3-3 7-3 8-2-1 4-4 6-8 6M12 13c-3-1-6 0-7 2 2 2 5 2 7 0M12 13c3-1 6 0 7 2-2 2-5 2-7 0',
  plus: 'M12 5v14M5 12h14',
  session: 'M8 3h8M9 3v5l-4 9a3 3 0 0 0 3 4h8a3 3 0 0 0 3-4l-4-9V3M7 14h10',
  me: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  back: 'M15 18l-6-6 6-6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M22 21a7 7 0 0 0-4-6.3',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  share: 'M4 12v7h16v-7M12 3v12M7 8l5-5 5 5',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  close: 'M6 6l12 12M18 6L6 18',
}
export const Icon = ({ name, class: cls }: { name: string; class?: string }) => (
  <svg class={'ico ' + (cls ?? '')} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d={paths[name]} />
  </svg>
)

export const Logo = ({ class: cls = 'logo' }: { class?: string }) => (
  <svg class={cls} viewBox="0 0 64 64" aria-hidden="true">
    <g fill="var(--accent)" transform="translate(32 32)">
      {[0, 60, 120, 180, 240, 300].map((r) => (
        <ellipse rx="7" ry="14" cy="-11" transform={`rotate(${r})`} />
      ))}
    </g>
    <circle cx="32" cy="32" r="7" fill="var(--accent-2)" />
  </svg>
)

// ---------- Eingaben ----------

export function Chip({ on, onClick, children, title }: { on?: boolean; onClick?: () => void; children: ComponentChildren; title?: string }) {
  return (
    <button type="button" class={'chip' + (on ? ' on' : '')} aria-pressed={!!on} onClick={onClick} title={title}>
      {children}
    </button>
  )
}

export function ChipSelect({ opts, value, onChange, max }: { opts: Opt[]; value: string[]; onChange: (v: string[]) => void; max?: number }) {
  return (
    <div class="chips">
      {opts.map((o) => {
        const on = value.includes(o.id)
        return (
          <Chip
            key={o.id}
            on={on}
            title={o.hint}
            onClick={() => {
              if (on) onChange(value.filter((x) => x !== o.id))
              else if (!max || value.length < max) onChange([...value, o.id])
              else if (max === 1) onChange([o.id])
            }}
          >
            {o.icon && <span>{o.icon}</span>}
            {o.label}
          </Chip>
        )
      })}
    </div>
  )
}

export function SingleSelect({ opts, value, onChange, allowNone = true }: { opts: Opt[]; value?: string; onChange: (v: string | undefined) => void; allowNone?: boolean }) {
  return (
    <div class="chips">
      {opts.map((o) => (
        <Chip key={o.id} on={value === o.id} title={o.hint} onClick={() => onChange(value === o.id && allowNone ? undefined : o.id)}>
          {o.icon && <span>{o.icon}</span>}
          {o.label}
        </Chip>
      ))}
    </div>
  )
}

/** Chips mit Stärke: jedes Tippen erhöht 0 → 1 → 2 → 3 → 0. */
export function LevelChips({ opts, value, onChange }: { opts: Opt[]; value: Record<string, number>; onChange: (v: Record<string, number>) => void }) {
  return (
    <div class="chips">
      {opts.map((o) => {
        const lvl = value[o.id] ?? 0
        return (
          <Chip
            key={o.id}
            on={lvl > 0}
            onClick={() => {
              const n = { ...value }
              if (lvl >= 3) delete n[o.id]
              else n[o.id] = lvl + 1
              onChange(n)
            }}
          >
            {o.icon && <span>{o.icon}</span>}
            {o.label}
            {lvl > 0 && (
              <span class="lvl" aria-label={`Stärke ${lvl} von 3`}>
                {[1, 2, 3].map((i) => (
                  <i class={i <= lvl ? 'f' : ''} />
                ))}
              </span>
            )}
          </Chip>
        )
      })}
    </div>
  )
}

export function Stars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div class="stars" role="radiogroup" aria-label="Gesamtbewertung">
      {[1, 2, 3, 4, 5].map((i) => (
        <button type="button" class={i <= value ? 'on' : ''} aria-label={`${i} Sterne`} onClick={() => onChange(i === value ? 0 : i)}>
          ★
        </button>
      ))}
    </div>
  )
}

export const MiniStars = ({ value }: { value: number }) => {
  const full = Math.round(value)
  return (
    <span class="stars mini" aria-label={`${value.toFixed(1)} von 5 Sternen`}>
      {'★'.repeat(full)}
      <span style={{ opacity: 0.25 }}>{'★'.repeat(5 - full)}</span>
    </span>
  )
}

export function Slider(p: { label: string; low: string; high: string; value?: number; onChange: (v: number | undefined) => void; min?: number; max?: number; step?: number; fmt?: (v: number) => string }) {
  const { min = 1, max = 5, step = 1 } = p
  const set = p.value !== undefined
  return (
    <div class="slider">
      <div class="top">
        <span>{p.label}</span>
        <span class="muted">
          {set ? (p.fmt ? p.fmt(p.value!) : `${p.value}/${max}`) : '–'}
          {set && (
            <button type="button" class="iconbtn" style={{ width: 24, height: 24 }} aria-label="Zurücksetzen" onClick={() => p.onChange(undefined)}>
              ×
            </button>
          )}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={p.value ?? (min + max) / 2}
        style={{ opacity: set ? 1 : 0.4 }}
        onInput={(e) => p.onChange(Number((e.target as HTMLInputElement).value))}
      />
      <div class="ends">
        <span>{p.low}</span>
        <span>{p.high}</span>
      </div>
    </div>
  )
}

export function Seg<T extends string>({ value, opts, onChange }: { value: T; opts: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div class="seg">
      {opts.map(([v, l]) => (
        <button type="button" class={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  )
}

// ---------- Anzeige ----------

export const Avatar = ({ emoji, online, lg }: { emoji?: string; online?: boolean; lg?: boolean }) => (
  <span class={'avatar' + (lg ? ' lg' : '')}>
    {emoji || '🌸'}
    {online && <span class="dot" aria-label="online" />}
  </span>
)

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ComponentChildren }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  }, [open])
  if (!open) return null
  return (
    <div class="sheet-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  )
}

export function QR({ text }: { text: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    void QRCode.toDataURL(text, { margin: 0, width: 520, errorCorrectionLevel: 'M' }).then(setSrc)
  }, [text])
  return src ? <img class="qr" src={src} alt="QR-Code" /> : <div class="qr" style={{ aspectRatio: '1' }} />
}

export function Copy({ text, label = 'Kopieren' }: { text: string; label?: string }) {
  return (
    <button
      type="button"
      class="btn sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          toast('Kopiert')
        } catch {
          toast('Kopieren nicht möglich')
        }
      }}
    >
      {label}
    </button>
  )
}

export function ShareBtn({ text, title }: { text: string; title: string }) {
  if (!('share' in navigator)) return null
  return (
    <button type="button" class="btn sm" onClick={() => navigator.share({ title, text: title, url: text }).catch(() => {})}>
      <Icon name="share" /> Teilen
    </button>
  )
}

export function timeAgo(t: number) {
  const s = (Date.now() - t) / 1000
  if (s < 60) return 'gerade eben'
  if (s < 3600) return `vor ${Math.floor(s / 60)} Min.`
  if (s < 86400) return `vor ${Math.floor(s / 3600)} Std.`
  if (s < 86400 * 7) return `vor ${Math.floor(s / 86400)} Tg.`
  return new Date(t).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export const fmtDate = (d: string) => new Date(d + 'T12:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })

export function Empty({ icon, children }: { icon: string; children: ComponentChildren }) {
  return (
    <div class="empty">
      <div class="big">{icon}</div>
      {children}
    </div>
  )
}

export function PageHead({ title, backTo, right }: { title: string; backTo?: boolean; right?: ComponentChildren }) {
  return (
    <div class="row between mb">
      <div class="row grow">
        {backTo && (
          <button class="iconbtn" aria-label="Zurück" onClick={back}>
            <Icon name="back" />
          </button>
        )}
        <h1 style={{ margin: 0 }} class="grow">
          {title}
        </h1>
      </div>
      {right}
    </div>
  )
}

/** Datei-Auswahl für Fotos (auf dem Handy direkt die Kamera). */
export function PhotoInput({ onFile, children }: { onFile: (f: File) => void; children: ComponentChildren }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        class="hidden"
        onChange={(e) => {
          const f = (e.target as HTMLInputElement).files?.[0]
          if (f) onFile(f)
          ;(e.target as HTMLInputElement).value = ''
        }}
      />
      <button type="button" class="btn" onClick={() => ref.current?.click()}>
        {children}
      </button>
    </>
  )
}

export const strainIcon = (type: string) =>
  ({ indica: '🌙', 'indica-hybrid': '🌗', hybrid: '☯️', 'sativa-hybrid': '🌓', sativa: '☀️', cbd: '💧' })[type] ?? '🌿'

export const pct = (r?: [number, number]) => {
  if (!r) return '–'
  const [a, b] = r
  if (b < 1) return '< 1 %'
  return a === b ? `${a} %` : `${Math.round(a)}–${Math.round(b)} %`
}
