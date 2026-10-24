// Treffen: Tasting-Abende vorschlagen, zu-/absagen, Sorten planen, Mitbring-Liste.
import { useState } from 'preact/hooks'
import { activeGroup, addBring, allStrains, me as meSig, removeBring, rsvp, saveEvent, type GroupRuntime } from '../lib/app'
import { randomId } from '../lib/crypto'
import { confetti } from '../lib/confetti'
import { ownKey, type Authored, type EventData, type RsvpData, type Snapshot } from '../lib/model'
import { discreet } from '../lib/prefs'
import { Art, Avatar, ChipArt, Empty, Icon, PageHead, back, go, route, timeAgo, toast } from './kit'
import { ContentMenu, HiddenNote } from './Moderation'
import { memberOf, myStatus, openSessions, upcomingEvents, useData } from './data'

const RSVP: [RsvpData['status'], string, string][] = [
  ['yes', 'Dabei', '🙌'],
  ['maybe', 'Vielleicht', '🤔'],
  ['no', 'Absage', '🙅'],
]

const fmtDay = (t: number) => new Date(t).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
const fmtTime = (t: number) => new Date(t).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

function countdown(t: number) {
  const d = t - Date.now()
  if (d < -3 * 3600e3) return 'vorbei'
  if (d < 0) return 'läuft gerade'
  const h = Math.round(d / 3600e3)
  if (h < 1) return 'gleich'
  if (h < 24) return `in ${h} Std.`
  const days = Math.round(d / 864e5)
  return days === 1 ? 'morgen' : `in ${days} Tagen`
}

export function rsvpsFor(snap: Snapshot, ev: string) {
  const out = { yes: [] as string[], maybe: [] as string[], no: [] as string[] }
  for (const r of snap.rsvps) if (r.event === ev) out[r.status].push(r.a)
  return out
}

/** Kalenderblatt mit Tag und Monat. */
function DateBlock({ t, cancelled }: { t: number; cancelled?: boolean }) {
  const d = new Date(t)
  return (
    <div class={'dateblock' + (cancelled ? ' off' : '')}>
      <span class="m">{d.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '')}</span>
      <span class="d">{d.getDate()}</span>
      <span class="w">{d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')}</span>
    </div>
  )
}

function RsvpButtons({ rt, ev, mine, disabled }: { rt: GroupRuntime; ev: string; mine?: RsvpData['status']; disabled?: boolean }) {
  return (
    <div class="seg rsvp">
      {RSVP.map(([s, l, e]) => (
        <button
          class={mine === s ? 'on ' + s : ''}
          disabled={disabled}
          onClick={() => {
            void rsvp(rt, ev, s)
            if (s === 'yes' && mine !== 'yes') confetti({ count: 50, origin: { x: 0.5, y: 0.6 } })
          }}
        >
          <span class="e">{e}</span>
          <span>{l}</span>
        </button>
      ))}
    </div>
  )
}

export function EventCard({ ev, rt, snap, compact }: { ev: Authored<EventData>; rt: GroupRuntime; snap: Snapshot; compact?: boolean }) {
  const me = meSig.value!
  const r = rsvpsFor(snap, ev.id)
  const mine = snap.rsvps.find((x) => x.event === ev.id && x.a === me.id)?.status
  const cancelled = ev.status === 'cancelled'
  const status = myStatus(snap, me.id)
  return (
    <div class={'card event-card' + (cancelled ? ' cancelled' : '')}>
      <a class="event-head" href={`#/event/${encodeURIComponent(ev.id)}`}>
        <DateBlock t={ev.start} cancelled={cancelled} />
        <div class="grow">
          <span class="eyebrow">{cancelled ? 'Abgesagt' : countdown(ev.start)}</span>
          <h3 style={{ margin: '0.15rem 0' }}>{ev.title}</h3>
          <div class="small muted">
            {fmtTime(ev.start)} Uhr · {ev.place}
          </div>
        </div>
      </a>
      {!compact && ev.strains.length > 0 && (
        <div class="chips mt">
          {ev.strains.slice(0, 4).map((id) => {
            const s = findStrainIn(id)
            return s ? (
              <span class="chip static">
                <ChipArt s={s} /> {s.name}
              </span>
            ) : null
          })}
        </div>
      )}
      <div class="row between mt wrap">
        <div class="row" style={{ gap: 8 }}>
          <div class="avatar-stack">
            {r.yes.slice(0, 6).map((a) => (
              <Avatar emoji={memberOf(snap, a).avatar} />
            ))}
          </div>
          <span class="small muted">
            {r.yes.length} dabei{r.maybe.length ? ` · ${r.maybe.length} vielleicht` : ''}
          </span>
        </div>
      </div>
      {!cancelled && (
        <div class="mt">
          <RsvpButtons rt={rt} ev={ev.id} mine={mine} disabled={status.muted || status.banned} />
        </div>
      )}
    </div>
  )
}

// Sortennamen ohne Hook nachschlagen (für Karten in Listen)
const findStrainIn = (id: string) => allStrains(activeGroup.peek()).find((s) => s.id === id)

/** Übersicht: kommende Treffen und laufende Tastings. */
export function EventsPage() {
  const d = useData()
  if (!d.rt)
    return (
      <div class="content">
        <PageHead title="Treffen" />
        <Empty icon="🗓️">
          <p>Treffen und Tastings brauchen eine Gruppe.</p>
          <button class="btn primary" onClick={() => go('/group')}>
            Gruppe gründen oder beitreten
          </button>
        </Empty>
      </div>
    )
  const upcoming = upcomingEvents(d.snap)
  const past = d.snap.events.filter((e) => !upcoming.includes(e)).reverse()
  const live = openSessions(d.sessions)
  const status = myStatus(d.snap, d.me.id)
  return (
    <div class="content">
      <div class="section-head">
        <div>
          <span class="eyebrow">Gemeinsam genießen</span>
          <h1 style={{ margin: '0.15rem 0 0' }}>Treffen</h1>
        </div>
        <button class="btn sm primary" disabled={status.muted || status.banned} onClick={() => go('/event-new')}>
          <Icon name="plus" /> Vorschlagen
        </button>
      </div>

      {live.length > 0 && (
        <div class="list mb">
          {live.map((s) => {
            const st = d.strainMap.get(s.strainId)
            return (
              <a class="card link live-card" href={`#/session/${encodeURIComponent(s.id)}`}>
                <div class="row">
                  {st && <Art s={st} size="md" />}
                  <div class="grow">
                    <span class="badge live">Live-Tasting</span>
                    <h3 style={{ margin: '0.35rem 0 0.1rem' }}>{st?.name}</h3>
                    <div class="small muted">von {memberOf(d.snap, s.a).name}</div>
                  </div>
                  <span class="btn sm primary">Mitmachen</span>
                </div>
              </a>
            )
          })}
        </div>
      )}

      {upcoming.length === 0 ? (
        <div class="card center stack" style={{ padding: '2rem 1rem' }}>
          <div style={{ fontSize: '2.4rem' }}>🗓️</div>
          <h3 style={{ margin: 0 }}>Noch kein Treffen geplant</h3>
          <p class="muted small" style={{ margin: 0 }}>
            Schlag einen Tasting-Abend vor – mit Ort, Zeit und den Sorten, die ihr probieren wollt.
          </p>
          <button class="btn primary" style={{ alignSelf: 'center' }} disabled={status.muted || status.banned} onClick={() => go('/event-new')}>
            Treffen vorschlagen
          </button>
        </div>
      ) : (
        <div class="list">
          {upcoming.map((ev, i) => (
            <div style={{ '--i': i }}>
              <EventCard ev={ev} rt={d.rt!} snap={d.snap} />
            </div>
          ))}
        </div>
      )}

      <div class="section">
        <div class="section-head">
          <h3>Spontanes Live-Tasting</h3>
          <a class="btn sm" href="#/sessions">
            🍷 Starten
          </a>
        </div>
        <p class="small muted">Alle bewerten dieselbe Sorte verdeckt, der Host deckt am Ende auf.</p>
      </div>

      {past.length > 0 && (
        <div class="section">
          <h3>Vergangene Treffen</h3>
          <div class="list">
            {past.slice(0, 10).map((ev) => (
              <a class="card link row" href={`#/event/${encodeURIComponent(ev.id)}`}>
                <DateBlock t={ev.start} cancelled={ev.status === 'cancelled'} />
                <div class="grow">
                  <b>{ev.title}</b>
                  <div class="tiny muted">{ev.place}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function toLocalInput(t: number) {
  const d = new Date(t - new Date(t).getTimezoneOffset() * 60e3)
  return d.toISOString().slice(0, 16)
}

export function EventForm() {
  const d = useData()
  const editId = route.value.q.get('edit')
  const existing = editId ? d.snap.events.find((e) => e.id === editId && e.a === d.me.id) : undefined
  const preset = (() => {
    const t = new Date()
    t.setDate(t.getDate() + ((5 - t.getDay() + 7) % 7 || 7)) // nächster Freitag
    t.setHours(19, 30, 0, 0)
    return t.getTime()
  })()
  const [title, setTitle] = useState(existing?.title ?? 'Tasting-Abend')
  const [when, setWhen] = useState(toLocalInput(existing?.start ?? preset))
  const [place, setPlace] = useState(existing?.place ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [strains, setStrains] = useState<string[]>(existing?.strains ?? [])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  if (!d.rt) return null
  const ql = q.trim().toLowerCase()
  const options = d.strains.filter((s) => !strains.includes(s.id) && (!ql || s.name.toLowerCase().includes(ql))).slice(0, ql ? 20 : 12)
  const start = new Date(when).getTime()
  const valid = title.trim() && place.trim() && !Number.isNaN(start)
  return (
    <div class="content">
      <PageHead title={existing ? 'Treffen bearbeiten' : 'Treffen vorschlagen'} backTo />
      <div class="stack">
        <label class="field">
          <span>Titel</span>
          <input class="input" value={title} maxLength={60} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} />
        </label>
        <label class="field">
          <span>Wann</span>
          <input class="input" type="datetime-local" value={when} onInput={(e) => setWhen((e.target as HTMLInputElement).value)} />
        </label>
        <label class="field">
          <span>Wo</span>
          <input class="input" value={place} maxLength={120} placeholder="z. B. bei Mia, Vereinsheim, Link zur Karte …" onInput={(e) => setPlace((e.target as HTMLInputElement).value)} />
        </label>
        <label class="field">
          <span>Notiz (optional)</span>
          <textarea class="input" value={note} maxLength={400} placeholder="Bringt eure Vaporizer mit …" onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)} />
        </label>
        <div class="card flat">
          <div class="chipgroup-label" style={{ marginTop: 0 }}>
            Geplante Sorten
          </div>
          {strains.length > 0 && (
            <div class="chips mb">
              {strains.map((id) => {
                const s = d.strainMap.get(id)
                return (
                  <button class="chip on" onClick={() => setStrains(strains.filter((x) => x !== id))} aria-label={`${s?.name} entfernen`}>
                    {s && <ChipArt s={s} />} {s?.name ?? id} ×
                  </button>
                )
              })}
            </div>
          )}
          <input class="input mb" type="search" placeholder="Sorte hinzufügen …" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
          <div class="chips">
            {options.map((s) => (
              <button class="chip" onClick={() => setStrains([...strains, s.id])}>
                <ChipArt s={s} /> {s.name}
              </button>
            ))}
          </div>
        </div>
        <button
          class="btn primary"
          disabled={!valid || busy}
          onClick={async () => {
            setBusy(true)
            const id = await saveEvent(d.rt!, {
              id: existing?.id,
              title: title.trim(),
              start,
              place: place.trim(),
              note: note.trim() || undefined,
              strains,
              status: existing?.status ?? 'planned',
            })
            if (!existing) confetti()
            toast(existing ? 'Treffen aktualisiert' : '🗓️ Treffen vorgeschlagen')
            go(`/event/${encodeURIComponent(id)}`)
          }}
        >
          {existing ? 'Speichern' : 'Vorschlagen'}
        </button>
      </div>
    </div>
  )
}

function icsDate(t: number) {
  return new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}
const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => '\\' + m)

function downloadIcs(ev: EventData) {
  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FlowerPower//DE',
    'BEGIN:VEVENT',
    `UID:${ev.id.replace(/[^\w-]/g, '')}@flowerpower`,
    `DTSTAMP:${icsDate(Date.now())}`,
    `DTSTART:${icsDate(ev.start)}`,
    `DTEND:${icsDate(ev.start + 3 * 3600e3)}`,
    `SUMMARY:${icsText(discreet.peek() ? 'Treffen' : ev.title)}`,
    `LOCATION:${icsText(ev.place)}`,
    ...(ev.note && !discreet.peek() ? [`DESCRIPTION:${icsText(ev.note)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }))
  a.download = 'treffen.ics'
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

export function EventDetail({ id }: { id: string }) {
  const d = useData()
  const [bring, setBring] = useState('')
  const [bringStrain, setBringStrain] = useState<string | undefined>()
  if (!d.rt) return null
  const ev = d.snap.events.find((e) => e.id === id)
  if (!ev)
    return (
      <div class="content">
        <PageHead title="Treffen" backTo />
        <Empty icon="🌫️">Dieses Treffen ist (noch) nicht da – vielleicht synchronisiert es gerade.</Empty>
      </div>
    )
  const me = d.me
  const rt = d.rt
  const r = rsvpsFor(d.snap, id)
  const mine = d.snap.rsvps.find((x) => x.event === id && x.a === me.id)?.status
  const brings = d.snap.brings.filter((b) => b.event === id)
  const isAuthor = ev.a === me.id
  const status = myStatus(d.snap, me.id)
  const cancelled = ev.status === 'cancelled'
  const sessions = d.snap.sessions.filter((s) => s.eventId === id)
  const startTasting = async (strainId: string) => {
    const existing = sessions.find((s) => s.strainId === strainId && s.status === 'open')
    if (existing) return go(`/session/${encodeURIComponent(existing.id)}`)
    const sid = ownKey(me.id) + randomId()
    await rt.model.put(me, 'sessions', sid, { id: sid, strainId, eventId: id, t: Date.now(), status: 'open' })
    toast('🍷 Tasting gestartet')
    go(`/session/${encodeURIComponent(sid)}`)
  }
  return (
    <div class="content">
      <div class={'event-hero' + (cancelled ? ' cancelled' : '')}>
        <div class="hero-top">
          <button class="glassbtn" aria-label="Zurück" onClick={back}>
            <Icon name="back" />
          </button>
          <ContentMenu rt={rt} snap={d.snap} refv={{ map: 'events', id }} author={ev.a} glass />
        </div>
        <DateBlock t={ev.start} cancelled={cancelled} />
        <div>
          <span class="eyebrow">{cancelled ? 'Abgesagt' : countdown(ev.start)}</span>
          <h1 style={{ margin: '0.2rem 0' }}>{ev.title}</h1>
          <div class="muted">
            {fmtDay(ev.start)} · {fmtTime(ev.start)} Uhr
          </div>
          <div class="row mt" style={{ gap: 6 }}>
            📍 {/^https?:\/\//.test(ev.place) ? <a href={ev.place} target="_blank" rel="noopener noreferrer">Ort öffnen</a> : <span>{ev.place}</span>}
          </div>
          <div class="tiny muted mt">
            Vorgeschlagen von {memberOf(d.snap, ev.a).name} · {timeAgo(ev.t)}
          </div>
        </div>
      </div>
      <HiddenNote snap={d.snap} refv={{ map: 'events', id }} />

      {ev.note && <p class="quote">{ev.note}</p>}

      {!cancelled && (
        <div class="card mt">
          <div class="chipgroup-label" style={{ marginTop: 0 }}>
            Bist du dabei?
          </div>
          <RsvpButtons rt={rt} ev={id} mine={mine} disabled={status.muted || status.banned} />
          <div class="row mt wrap" style={{ gap: 8 }}>
            <button class="btn sm" onClick={() => downloadIcs(ev)}>
              🗓️ In den Kalender
            </button>
            {isAuthor && (
              <>
                <button class="btn sm ghost" onClick={() => go(`/event-new?edit=${encodeURIComponent(id)}`)}>
                  <Icon name="edit" /> Bearbeiten
                </button>
                <button
                  class="btn sm danger"
                  onClick={() => confirm('Treffen absagen?') && void saveEvent(rt, { ...ev, status: 'cancelled' })}
                >
                  Absagen
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {cancelled && isAuthor && (
        <button class="btn mt" onClick={() => void saveEvent(rt, { ...ev, status: 'planned' })}>
          Doch stattfinden lassen
        </button>
      )}

      <div class="section">
        <h3>Wer kommt</h3>
        <div class="card">
          {RSVP.map(([s, l, e]) =>
            r[s].length ? (
              <div class="row wrap" style={{ padding: '4px 0' }}>
                <span class="small muted" style={{ width: 96 }}>
                  {e} {l}
                </span>
                {r[s].map((a) => {
                  const m = memberOf(d.snap, a)
                  return (
                    <span class="chip static">
                      {m.avatar} {m.name}
                    </span>
                  )
                })}
              </div>
            ) : null,
          )}
          {!r.yes.length && !r.maybe.length && !r.no.length && <p class="muted small" style={{ margin: 0 }}>Noch keine Antworten.</p>}
        </div>
      </div>

      {ev.strains.length > 0 && (
        <div class="section">
          <h3>Auf der Karte</h3>
          <div class="list">
            {ev.strains.map((sid) => {
              const s = d.strainMap.get(sid)
              if (!s) return null
              const sess = sessions.find((x) => x.strainId === sid)
              return (
                <div class="card row">
                  <a href={`#/strain/${encodeURIComponent(sid)}`}>
                    <Art s={s} size="md" />
                  </a>
                  <div class="grow">
                    <b>{s.name}</b>
                    {sess && <div class="tiny muted">{sess.status === 'open' ? '🍷 Tasting läuft' : '🎉 aufgedeckt'}</div>}
                  </div>
                  <button class={'btn sm' + (sess?.status === 'open' ? ' primary' : '')} disabled={status.muted || status.banned} onClick={() => void startTasting(sid)}>
                    {sess ? (sess.status === 'open' ? 'Zum Tasting' : 'Ergebnis') : '🍷 Tasting'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div class="section">
        <h3>Wer bringt was mit</h3>
        <div class="card">
          {brings.length === 0 && <p class="muted small">Noch nichts eingetragen.</p>}
          {brings.map((b) => {
            const m = memberOf(d.snap, b.a)
            const s = b.strainId ? d.strainMap.get(b.strainId) : undefined
            return (
              <div class="row" style={{ padding: '5px 0' }}>
                <Avatar emoji={m.avatar} />
                <div class="grow">
                  <span class="small muted">{m.name}</span>
                  <div class="row" style={{ gap: 6 }}>
                    {s && <ChipArt s={s} />} {b.text}
                  </div>
                </div>
                {b.a === me.id && (
                  <button class="iconbtn" aria-label="Entfernen" onClick={() => void removeBring(rt, b)}>
                    <Icon name="trash" />
                  </button>
                )}
              </div>
            )
          })}
          {!status.muted && !status.banned && !cancelled && (
            <>
              <div class="chips mt">
                {['🌿 Eigene Sorte', '♨️ Vaporizer', '🍿 Snacks', '🥤 Getränke', '🎵 Musik'].map((x) => (
                  <button class={'chip' + (bring === x ? ' on' : '')} onClick={() => setBring(x)}>
                    {x}
                  </button>
                ))}
              </div>
              {bring === '🌿 Eigene Sorte' && (
                <select class="input mt" value={bringStrain ?? ''} onChange={(e) => setBringStrain((e.target as HTMLSelectElement).value || undefined)}>
                  <option value="">Welche Sorte?</option>
                  {d.strains.map((s) => (
                    <option value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
              <form
                class="row mt"
                onSubmit={(e) => {
                  e.preventDefault()
                  const t = bring.trim()
                  if (!t) return
                  void addBring(rt, id, bringStrain ? `${t.replace('🌿 Eigene Sorte', '🌿')} ${d.strainMap.get(bringStrain)?.name ?? ''}`.trim() : t, bringStrain)
                  setBring('')
                  setBringStrain(undefined)
                }}
              >
                <input class="input" placeholder="Oder selbst eintragen …" value={bring} maxLength={80} onInput={(e) => setBring((e.target as HTMLInputElement).value)} />
                <button class="btn sm primary" disabled={!bring.trim()}>
                  Eintragen
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
