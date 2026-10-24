// Moderation: melden, ausblenden, stummschalten, abstimmen, Wartebereich.
import { useState } from 'preact/hooks'
import {
  approveMember,
  castBallot,
  executeVote,
  me as meSig,
  moderate,
  rejectPending,
  removeMember,
  report,
  setRole,
  startVote,
  type GroupRuntime,
} from '../lib/app'
import { local } from '../lib/store'
import { refKey, type ContentRef, type Snapshot, type VoteResult } from '../lib/model'
import { Avatar, Chip, Icon, Sheet, timeAgo, toast } from './kit'
import { memberOf, myStatus } from './data'

const REASONS = ['Beleidigend', 'Spam', 'Unpassend', 'Falsche Infos', 'Sonstiges']
const MUTES: [string, number | undefined][] = [
  ['1 Tag', 864e5],
  ['1 Woche', 7 * 864e5],
  ['Unbefristet', undefined],
]
const VOTE_MUTES: [string, number][] = [
  ['1 Tag', 864e5],
  ['1 Woche', 7 * 864e5],
  ['1 Monat', 30 * 864e5],
]

export const voteNeeded = (v: Pick<VoteResult, 'eligible'>) => Math.max(Math.min(3, v.eligible), Math.ceil((v.eligible * 2) / 3))

/** Beschreibt, worum es bei einem Inhalt geht (für Meldungen und Abstimmungen). */
export function describeRef(snap: Snapshot, ref: ContentRef, strainName: (id: string) => string | undefined) {
  if (ref.map === 'ratings') {
    const r = snap.ratings.find((x) => x.id === ref.id)
    return r ? { author: r.a, text: `Bewertung von ${strainName(r.strainId) ?? 'einer Sorte'}${r.note ? `: „${r.note}“` : ''}` } : undefined
  }
  if (ref.map === 'comments') {
    const c = snap.comments.find((x) => x.id === ref.id)
    return c ? { author: c.a, text: `Kommentar: „${c.text}“` } : undefined
  }
  if (ref.map === 'events') {
    const e = snap.events.find((x) => x.id === ref.id)
    return e ? { author: e.a, text: `Treffen: ${e.title}` } : undefined
  }
  const s = snap.strains.find((x) => x.id === ref.id)
  return s ? { author: s.a, text: `Sorte: ${s.name}` } : undefined
}

/** Hinweis für Admins, wenn ein Inhalt ausgeblendet ist. */
export function HiddenNote({ snap, refv }: { snap: Snapshot; refv: ContentRef }) {
  const why = snap.hidden.get(refKey(refv))
  if (!why) return null
  return <div class="banner warn small mb">🙈 Ausgeblendet – nur Admins sehen das. {why}</div>
}

/** ⋯-Menü an Beiträgen: melden, ausblenden, abstimmen. */
export function ContentMenu({ rt, snap, refv, author, glass }: { rt: GroupRuntime; snap: Snapshot; refv: ContentRef; author: string; glass?: boolean }) {
  const me = meSig.value!
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'menu' | 'report' | 'hide'>('menu')
  const st = myStatus(snap, me.id)
  const isHidden = snap.hidden.has(refKey(refv))
  const mine = author === me.id
  if (st.banned || st.pending) return null
  if (mine && !st.admin) return null
  const close = () => {
    setOpen(false)
    setMode('menu')
  }
  return (
    <>
      <button
        class={glass ? 'glassbtn' : 'iconbtn'}
        aria-label="Weitere Aktionen"
        onClick={(e) => {
          e.preventDefault()
          setOpen(true)
        }}
      >
        <Icon name="more" />
      </button>
      <Sheet open={open} onClose={close}>
        {mode === 'menu' && (
          <div class="stack">
            <h2>Beitrag</h2>
            {!mine && (
              <button class="btn" onClick={() => setMode('report')}>
                🚩 Melden
              </button>
            )}
            {st.admin &&
              (isHidden ? (
                <button
                  class="btn"
                  onClick={async () => {
                    await moderate(rt, { action: 'unhide', ref: refv })
                    toast('Wieder sichtbar')
                    close()
                  }}
                >
                  👁️ Wieder einblenden
                </button>
              ) : (
                <button class="btn" onClick={() => setMode('hide')}>
                  🙈 Für alle ausblenden
                </button>
              ))}
            {!st.admin && !mine && !st.muted && (
              <button
                class="btn"
                onClick={async () => {
                  if (!confirm('Abstimmung starten, ob dieser Beitrag ausgeblendet wird?')) return
                  await startVote(rt, { kind: 'hide', ref: refv })
                  toast('🗳️ Abstimmung gestartet')
                  close()
                }}
              >
                🗳️ Abstimmen: ausblenden
              </button>
            )}
            <button class="btn ghost" onClick={close}>
              Abbrechen
            </button>
          </div>
        )}
        {(mode === 'report' || mode === 'hide') && (
          <div class="stack">
            <h2>{mode === 'report' ? 'Warum meldest du das?' : 'Grund (sehen alle Admins)'}</h2>
            <div class="chips">
              {REASONS.map((r) => (
                <Chip
                  onClick={async () => {
                    if (mode === 'report') {
                      await report(rt, refv, r)
                      toast('Danke – die Admins sehen deine Meldung')
                    } else {
                      await moderate(rt, { action: 'hide', ref: refv, reason: r })
                      toast('Ausgeblendet')
                    }
                    close()
                  }}
                >
                  {r}
                </Chip>
              ))}
            </div>
            <button class="btn ghost" onClick={() => setMode('menu')}>
              Zurück
            </button>
          </div>
        )}
      </Sheet>
    </>
  )
}

/** Aktionen für ein Mitglied – Admins handeln direkt, alle anderen über Abstimmungen. */
export function MemberActions({ rt, snap, id, onClose }: { rt: GroupRuntime; snap: Snapshot; id: string; onClose: () => void }) {
  const me = meSig.value!
  const st = myStatus(snap, me.id)
  const m = memberOf(snap, id)
  const target = myStatus(snap, id)
  const [step, setStep] = useState<'menu' | 'mute' | 'vote-mute'>('menu')
  const isFounder = id === snap.founder
  const done = (msg: string) => {
    toast(msg)
    onClose()
  }
  if (step === 'mute')
    return (
      <div class="stack">
        <h2>{m.name} stummschalten</h2>
        <p class="small muted">Neue Beiträge werden für alle ausgeblendet. {m.name} bleibt in der Gruppe und kann weiter mitlesen.</p>
        {MUTES.map(([l, dur]) => (
          <button class="btn" onClick={async () => (await moderate(rt, { action: 'mute', target: id, until: dur ? Date.now() + dur : undefined }), done(`${m.name} ist stumm (${l})`))}>
            {l}
          </button>
        ))}
        <button class="btn ghost" onClick={() => setStep('menu')}>
          Zurück
        </button>
      </div>
    )
  if (step === 'vote-mute')
    return (
      <div class="stack">
        <h2>Abstimmung: {m.name} stummschalten</h2>
        {VOTE_MUTES.map(([l, dur]) => (
          <button class="btn" onClick={async () => (await startVote(rt, { kind: 'mute', target: id, duration: dur }), done('🗳️ Abstimmung gestartet'))}>
            {l}
          </button>
        ))}
        <button class="btn ghost" onClick={() => setStep('menu')}>
          Zurück
        </button>
      </div>
    )
  return (
    <div class="stack">
      <div class="row">
        <Avatar emoji={m.avatar} lg />
        <div>
          <h2 style={{ margin: 0 }}>{m.name}</h2>
          <div class="small muted">
            {isFounder ? 'Gründer' : snap.admins.has(id) ? 'Admin' : 'Mitglied'}
            {target.muted && ` · stumm${Number.isFinite(target.mutedUntil) ? ` bis ${new Date(target.mutedUntil).toLocaleDateString('de-DE')}` : ''}`}
          </div>
        </div>
      </div>
      {st.admin && !isFounder && (
        <>
          <div class="chipgroup-label">Als Admin</div>
          {target.muted ? (
            <button class="btn" onClick={async () => (await moderate(rt, { action: 'unmute', target: id }), done('Stummschaltung aufgehoben'))}>
              🔊 Stummschaltung aufheben
            </button>
          ) : (
            <button class="btn" onClick={() => setStep('mute')}>
              🔇 Stummschalten …
            </button>
          )}
          <button
            class="btn"
            onClick={async () => (await setRole(rt, id, snap.admins.has(id) ? 'member' : 'admin'), done(snap.admins.has(id) ? 'Admin-Rechte entzogen' : `${m.name} ist jetzt Admin`))}
          >
            {snap.admins.has(id) ? '⬇️ Admin-Rechte entziehen' : '⭐ Zum Admin machen'}
          </button>
          <button
            class="btn danger"
            onClick={async () => {
              if (!confirm(`${m.name} wirklich entfernen? Alle anderen bekommen automatisch neue Zugangsdaten.`)) return
              await removeMember(rt, id)
              done(`${m.name} entfernt – die Gruppe zieht in einen neuen Raum`)
            }}
          >
            🚪 Sofort entfernen
          </button>
        </>
      )}
      {!isFounder && !st.muted && (
        <>
          <div class="chipgroup-label">Gruppe entscheiden lassen</div>
          <p class="tiny muted" style={{ margin: 0 }}>
            Angenommen mit ⅔ der Stimmen nach 48 Std. (mind. 3) – oder sofort, wenn ⅔ aller Mitglieder zustimmen.
          </p>
          <button class="btn" onClick={() => setStep('vote-mute')}>
            🗳️ Abstimmen: stummschalten
          </button>
          <button
            class="btn"
            onClick={async () => {
              if (!confirm(`Abstimmung starten, ob ${m.name} die Gruppe verlassen muss?`)) return
              await startVote(rt, { kind: 'remove', target: id })
              done('🗳️ Abstimmung gestartet')
            }}
          >
            🗳️ Abstimmen: entfernen
          </button>
        </>
      )}
      {isFounder && <p class="small muted">Gegen den Gründer gibt es keine Abstimmungen.</p>}
      <button class="btn ghost" onClick={onClose}>
        Schließen
      </button>
    </div>
  )
}

function remaining(t: number) {
  const h = Math.max(0, Math.round((t - Date.now()) / 3600e3))
  return h >= 1 ? `noch ${h} Std.` : 'endet gleich'
}

export function VoteCard({ rt, snap, v, strainName }: { rt: GroupRuntime; snap: Snapshot; v: VoteResult; strainName: (id: string) => string | undefined }) {
  const me = meSig.value!
  const target = v.target ? memberOf(snap, v.target) : undefined
  const ref = v.ref ? describeRef(snap, v.ref, strainName) : undefined
  const title =
    v.kind === 'remove'
      ? `${target?.name} entfernen`
      : v.kind === 'mute'
        ? `${target?.name} stummschalten (${Math.round((v.duration ?? 0) / 864e5)} Tag${(v.duration ?? 0) > 864e5 ? 'e' : ''})`
        : 'Beitrag ausblenden'
  const need = voteNeeded(v)
  const eligible = v.target !== me.id && snap.approved.has(me.id) && !snap.banned.has(me.id)
  const moved = snap.rekeys.some((r) => r.reason === 'vote:' + v.id)
  return (
    <div class={'card vote ' + v.status}>
      <div class="row between">
        <span class={'badge' + (v.status === 'open' ? ' live' : v.status === 'failed' ? ' gray' : '')}>
          {v.status === 'open' ? `Abstimmung · ${remaining(v.deadline)}` : v.status === 'passed' ? 'Angenommen' : 'Abgelehnt'}
        </span>
        <span class="tiny muted">
          von {memberOf(snap, v.a).name} · {timeAgo(v.t)}
        </span>
      </div>
      <h3 style={{ margin: '0.5rem 0 0.2rem' }}>
        {target && <Avatar emoji={target.avatar} />} {title}
      </h3>
      {ref && <p class="small muted" style={{ margin: 0 }}>{ref.text}</p>}
      <div class="vote-bar mt" aria-label={`${v.yes} Ja, ${v.no} Nein, ${need} nötig`}>
        <i class="yes" style={{ width: `${(v.yes / Math.max(1, v.eligible)) * 100}%` }} />
        <i class="no" style={{ width: `${(v.no / Math.max(1, v.eligible)) * 100}%` }} />
        <b style={{ left: `${(need / Math.max(1, v.eligible)) * 100}%` }} />
      </div>
      <div class="row between tiny muted" style={{ marginTop: 4 }}>
        <span>
          👍 {v.yes} · 👎 {v.no} von {v.eligible}
        </span>
        <span>sofort ab {need} Ja</span>
      </div>
      {v.status === 'open' && eligible && (
        <div class="seg mt">
          <button class={v.myBallot === true ? 'on' : ''} onClick={() => void castBallot(rt, v.id, true)}>
            👍 Ja
          </button>
          <button class={v.myBallot === false ? 'on' : ''} onClick={() => void castBallot(rt, v.id, false)}>
            👎 Nein
          </button>
        </div>
      )}
      {v.status === 'open' && v.target === me.id && <p class="small muted mt" style={{ marginBottom: 0 }}>Diese Abstimmung betrifft dich – du kannst nicht mitstimmen.</p>}
      {v.status === 'passed' && v.kind === 'remove' && !moved && eligible && (
        <button class="btn primary block mt" onClick={() => void executeVote(rt, v)}>
          Umzug in neuen Raum jetzt ausführen
        </button>
      )}
    </div>
  )
}

/** Moderations-Bereich auf der Gruppenseite. */
export function ModerationPanel({ rt, snap, strainName }: { rt: GroupRuntime; snap: Snapshot; strainName: (id: string) => string | undefined }) {
  const me = meSig.value!
  const st = myStatus(snap, me.id)
  const [dismissed, setDismissed] = useState<string[]>(() => JSON.parse(local.get('dismissedReports') || '[]'))
  const pending = [...snap.pending].map((id) => snap.members.get(id)!).filter(Boolean)
  const votes = snap.votes.filter((v) => v.status === 'open' || Date.now() - (v.decidedAt ?? 0) < 7 * 864e5)
  const reports = st.admin ? snap.reports.filter((r) => !dismissed.includes(r.id) && !snap.hidden.has(refKey(r.ref))) : []
  const dismiss = (id: string) => {
    const n = [...dismissed, id]
    setDismissed(n)
    local.set('dismissedReports', JSON.stringify(n.slice(-300)))
  }
  return (
    <>
      {pending.length > 0 && (
        <div class="section">
          <h3>Wartebereich</h3>
          <div class="card">
            <p class="small muted">
              Diese Personen sind mit dem Passwort beigetreten. Ihre Beiträge sieht erst jemand, wenn ihr sie freigebt. Ablehnen lässt die Gruppe in einen neuen Raum umziehen.
            </p>
            {pending.map((m) => (
              <div class="row" style={{ padding: '6px 0' }}>
                <Avatar emoji={m.avatar} />
                <b class="grow">{m.name}</b>
                {!st.pending && !st.banned && (
                  <>
                    <button class="btn sm primary" onClick={() => void approveMember(rt, m.id).then(() => toast(`${m.name} ist drin 🎉`))}>
                      Freigeben
                    </button>
                    <button
                      class="btn sm danger"
                      onClick={() => confirm(`${m.name} ablehnen? Die Gruppe bekommt dafür neue Zugangsdaten.`) && void rejectPending(rt, m.id).then(() => toast('Abgelehnt'))}
                    >
                      Ablehnen
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {votes.length > 0 && (
        <div class="section">
          <h3>Abstimmungen</h3>
          <div class="list">
            {votes.map((v) => (
              <VoteCard rt={rt} snap={snap} v={v} strainName={strainName} />
            ))}
          </div>
        </div>
      )}

      {reports.length > 0 && (
        <div class="section">
          <h3>Meldungen</h3>
          <div class="list">
            {reports.map((r) => {
              const ref = describeRef(snap, r.ref, strainName)
              const author = ref ? memberOf(snap, ref.author) : undefined
              return (
                <div class="card">
                  <div class="row between">
                    <span class="badge">🚩 {r.reason}</span>
                    <span class="tiny muted">
                      von {memberOf(snap, r.a).name} · {timeAgo(r.t)}
                    </span>
                  </div>
                  <p class="small mt">
                    {author && (
                      <>
                        <b>{author.name}</b>:{' '}
                      </>
                    )}
                    {ref?.text ?? 'Inhalt nicht mehr vorhanden'}
                  </p>
                  <div class="row wrap">
                    <button class="btn sm" onClick={() => void moderate(rt, { action: 'hide', ref: r.ref, reason: r.reason }).then(() => toast('Ausgeblendet'))}>
                      🙈 Ausblenden
                    </button>
                    {ref && ref.author !== snap.founder && ref.author !== me.id && (
                      <button class="btn sm" onClick={() => void moderate(rt, { action: 'mute', target: ref.author, until: Date.now() + 864e5 }).then(() => toast('1 Tag stumm'))}>
                        🔇 Autor 1 Tag stumm
                      </button>
                    )}
                    <button class="btn sm ghost" onClick={() => dismiss(r.id)}>
                      Erledigt
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

/** Anzahl offener Dinge, um die ich mich kümmern sollte (Punkt am Gruppen-Knopf). */
export function attentionCount(snap: Snapshot, meId: string) {
  if (!snap.approved.has(meId)) return 0
  const dismissed: string[] = JSON.parse(local.get('dismissedReports') || '[]')
  const votes = snap.votes.filter((v) => v.status === 'open' && v.myBallot === undefined && v.target !== meId).length
  const reports = snap.admins.has(meId) ? snap.reports.filter((r) => !dismissed.includes(r.id) && !snap.hidden.has(refKey(r.ref))).length : 0
  return snap.pending.size + votes + reports
}
