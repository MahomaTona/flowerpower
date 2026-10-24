// Geräte-Einstellungen, die schon vor dem Entsperren gelten (unverschlüsselt, ohne Inhalte).
import { signal } from '@preact/signals'
import { local } from './store'

export const THEMES = [
  { id: 'cuvee', name: 'Cuvée – edel & dunkel', colors: ['#0e1311', '#161d1a', '#c9a45c', '#7fa886'] },
  { id: 'leinen', name: 'Leinen – hell & clean', colors: ['#f6f5f1', '#ffffff', '#2e6a4f', '#b07d3a'] },
  { id: 'flower', name: 'Flower Power – bunt', colors: ['#fff3e2', '#ffe2bd', '#e8458b', '#6a4bd8'] },
  { id: 'nacht', name: 'Mitternacht – OLED', colors: ['#000000', '#141418', '#5cf28a', '#b48cff'] },
]

export const theme = signal(local.get('theme') || 'cuvee')
export function setTheme(t: string) {
  theme.value = t
  local.set('theme', t)
  document.documentElement.dataset.theme = t
  const bg = THEMES.find((x) => x.id === t)?.colors[0]
  if (bg) document.querySelector('meta[name=theme-color]')?.setAttribute('content', bg)
}

export const discreet = signal(local.get('discreet') === '1')
export function setDiscreet(on: boolean) {
  discreet.value = on
  local.set('discreet', on ? '1' : null)
  const q = (id: string) => document.getElementById(id) as HTMLLinkElement & HTMLMetaElement
  document.title = on ? 'Notizen' : 'FlowerPower'
  q('manifest').href = on ? 'manifest-discreet.webmanifest' : 'manifest.webmanifest'
  q('favicon').href = on ? 'note.svg' : 'favicon.svg'
  q('apple-icon').href = on ? 'apple-touch-icon-note.png' : 'apple-touch-icon.png'
  q('apple-title').content = on ? 'Notizen' : 'FlowerPower'
}
export const appName = () => (discreet.value ? 'Notizen' : 'FlowerPower')

/** Automatisch sperren, wenn die App so viele Minuten im Hintergrund war (0 = nie). */
export const autoLock = signal(Number(local.get('autoLock') ?? '1'))
export function setAutoLock(min: number) {
  autoLock.value = min
  local.set('autoLock', String(min))
}

export const failedPins = {
  get: () => Number(local.get('pinFails') || '0'),
  set: (n: number) => local.set('pinFails', n ? String(n) : null),
}

/** Einladung merken, falls jemand den Link öffnet, bevor die App eingerichtet ist. */
export const pendingInvite = {
  get: () => sessionStorage.getItem('fp.invite'),
  set: (v: string | null) => (v ? sessionStorage.setItem('fp.invite', v) : sessionStorage.removeItem('fp.invite')),
}
