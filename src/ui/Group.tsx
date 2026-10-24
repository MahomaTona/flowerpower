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
  setActiveGroup,
  type GroupRuntime,
} from '../lib/app'
import { randomPassword } from '../lib/crypto'
import { pendingInvite } from '../lib/prefs'
import { confetti } from '../lib/confetti'
import { Avatar, Copy, go, Icon, PageHead, QR, route, Seg, ShareBtn, Sheet, toast } from './kit'
import { myStatus, onlineMembers, useData } from './data'
import { MemberActions, ModerationPanel } from './Moderation'

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
          confetti()
          toast('🎉 Gruppe gegründet – lade jetzt Leute ein')
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
  const [actionsFor, setActionsFor] = useState<string | null>(null)
  const snap = d.snap
  const st = myStatus(snap, me.id)
  const activeCount = [...snap.members.keys()].filter((id) => snap.approved.has(id) && !snap.banned.has(id)).length
  const online = onlineMembers(rt)
  const peers = Object.keys(rt.peering?.peers.value ?? {}).length
  const err = rt.peering?.error.value
  const banned = snap.banned.has(me.id)
  const members = [...snap.members.values()].filter((m) => !snap.pending.has(m.id)).sort((a, b) => Number(online.has(b.id)) - Number(online.has(a.id)) || a.name.localeCompare(b.name))
  return (
    <>
      {banned && <div class="banner warn mb">Du wurdest aus dieser Gruppe entfernt. Du siehst nur noch den alten Stand.</div>}
      {st.pending && !banned && (
        <div class="banner mb">⏳ Du wartest auf Freigabe. Sobald jemand aus der Gruppe dich bestätigt, sehen die anderen deine Beiträge.</div>
      )}
      {st.muted && (
        <div class="banner warn mb">
          🔇 Du bist {Number.isFinite(st.mutedUntil) ? `bis ${new Date(st.mutedUntil).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}` : 'bis auf Weiteres'} stummgeschaltet.
        </div>
      )}
      <div class="card">
        <div class="row between">
          <div>
            <h2 style={{ margin: 0 }}>{rt.entry.name}</h2>
            <div class="small muted">
              {activeCount} Mitglied{activeCount === 1 ? '' : 'er'} · {peers ? `${peers} Gerät${peers === 1 ? '' : 'e'} verbunden` : 'gerade niemand online'}
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
            const ms = myStatus(snap, m.id)
            const role = m.id === snap.founder ? '👑 Gründer' : snap.admins.has(m.id) ? '⭐ Admin' : snap.banned.has(m.id) ? 'Entfernt' : 'Mitglied'
            const canAct = m.id !== me.id && !snap.banned.has(m.id) && !st.banned && !st.pending
            return (
              <button
                class="member-row"
                disabled={!canAct}
                onClick={() => canAct && setActionsFor(m.id)}
                style={{ opacity: snap.banned.has(m.id) ? 0.5 : 1 }}
              >
                <Avatar emoji={m.avatar} online={online.has(m.id) || m.id === me.id} />
                <div class="grow">
                  <b>{m.name}</b> {m.id === me.id && <span class="muted small">(du)</span>}
                  <div class="tiny muted">
                    {role}
                    {ms.muted && ' · 🔇 stumm'}
                  </div>
                </div>
                {canAct && <Icon name="more" />}
              </button>
            )
          })}
        </div>
        <p class="tiny muted">
          Tippe auf ein Mitglied für Aktionen. Admins können sofort handeln, alle anderen können eine Abstimmung starten. Wird jemand entfernt, bekommen alle
          anderen automatisch neue Zugangsdaten – das alte Passwort ist danach wertlos.
        </p>
      </div>

      <ModerationPanel rt={rt} snap={snap} strainName={(id) => d.strainMap.get(id)?.name} />

      <Sheet open={!!actionsFor} onClose={() => setActionsFor(null)}>
        {actionsFor && <MemberActions rt={rt} snap={snap} id={actionsFor} onClose={() => setActionsFor(null)} />}
      </Sheet>

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
