// Gruppen gründen, beitreten, einladen und verwalten.
import { useState } from 'preact/hooks'
import {
  activeGroup,
  createGroup,
  groups,
  groupsTick,
  inviteLink,
  joinGroup,
  leaveGroup,
  me as meSig,
  parseInvite,
  removeMember,
  setActiveGroup,
  setRole,
  type GroupRuntime,
} from '../lib/app'
import { randomPassword } from '../lib/crypto'
import { pendingInvite } from '../lib/prefs'
import { Avatar, Copy, PageHead, QR, Seg, Sheet, ShareBtn, go, route, toast } from './kit'
import { onlineMembers, useData } from './data'

export function GroupPage() {
  groupsTick.value
  const rt = activeGroup.value
  const [mode, setMode] = useState<'gruenden' | 'beitreten'>(rt ? 'beitreten' : 'gruenden')
  const [showForm, setShowForm] = useState(false)
  return (
    <div class="content">
      <PageHead title="Gruppe" backTo={!!rt} />
      {groups.size > 1 && (
        <div class="tabs">
          {[...groups.values()].map((g) => (
            <button class={'chip' + (g === rt ? ' on' : '')} onClick={() => setActiveGroup(g.entry.docId)}>
              👥 {g.entry.name}
            </button>
          ))}
        </div>
      )}
      {rt && <GroupDetail rt={rt} />}
      <div class="section">
        {rt && !showForm && groups.size > 0 ? (
          <button class="btn block" onClick={() => setShowForm(true)}>
            + Weitere Gruppe gründen oder beitreten
          </button>
        ) : (
          <div class="card stack">
            <Seg
              value={mode}
              onChange={setMode}
              opts={[
                ['gruenden', 'Gruppe gründen'],
                ['beitreten', 'Beitreten'],
              ]}
            />
            {mode === 'gruenden' ? <CreateForm /> : <JoinForm />}
          </div>
        )}
      </div>
    </div>
  )
}

function CreateForm() {
  const [name, setName] = useState('')
  const [pw, setPw] = useState(randomPassword())
  const [busy, setBusy] = useState(false)
  return (
    <div class="stack">
      <p class="muted small" style={{ margin: 0 }}>
        Name und Passwort sind der „Schlüssel“ zur Gruppe. Wer beides kennt, kann beitreten – teile es nur mit Leuten, denen du vertraust.
      </p>
      <label class="field">
        <span>Gruppenname</span>
        <input class="input" value={name} maxLength={40} placeholder="z. B. Grüner Salon" onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      </label>
      <label class="field">
        <span>Passwort</span>
        <div class="row">
          <input class="input" value={pw} onInput={(e) => setPw((e.target as HTMLInputElement).value)} />
          <button class="btn" type="button" onClick={() => setPw(randomPassword())} aria-label="Neues Passwort würfeln">
            🎲
          </button>
        </div>
      </label>
      {pw.length > 0 && pw.length < 10 && <div class="banner warn small">Kurze Passwörter sind leicht zu erraten. Mindestens 10 Zeichen empfohlen.</div>}
      <button
        class="btn primary"
        disabled={!name.trim() || pw.length < 6 || busy}
        onClick={async () => {
          setBusy(true)
          await createGroup(name, pw)
          toast('Gruppe gegründet – lade jetzt Leute ein')
          setBusy(false)
          go('/group')
        }}
      >
        Gruppe gründen
      </button>
    </div>
  )
}

function JoinForm() {
  const [name, setName] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <div class="stack">
      <p class="muted small" style={{ margin: 0 }}>
        Gib Gruppenname und Passwort ein, die du bekommen hast – oder öffne einfach den Einladungslink bzw. scanne den QR-Code.
      </p>
      <input class="input" placeholder="Gruppenname" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      <input class="input" placeholder="Passwort" value={pw} autoComplete="off" onInput={(e) => setPw((e.target as HTMLInputElement).value)} />
      <button
        class="btn primary"
        disabled={!name.trim() || !pw || busy}
        onClick={async () => {
          setBusy(true)
          await joinGroup(name, pw)
          setBusy(false)
          toast('Beigetreten – Daten kommen, sobald jemand online ist')
          go('/feed')
        }}
      >
        Beitreten
      </button>
    </div>
  )
}

function GroupDetail({ rt }: { rt: GroupRuntime }) {
  const d = useData()
  const me = meSig.value!
  const [invite, setInvite] = useState(false)
  const snap = d.snap
  const isAdmin = snap.admins.has(me.id)
  const online = onlineMembers(rt)
  const peers = Object.keys(rt.peering?.peers.value ?? {}).length
  const err = rt.peering?.error.value
  const banned = snap.banned.has(me.id)
  const members = [...snap.members.values()].sort((a, b) => Number(online.has(b.id)) - Number(online.has(a.id)) || a.name.localeCompare(b.name))
  return (
    <>
      {banned && <div class="banner warn mb">Ein Admin hat dich aus dieser Gruppe entfernt. Du siehst nur noch den alten Stand.</div>}
      <div class="card">
        <div class="row between">
          <div>
            <h2 style={{ margin: 0 }}>{rt.entry.name}</h2>
            <div class="small muted">
              {snap.members.size} Mitglied{snap.members.size === 1 ? '' : 'er'} · {peers ? `${peers} Gerät${peers === 1 ? '' : 'e'} verbunden` : 'gerade niemand online'}
            </div>
          </div>
          <span class={'online' + (peers ? ' on' : '')}>
            <i /> {peers ? 'verbunden' : 'wartet'}
          </span>
        </div>
        {err && <div class="banner warn small mt">Verbindungsproblem: {err}</div>}
        {!banned && (
          <button class="btn primary block mt" onClick={() => setInvite(true)}>
            Leute einladen
          </button>
        )}
      </div>

      <div class="section">
        <h3>Mitglieder</h3>
        <div class="card">
          {members.length === 0 && <p class="muted small">Noch keine Mitglieder sichtbar – warte, bis sich jemand verbindet.</p>}
          {members.map((m) => {
            const role = m.id === snap.founder ? 'Gründer' : snap.admins.has(m.id) ? 'Admin' : snap.banned.has(m.id) ? 'Entfernt' : ''
            return (
              <div class="row" style={{ padding: '6px 0', opacity: snap.banned.has(m.id) ? 0.5 : 1 }}>
                <Avatar emoji={m.avatar} online={online.has(m.id) || m.id === me.id} />
                <div class="grow">
                  <b>{m.name}</b> {m.id === me.id && <span class="muted small">(du)</span>}
                  <div class="tiny muted">{role || 'Mitglied'}</div>
                </div>
                {isAdmin && m.id !== me.id && m.id !== snap.founder && !snap.banned.has(m.id) && <MemberMenu rt={rt} id={m.id} name={m.name} admin={snap.admins.has(m.id)} />}
              </div>
            )
          })}
        </div>
        <p class="tiny muted">
          Jeder Eintrag ist mit dem Schlüssel seines Autors signiert. Entfernt ein Admin jemanden, bekommen alle anderen automatisch neue Zugangsdaten – die
          entfernte Person bleibt im alten Raum zurück.
        </p>
      </div>

      <div class="section">
        <button
          class="btn danger block"
          onClick={() => {
            if (confirm(`„${rt.entry.name}“ auf allen deinen Geräten verlassen? Die Gruppendaten werden lokal gelöscht.`)) {
              leaveGroup(rt.entry.docId)
              go('/feed')
            }
          }}
        >
          Gruppe verlassen
        </button>
      </div>

      <Sheet open={invite} onClose={() => setInvite(false)}>
        <h2>Einladen</h2>
        <p class="muted small">Scannen lassen, Link teilen – oder Name und Passwort persönlich weitergeben.</p>
        <QR text={inviteLink(rt)} />
        <div class="row mt" style={{ justifyContent: 'center' }}>
          <ShareBtn text={inviteLink(rt)} title={`Einladung in „${rt.entry.name}“`} />
          <Copy text={inviteLink(rt)} label="Link kopieren" />
        </div>
        <dl class="kv mt">
          <dt>Gruppe</dt>
          <dd>
            <span class="code">{rt.entry.name}</span>
          </dd>
          <dt>Passwort</dt>
          <dd>
            <span class="code">{rt.entry.password}</span>
          </dd>
        </dl>
        <p class="tiny muted mt">Der Link enthält das Passwort hinter dem #. Dieser Teil wird nie an GitHub oder einen anderen Server geschickt.</p>
        <button class="btn block mt" onClick={() => setInvite(false)}>
          Fertig
        </button>
      </Sheet>
    </>
  )
}

function MemberMenu({ rt, id, name, admin }: { rt: GroupRuntime; id: string; name: string; admin: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button class="btn sm ghost" onClick={() => setOpen(true)} aria-label={`Optionen für ${name}`}>
        ⋯
      </button>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <h2>{name}</h2>
        <div class="stack">
          <button
            class="btn"
            onClick={async () => {
              await setRole(rt, id, admin ? 'member' : 'admin')
              toast(admin ? 'Admin-Rechte entzogen' : `${name} ist jetzt Admin`)
              setOpen(false)
            }}
          >
            {admin ? 'Admin-Rechte entziehen' : 'Zum Admin machen'}
          </button>
          <button
            class="btn danger"
            onClick={async () => {
              if (!confirm(`${name} wirklich entfernen? Alle anderen bekommen neue Zugangsdaten.`)) return
              await removeMember(rt, id)
              toast(`${name} entfernt – Gruppe zieht in einen neuen Raum um`)
              setOpen(false)
            }}
          >
            Aus Gruppe entfernen
          </button>
          <button class="btn ghost" onClick={() => setOpen(false)}>
            Abbrechen
          </button>
        </div>
      </Sheet>
    </>
  )
}

/** Einladungslink geöffnet: kurz bestätigen lassen. */
export function JoinInvite() {
  const i = route.value.q.get('i') ?? ''
  const inv = parseInvite(i)
  const [busy, setBusy] = useState(false)
  if (!inv)
    return (
      <div class="content">
        <PageHead title="Einladung" />
        <div class="banner warn">Dieser Einladungslink ist ungültig.</div>
      </div>
    )
  return (
    <div class="content">
      <PageHead title="Einladung" />
      <div class="card stack center">
        <div style={{ fontSize: '2.5rem' }}>👥</div>
        <h2>„{inv.n}“ beitreten?</h2>
        <p class="muted">Du teilst dann deine Bewertungen (außer private) mit dieser Gruppe – direkt von Gerät zu Gerät.</p>
        <button
          class="btn primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            pendingInvite.set(null)
            await joinGroup(inv.n, inv.p, inv.f)
            toast('Beigetreten')
            go('/feed')
          }}
        >
          Beitreten
        </button>
        <button
          class="btn ghost"
          onClick={() => {
            pendingInvite.set(null)
            go('/feed')
          }}
        >
          Nein danke
        </button>
      </div>
    </div>
  )
}
