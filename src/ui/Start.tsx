// Erster Start, Kopplung, Wiederherstellung und Sperrbildschirm.
import { useEffect, useState } from 'preact/hooks'
import { createAccount, readBackup, receivePairing, resetEverything, unlockWithPin, type Restore } from '../lib/app'
import { AVATARS } from '../lib/taxonomy'
import { THEMES, appName, discreet, failedPins, setTheme, theme } from '../lib/prefs'
import { BloomLogo, route } from './kit'
import { ThemePicker } from './Settings'

const PIN_LEN = 6

export function PinPad({ onDone, title, error }: { onDone: (pin: string) => void | Promise<void>; title: string; error?: string | null }) {
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(false)
  useEffect(() => {
    if (error) {
      setShake(true)
      setPin('')
      const t = setTimeout(() => setShake(false), 400)
      return () => clearTimeout(t)
    }
  }, [error])
  const press = async (d: string) => {
    if (busy) return
    const n = (pin + d).slice(0, PIN_LEN)
    setPin(n)
    if (n.length === PIN_LEN) {
      setBusy(true)
      try {
        await onDone(n)
      } finally {
        setBusy(false)
        setPin('')
      }
    }
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) void press(e.key)
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1))
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  })
  return (
    <div>
      <h2 class="center">{title}</h2>
      <div class={'pin-dots' + (shake ? ' shake' : '')} aria-label={`${pin.length} von ${PIN_LEN} Ziffern`}>
        {Array.from({ length: PIN_LEN }, (_, i) => (
          <i class={i < pin.length ? 'f' : ''} />
        ))}
      </div>
      <p class="center small" style={{ minHeight: '1.4em', color: 'var(--danger)' }}>
        {busy ? <span class="muted">Prüfe …</span> : error}
      </p>
      <div class="pinpad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button type="button" onClick={() => press(d)}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" onClick={() => press('0')}>
          0
        </button>
        <button type="button" class="txt" onClick={() => setPin((p) => p.slice(0, -1))}>
          Löschen
        </button>
      </div>
    </div>
  )
}

export function LockScreen() {
  const [err, setErr] = useState<string | null>(null)
  const [wait, setWait] = useState(0)
  const [forgot, setForgot] = useState(false)
  useEffect(() => {
    if (wait <= 0) return
    const t = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(t)
  }, [wait])
  if (forgot)
    return (
      <div class="fullscreen">
        <h2>PIN vergessen?</h2>
        <p>Ohne PIN lassen sich die verschlüsselten Daten auf diesem Gerät nicht öffnen – auch nicht von uns, es gibt ja keinen Server.</p>
        <p class="muted">
          Du kannst die App zurücksetzen und danach deine Identität aus einer Sicherung oder von einem anderen gekoppelten Gerät wiederherstellen. Gruppendaten
          holst du dir dann einfach von den anderen zurück.
        </p>
        <div class="stack mt">
          <button
            class="btn danger block"
            onClick={() => confirm('Wirklich alle Daten auf diesem Gerät löschen?') && void resetEverything()}
          >
            App auf diesem Gerät zurücksetzen
          </button>
          <button class="btn ghost block" onClick={() => setForgot(false)}>
            Zurück
          </button>
        </div>
      </div>
    )
  return (
    <div class="fullscreen">
      <BloomLogo />
      {wait > 0 ? (
        <p class="center">Zu viele Versuche. Bitte warte {wait} s.</p>
      ) : (
        <PinPad
          title={appName()}
          error={err}
          onDone={async (pin) => {
            if (await unlockWithPin(pin)) {
              failedPins.set(0)
              return
            }
            const n = failedPins.get() + 1
            failedPins.set(n)
            setErr('Falsche PIN')
            if (n >= 5) setWait(Math.min(300, 15 * 2 ** (n - 5)))
          }}
        />
      )}
      <button class="btn ghost mt" onClick={() => setForgot(true)}>
        PIN vergessen?
      </button>
    </div>
  )
}

type Mode = 'intro' | 'new' | 'pair' | 'backup'

export function Welcome() {
  const pairCode = route.value.parts[0] === 'pair' ? route.value.q.get('c') : null
  const [mode, setMode] = useState<Mode>(pairCode ? 'pair' : 'intro')
  const [restore, setRestore] = useState<Restore | null>(null)

  if (restore) return <ChoosePin restore={restore} />
  if (mode === 'new') return <NewAccount onBack={() => setMode('intro')} />
  if (mode === 'pair') return <PairReceive initial={pairCode ?? ''} onBack={() => setMode('intro')} onRestore={setRestore} />
  if (mode === 'backup') return <BackupRestore onBack={() => setMode('intro')} onRestore={setRestore} />

  const invite = route.value.parts[0] === 'join'
  return (
    <div class="fullscreen">
      <BloomLogo />
      <h1 class="welcome-title">{discreet.value ? 'Notizen' : <>Flower<em>Power</em></>}</h1>
      <p class="center muted">
        Euer gemeinsames Connoisseur-Notizbuch. Alles bleibt auf euren Geräten und wird direkt zwischen euch abgeglichen – ohne Server, ohne Konto.
      </p>
      {invite && <div class="banner mb">Du wurdest in eine Gruppe eingeladen. Richte zuerst die App ein – danach trittst du automatisch bei.</div>}
      <div class="stack mt">
        <button class="btn primary block" onClick={() => setMode('new')}>
          Los geht’s
        </button>
        <button class="btn block" onClick={() => setMode('pair')}>
          Ich nutze die App schon auf einem anderen Gerät
        </button>
        <button class="btn ghost block" onClick={() => setMode('backup')}>
          Aus Sicherungsdatei wiederherstellen
        </button>
      </div>
    </div>
  )
}

function NewAccount({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])
  const steps = 3
  return (
    <div class="fullscreen" style={{ justifyContent: 'flex-start' }}>
      <div class="steps">
        {Array.from({ length: steps + 1 }, (_, i) => (
          <i class={i <= step ? 'f' : ''} />
        ))}
      </div>
      {step === 0 && (
        <div class="stack">
          <h2>Wie sollen dich die anderen sehen?</h2>
          <label class="field">
            <span>Spitzname</span>
            <input class="input" value={name} maxLength={24} autoFocus placeholder="z. B. Mo" onInput={(e) => setName((e.target as HTMLInputElement).value)} />
          </label>
          <div class="chipgroup-label">Avatar</div>
          <div class="avatar-pick">
            {AVATARS.map((a) => (
              <button type="button" class={a === avatar ? 'on' : ''} onClick={() => setAvatar(a)} aria-label={a}>
                {a}
              </button>
            ))}
          </div>
          <div class="row mt">
            <button class="btn ghost" onClick={onBack}>
              Zurück
            </button>
            <button class="btn primary grow" disabled={!name.trim()} onClick={() => setStep(1)}>
              Weiter
            </button>
          </div>
        </div>
      )}
      {step === 1 && (
        <div class="stack">
          <h2>Wähle deinen Look</h2>
          <p class="muted small">Kannst du jederzeit in den Einstellungen ändern.</p>
          <ThemePicker />
          <div class="row mt">
            <button class="btn ghost" onClick={() => setStep(0)}>
              Zurück
            </button>
            <button class="btn primary grow" onClick={() => setStep(2)}>
              Weiter
            </button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div class="stack">
          <h2>Deine Daten, dein Gerät</h2>
          <div class="card flat stack small">
            <div>🔐 Alles wird auf diesem Gerät mit deiner PIN verschlüsselt gespeichert.</div>
            <div>🤝 Mit deiner Gruppe teilst du Daten direkt per WebRTC – nichts liegt auf GitHub oder einem Server.</div>
            <div>🙈 Einzelne Bewertungen kannst du als „privat“ markieren.</div>
            <div>🔑 Im Hintergrund entsteht ein Schlüssel, mit dem du deine Einträge signierst – so kann sich niemand als du ausgeben.</div>
          </div>
          <div class="row mt">
            <button class="btn ghost" onClick={() => setStep(1)}>
              Zurück
            </button>
            <button class="btn primary grow" onClick={() => setStep(3)}>
              PIN festlegen
            </button>
          </div>
        </div>
      )}
      {step === 3 && <ChoosePin name={name.trim()} avatar={avatar} onBack={() => setStep(2)} />}
    </div>
  )
}

function ChoosePin({ name, avatar, restore, onBack }: { name?: string; avatar?: string; restore?: Restore; onBack?: () => void }) {
  const [first, setFirst] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  if (busy)
    return (
      <div class="fullscreen center">
        <BloomLogo />
        <p>Schlüssel werden erzeugt …</p>
      </div>
    )
  return (
    <div class={restore ? 'fullscreen' : ''}>
      <PinPad
        key={first ? 'b' : 'a'}
        title={first ? 'PIN wiederholen' : `${PIN_LEN}-stellige PIN wählen`}
        error={err}
        onDone={async (pin) => {
          if (!first) {
            setErr(null)
            setFirst(pin)
            return
          }
          if (pin !== first) {
            setFirst(null)
            setErr('Stimmt nicht überein – nochmal')
            return
          }
          setBusy(true)
          await createAccount({ pin, name, avatar, restore })
        }}
      />
      <p class="center small muted mt">Die PIN verlässt nie dieses Gerät. Vergisst du sie, hilft nur eine Sicherung oder ein gekoppeltes Gerät.</p>
      {onBack && (
        <button class="btn ghost block" onClick={onBack}>
          Zurück
        </button>
      )}
    </div>
  )
}

function PairReceive({ initial, onBack, onRestore }: { initial: string; onBack: () => void; onRestore: (r: Restore) => void }) {
  const [code, setCode] = useState(initial)
  const [status, setStatus] = useState<string | null>(null)
  const start = (c: string) => {
    const clean = c.includes('c=') ? new URLSearchParams(c.split('?')[1]).get('c') ?? '' : c.trim()
    if (!clean) return
    void receivePairing(clean, setStatus).then((b) => onRestore({ identity: b.identity, personal: b.personal }))
  }
  useEffect(() => {
    if (initial) start(initial)
  }, [])
  return (
    <div class="fullscreen">
      <h2>Mit anderem Gerät koppeln</h2>
      <ol class="muted">
        <li>
          Öffne die App auf deinem <b>bisherigen</b> Gerät.
        </li>
        <li>Einstellungen → Meine Geräte → „Neues Gerät koppeln“.</li>
        <li>Scanne den QR-Code mit der Kamera dieses Geräts – oder füge den Link hier ein.</li>
      </ol>
      {status ? (
        <div class="banner mt">{status}</div>
      ) : (
        <div class="stack mt">
          <input class="input" placeholder="Kopplungs-Link oder Code" value={code} onInput={(e) => setCode((e.target as HTMLInputElement).value)} />
          <button class="btn primary" disabled={!code.trim()} onClick={() => start(code)}>
            Verbinden
          </button>
        </div>
      )}
      <button class="btn ghost mt" onClick={onBack}>
        Zurück
      </button>
    </div>
  )
}

function BackupRestore({ onBack, onRestore }: { onBack: () => void; onRestore: (r: Restore) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)
  return (
    <div class="fullscreen">
      <h2>Sicherung einspielen</h2>
      <p class="muted">Wähle deine FlowerPower-Sicherungsdatei und gib das Passwort ein, das du beim Erstellen gewählt hast.</p>
      <div class="stack">
        <input type="file" accept=".json,application/json" class="input" onChange={(e) => setFile((e.target as HTMLInputElement).files?.[0] ?? null)} />
        <input class="input" type="password" placeholder="Passwort der Sicherung" value={pw} onInput={(e) => setPw((e.target as HTMLInputElement).value)} />
        {err && <div class="banner warn">{err}</div>}
        <button
          class="btn primary"
          disabled={!file || !pw}
          onClick={async () => {
            try {
              onRestore(await readBackup(file!, pw))
            } catch (e) {
              setErr((e as Error).message)
            }
          }}
        >
          Wiederherstellen
        </button>
        <button class="btn ghost" onClick={onBack}>
          Zurück
        </button>
      </div>
    </div>
  )
}

// Theme bei Bedarf anwenden (z. B. nach Zurücksetzen)
if (!THEMES.some((t) => t.id === theme.peek())) setTheme('cuvee')
