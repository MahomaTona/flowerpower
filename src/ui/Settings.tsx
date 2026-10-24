import { useEffect, useState } from 'preact/hooks'
import {
  deviceName,
  devicePeers,
  exportBackup,
  groups,
  lockNow,
  mergeBackup,
  readBackup,
  resetEverything,
  setDeviceName,
  startPairing,
} from '../lib/app'
import { changePin } from '../lib/vault'
import { confetti } from '../lib/confetti'
import { THEMES, autoLock, discreet, setAutoLock, setDiscreet, setTheme, theme } from '../lib/prefs'
import { Avatar, Copy, PageHead, QR, Sheet, go, toast } from './kit'
import { PinPad } from './Start'
import { ProfileSheet } from './Me'
import { useData } from './data'

export function ThemePicker() {
  return (
    <div class="theme-pick">
      {THEMES.map((t) => (
        <button type="button" class={theme.value === t.id ? 'on' : ''} onClick={() => setTheme(t.id)} aria-pressed={theme.value === t.id}>
          <span class="sw">
            {t.colors.map((c) => (
              <i style={{ background: c }} />
            ))}
          </span>
          <span class="nm">{t.name}</span>
        </button>
      ))}
    </div>
  )
}

export function Settings() {
  const d = useData()
  const [profile, setProfileOpen] = useState(false)
  const [pin, setPin] = useState(false)
  const [pair, setPair] = useState(false)
  const [backup, setBackup] = useState<'export' | 'import' | null>(null)
  const devs = Object.values(devicePeers.value)
  return (
    <div class="content">
      <PageHead title="Einstellungen" />

      <Block title="Profil">
        <div class="row">
          <Avatar emoji={d.profile.avatar} />
          <b class="grow">{d.profile.name}</b>
          <button class="btn sm" onClick={() => setProfileOpen(true)}>
            Ändern
          </button>
        </div>
        <div class="tiny muted mt">
          Deine ID: <span class="code" style={{ padding: '1px 6px' }}>{d.me.id}</span>
        </div>
      </Block>

      <Block title="Gruppen">
        {[...groups.values()].map((g) => (
          <div class="row between small" style={{ padding: '4px 0' }}>
            <span>👥 {g.entry.name}</span>
            <span class="muted">{Object.keys(g.peering?.peers.value ?? {}).length} verbunden</span>
          </div>
        ))}
        <button class="btn block mt" onClick={() => go('/group')}>
          Gruppen verwalten
        </button>
      </Block>

      <Block title="Darstellung">
        <ThemePicker />
      </Block>

      <Block title="Diskreter Modus">
        <Toggle
          on={discreet.value}
          onChange={(v) => {
            setDiscreet(v)
            toast(v ? 'Diskreter Modus an' : 'Diskreter Modus aus')
          }}
          label="Neutraler Name & Icon"
        />
        <p class="small muted mt" style={{ marginBottom: 0 }}>
          Die App heißt dann „Notizen“ mit einem schlichten Icon – im Browser-Tab und wenn du sie <b>danach</b> zum Startbildschirm hinzufügst. Ein bereits
          installiertes Icon musst du dafür einmal entfernen und neu hinzufügen.
        </p>
      </Block>

      <Block title="Sicherheit">
        <div class="stack">
          <label class="field">
            <span>Automatisch sperren, wenn die App im Hintergrund war</span>
            <select class="input" value={String(autoLock.value)} onChange={(e) => setAutoLock(Number((e.target as HTMLSelectElement).value))}>
              <option value="0.01">sofort</option>
              <option value="1">nach 1 Minute</option>
              <option value="5">nach 5 Minuten</option>
              <option value="30">nach 30 Minuten</option>
              <option value="0">nie</option>
            </select>
          </label>
          <div class="row">
            <button class="btn grow" onClick={() => setPin(true)}>
              PIN ändern
            </button>
            <button class="btn grow" onClick={lockNow}>
              🔒 Jetzt sperren
            </button>
          </div>
        </div>
      </Block>

      <Block title="Meine Geräte">
        <label class="field">
          <span>Name dieses Geräts</span>
          <input class="input" value={deviceName.value} maxLength={30} onChange={(e) => setDeviceName((e.target as HTMLInputElement).value.trim() || 'Gerät')} />
        </label>
        <div class="small mt">
          {devs.length ? (
            <>
              Verbunden mit: <b>{devs.map((x) => x.device ?? 'Gerät').join(', ')}</b>
            </>
          ) : (
            <span class="muted">Gerade kein anderes eigenes Gerät online.</span>
          )}
        </div>
        <p class="small muted mt">Gekoppelte Geräte teilen deine Identität, private Bewertungen, Merkliste und Gruppen – und gleichen sich automatisch ab.</p>
        <button class="btn block" onClick={() => setPair(true)}>
          Neues Gerät koppeln
        </button>
      </Block>

      <Block title="Sicherung">
        <p class="small muted">
          Eine verschlüsselte Datei mit deiner Identität und allen Daten. Damit kannst du alles wiederherstellen, falls dein Gerät verloren geht.
        </p>
        <div class="row">
          <button class="btn grow" onClick={() => setBackup('export')}>
            Sicherung speichern
          </button>
          <button class="btn grow" onClick={() => setBackup('import')}>
            Sicherung einspielen
          </button>
        </div>
      </Block>

      <Block title="So funktioniert’s">
        <ul class="small muted" style={{ paddingLeft: '1.1rem', margin: 0 }}>
          <li>GitHub liefert nur die leere App. Eure Daten liegen ausschließlich auf euren Geräten.</li>
          <li>Zum ersten Kennenlernen nutzen eure Geräte öffentliche Nostr-Relays. Was dort durchläuft, ist mit dem Gruppenpasswort verschlüsselt.</li>
          <li>Danach fließen die Daten direkt und Ende-zu-Ende-verschlüsselt per WebRTC von Gerät zu Gerät.</li>
          <li>Wer gerade online ist, gibt Neues an die anderen weiter. Es geht nichts verloren, solange mindestens ein Gerät es hat.</li>
        </ul>
      </Block>

      <Block title="Gefahrenzone">
        <button
          class="btn danger block"
          onClick={() =>
            confirm('Alle Daten auf diesem Gerät löschen? Ohne Sicherung oder gekoppeltes Gerät ist deine Identität dann weg.') && void resetEverything()
          }
        >
          App auf diesem Gerät zurücksetzen
        </button>
      </Block>

      <ProfileSheet open={profile} onClose={() => setProfileOpen(false)} name={d.profile.name} avatar={d.profile.avatar} />
      <Sheet open={pin} onClose={() => setPin(false)}>
        <ChangePin onDone={() => setPin(false)} />
      </Sheet>
      <Sheet open={pair} onClose={() => setPair(false)}>
        {pair && <PairSheet onDone={() => setPair(false)} />}
      </Sheet>
      <Sheet open={!!backup} onClose={() => setBackup(null)}>
        {backup === 'export' && <ExportBackup onDone={() => setBackup(null)} />}
        {backup === 'import' && <ImportBackup onDone={() => setBackup(null)} />}
      </Sheet>
    </div>
  )
}

function Block({ title, children }: { title: string; children: preact.ComponentChildren }) {
  return (
    <div class="section">
      <h3>{title}</h3>
      <div class="card">{children}</div>
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label class="row between" style={{ cursor: 'pointer' }}>
      <span>{label}</span>
      <input type="checkbox" checked={on} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} style={{ width: 22, height: 22, accentColor: 'var(--accent)' }} />
    </label>
  )
}

function ChangePin({ onDone }: { onDone: () => void }) {
  const [old, setOld] = useState<string | null>(null)
  const [next, setNext] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const step = old === null ? 0 : next === null ? 1 : 2
  return (
    <PinPad
      key={step}
      title={['Aktuelle PIN', 'Neue PIN', 'Neue PIN wiederholen'][step]}
      error={err}
      onDone={async (p) => {
        setErr(null)
        if (step === 0) setOld(p)
        else if (step === 1) setNext(p)
        else if (p !== next) {
          setNext(null)
          setErr('Stimmt nicht überein')
        } else if (await changePin(old!, p)) {
          toast('PIN geändert')
          onDone()
        } else {
          setOld(null)
          setNext(null)
          setErr('Aktuelle PIN war falsch')
        }
      }}
    />
  )
}

function PairSheet({ onDone }: { onDone: () => void }) {
  const [p, setP] = useState<ReturnType<typeof startPairing> | null>(null)
  useEffect(() => {
    const s = startPairing(() => {
      confetti()
      toast('Gerät gekoppelt')
      onDone()
    })
    setP(s)
    return s.cancel
  }, [])
  if (!p) return null
  return (
    <div>
      <h2>Neues Gerät koppeln</h2>
      <p class="small muted">
        Öffne auf dem neuen Gerät die Kamera und scanne den Code – oder öffne den Link dort. Danach musst du hier die Verbindung bestätigen.
      </p>
      <QR text={p.link} />
      <div class="row mt" style={{ justifyContent: 'center' }}>
        <Copy text={p.link} label="Link kopieren" />
      </div>
      <div class="banner mt small">⏳ Warte auf das neue Gerät … Lass dieses Fenster offen.</div>
      <p class="tiny muted mt">Achtung: Wer diesen Code hat, kann sich als du ausgeben. Zeige ihn nur deinen eigenen Geräten.</p>
    </div>
  )
}

function ExportBackup({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  return (
    <div class="stack">
      <h2>Sicherung speichern</h2>
      <p class="small muted">Wähle ein Passwort für die Datei. Ohne dieses Passwort lässt sie sich nicht öffnen – auch nicht von uns.</p>
      <input class="input" type="password" placeholder="Passwort (mind. 8 Zeichen)" value={pw} onInput={(e) => setPw((e.target as HTMLInputElement).value)} />
      <input class="input" type="password" placeholder="Passwort wiederholen" value={pw2} onInput={(e) => setPw2((e.target as HTMLInputElement).value)} />
      <button
        class="btn primary"
        disabled={pw.length < 8 || pw !== pw2}
        onClick={async () => {
          const blob = await exportBackup(pw)
          const a = document.createElement('a')
          a.href = URL.createObjectURL(blob)
          a.download = `flowerpower-sicherung-${new Date().toISOString().slice(0, 10)}.json`
          a.click()
          setTimeout(() => URL.revokeObjectURL(a.href), 5000)
          toast('Sicherung erstellt')
          onDone()
        }}
      >
        Datei herunterladen
      </button>
    </div>
  )
}

function ImportBackup({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [pw, setPw] = useState('')
  const [err, setErr] = useState<string | null>(null)
  return (
    <div class="stack">
      <h2>Sicherung einspielen</h2>
      <p class="small muted">Die Daten werden mit dem aktuellen Stand zusammengeführt – nichts wird überschrieben.</p>
      <input type="file" accept=".json,application/json" class="input" onChange={(e) => setFile((e.target as HTMLInputElement).files?.[0] ?? null)} />
      <input class="input" type="password" placeholder="Passwort der Sicherung" value={pw} onInput={(e) => setPw((e.target as HTMLInputElement).value)} />
      {err && <div class="banner warn">{err}</div>}
      <button
        class="btn primary"
        disabled={!file || !pw}
        onClick={async () => {
          try {
            await mergeBackup(await readBackup(file!, pw))
            toast('Sicherung eingespielt')
            onDone()
          } catch (e) {
            setErr((e as Error).message)
          }
        }}
      >
        Einspielen
      </button>
    </div>
  )
}
