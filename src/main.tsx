import { render } from 'preact'
import { useEffect } from 'preact/hooks'
import { registerSW } from 'virtual:pwa-register'
import './styles.css'
import { activeGroup, boot, groups, groupsTick, lockNow, pairRequest, phase, setActiveGroup } from './lib/app'
import { appName, autoLock, pendingInvite } from './lib/prefs'
import { Aurora, BloomLogo, Icon, Logo, Sheet, Toast, go, route } from './ui/kit'
import { LockScreen, Welcome } from './ui/Start'
import { Feed } from './ui/Feed'
import { Compare, StrainDetail, StrainForm, StrainList } from './ui/Strains'
import { RateForm } from './ui/Rate'
import { SessionView, Sessions } from './ui/Sessions'
import { Me } from './ui/Me'
import { Settings } from './ui/Settings'
import { GroupPage, JoinInvite } from './ui/Group'

if (import.meta.env.PROD) registerSW({ immediate: true })

// Automatische Sperre nach Zeit im Hintergrund
let hiddenAt = 0
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now()
  else if (phase.peek() === 'ready' && autoLock.peek() > 0 && hiddenAt && Date.now() - hiddenAt > autoLock.peek() * 60_000) lockNow()
})

// Einladungslink vor der Einrichtung merken
if (route.peek().parts[0] === 'join') pendingInvite.set(route.peek().q.get('i'))

function App() {
  const p = phase.value
  useEffect(() => {
    if (p === 'ready') {
      const inv = pendingInvite.get()
      if (inv && route.peek().parts[0] !== 'join') go(`/join?i=${inv}`)
      else if (route.peek().parts[0] === 'pair') go('/settings')
    }
  }, [p])
  return (
    <>
      <Aurora />
      {p === 'loading' ? (
        <div class="fullscreen center">
          <BloomLogo />
        </div>
      ) : p === 'welcome' ? (
        <Welcome />
      ) : p === 'locked' ? (
        <LockScreen />
      ) : (
        <Shell />
      )}
    </>
  )
}

const NAV = [
  ['feed', 'Feed', 'feed'],
  ['strains', 'Sorten', 'strains'],
  ['rate', 'Bewerten', 'plus'],
  ['sessions', 'Tasting', 'session'],
  ['me', 'Ich', 'me'],
] as const

function Shell() {
  groupsTick.value
  const r = route.value
  const page = r.parts[0] ?? 'feed'
  const rt = activeGroup.value
  const peers = rt ? Object.keys(rt.peering?.peers.value ?? {}).length : 0
  const navOn = (k: string) => page === k || (k === 'strains' && (page === 'strain' || page === 'strain-new' || page === 'compare')) || (k === 'sessions' && page === 'session')
  return (
    <div class="shell">
      <nav class="nav" aria-label="Hauptnavigation">
        <div class="brand">
          <Logo /> <span class="brand-name">{appName()}</span>
        </div>
        {NAV.map(([k, label, icon]) => (
          <a href={`#/${k}`} class={(navOn(k) ? 'on ' : '') + (k === 'rate' ? 'plus' : '')} aria-current={navOn(k) ? 'page' : undefined}>
            <Icon name={icon} />
            <span>{label}</span>
          </a>
        ))}
        <a href="#/settings" class={'desk-only ' + (page === 'settings' ? 'on' : '')}>
          <Icon name="settings" />
          <span>Einstellungen</span>
        </a>
      </nav>
      <div class="main">
        <header class="topbar">
          <div class="brand">
            <Logo /> <span class="brand-name">{appName()}</span>
          </div>
          <div class="grow" />
          {groups.size > 0 ? (
            <button class="btn sm ghost group-btn" onClick={() => go('/group')} title="Gruppe">
              {groups.size > 1 ? (
                <select
                  class="input"
                  style={{ minHeight: 30, padding: '2px 6px', width: 'auto', maxWidth: 140 }}
                  value={rt?.entry.docId}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setActiveGroup((e.target as HTMLSelectElement).value)}
                >
                  {[...groups.values()].map((g) => (
                    <option value={g.entry.docId}>{g.entry.name}</option>
                  ))}
                </select>
              ) : (
                <span class="group-name">👥 {rt?.entry.name}</span>
              )}
              <span class={'online' + (peers ? ' on' : '')} title={`${peers} verbunden`}>
                <i /> {peers}
              </span>
            </button>
          ) : (
            <button class="btn sm" onClick={() => go('/group')}>
              Gruppe
            </button>
          )}
          <button class="iconbtn" aria-label="Sperren" onClick={lockNow}>
            <Icon name="lock" />
          </button>
          <a class="iconbtn" aria-label="Einstellungen" href="#/settings" style={{ color: page === 'settings' ? 'var(--accent)' : undefined }}>
            <Icon name="settings" />
          </a>
        </header>
        <main class="page" key={page + '/' + (r.parts[1] ?? '')}>
          <Page page={page} id={r.parts[1]} />
        </main>
      </div>
      <PairConfirm />
      <Toast />
    </div>
  )
}

function Page({ page, id }: { page: string; id?: string }) {
  switch (page) {
    case 'strains':
      return <StrainList />
    case 'strain':
      return <StrainDetail id={id ?? ''} key={id} />
    case 'strain-new':
      return <StrainForm key={location.hash} />
    case 'compare':
      return <Compare />
    case 'rate':
      return <RateForm key={location.hash} />
    case 'sessions':
      return <Sessions />
    case 'session':
      return <SessionView id={id ?? ''} />
    case 'me':
      return <Me />
    case 'settings':
      return <Settings />
    case 'group':
      return <GroupPage />
    case 'join':
      return <JoinInvite />
    default:
      return <Feed />
  }
}

function PairConfirm() {
  const req = pairRequest.value
  return (
    <Sheet open={!!req} onClose={() => req?.reject()}>
      {req && (
        <div class="stack">
          <h2>Gerät koppeln?</h2>
          <p>
            <b>{req.device}</b> möchte sich als dein Gerät verbinden und erhält dann deine Identität und alle persönlichen Daten.
          </p>
          <div class="row">
            <button class="btn ghost grow" onClick={req.reject}>
              Ablehnen
            </button>
            <button class="btn primary grow" onClick={req.accept}>
              Koppeln
            </button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

render(<App />, document.getElementById('app')!)
void boot()
