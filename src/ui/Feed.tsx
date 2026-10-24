import { useState } from 'preact/hooks'
import { me as meSig, pPhotos, pPrivate, type GroupRuntime } from '../lib/app'
import { randomId } from '../lib/crypto'
import { photoUrl } from '../lib/image'
import { ownKey, type Snapshot } from '../lib/model'
import { ALL_EFFECTS, AROMAS, FORMS, REACTIONS, SOURCES, opt } from '../lib/taxonomy'
import { Avatar, Empty, Icon, MiniStars, fmtDate, go, strainIcon, timeAgo } from './kit'
import { memberOf, onlineMembers, openSessions, useData, type ViewRating } from './data'

export function Feed() {
  const d = useData()
  const [filter, setFilter] = useState<'all' | 'mine'>('all')
  if (!d.rt && !d.priv.length)
    return (
      <div class="content">
        <h1>Willkommen, {d.profile.name}</h1>
        <div class="card stack">
          <h3>Noch keine Gruppe</h3>
          <p class="muted">Gründe eine Gruppe für deinen Freundeskreis oder Verein – oder tritt mit Name und Passwort einer bestehenden bei.</p>
          <button class="btn primary" onClick={() => go('/group')}>
            Gruppe gründen oder beitreten
          </button>
        </div>
        <div class="card flat stack">
          <h3>Oder erstmal allein starten</h3>
          <p class="muted small">Bewertungen kannst du auch privat anlegen und später teilen.</p>
          <button class="btn" onClick={() => go('/rate')}>
            Erste Sorte bewerten
          </button>
        </div>
      </div>
    )

  const online = onlineMembers(d.rt)
  const items: ViewRating[] = (filter === 'mine' ? d.mine : [...d.group, ...d.priv]).sort((a, b) => b.t - a.t)
  const newStrains = d.snap.strains.filter((s) => Date.now() - s.t < 14 * 864e5).sort((a, b) => b.t - a.t)
  const live = openSessions(d.sessions)
  return (
    <div class="content">
      <div class="row between mb">
        <h1 style={{ margin: 0 }}>{d.rt?.entry.name ?? 'Meine Notizen'}</h1>
        <div class="seg" style={{ width: 170 }}>
          <button class={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
            Alle
          </button>
          <button class={filter === 'mine' ? 'on' : ''} onClick={() => setFilter('mine')}>
            Meine
          </button>
        </div>
      </div>

      {live.map((s) => {
        const st = d.strainMap.get(s.strainId)
        return (
          <a class="card link mb" href={`#/session/${encodeURIComponent(s.id)}`} style={{ borderColor: 'var(--accent)' }}>
            <div class="row">
              <span style={{ fontSize: '1.6rem' }}>🍷</span>
              <div class="grow">
                <b>Live-Tasting läuft</b>
                <div class="small muted">
                  {st?.name ?? 'Unbekannte Sorte'} · gestartet von {memberOf(d.snap, s.a).name}
                </div>
              </div>
              <span class="badge">Mitmachen</span>
            </div>
          </a>
        )
      })}

      {d.rt && online.size > 0 && (
        <div class="row wrap mb small muted">
          Gerade online:
          {[...online].map((id) => {
            const m = memberOf(d.snap, id)
            return (
              <span class="row" style={{ gap: 4 }}>
                <Avatar emoji={m.avatar} online /> {m.name}
              </span>
            )
          })}
        </div>
      )}

      {filter === 'all' && newStrains.length > 0 && (
        <div class="card flat mb">
          <div class="small muted mb" style={{ marginBottom: 6 }}>
            Neu in der Sortenliste
          </div>
          <div class="chips">
            {newStrains.slice(0, 8).map((s) => (
              <a class="chip" href={`#/strain/${encodeURIComponent(s.id)}`} style={{ textDecoration: 'none' }}>
                {strainIcon(s.type)} {s.name}
              </a>
            ))}
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <Empty icon="🌱">
          <p>Hier ist noch nichts los.</p>
          <button class="btn primary" onClick={() => go('/rate')}>
            Erste Bewertung schreiben
          </button>
        </Empty>
      ) : (
        <div class="list">
          {items.map((r) => (
            <RatingCard key={r.id} r={r} rt={d.rt} snap={d.snap} strainName={d.strainMap.get(r.strainId)?.name} strainType={d.strainMap.get(r.strainId)?.type} />
          ))}
        </div>
      )}
    </div>
  )
}

export function RatingCard({
  r,
  rt,
  snap,
  strainName,
  strainType,
  compact,
}: {
  r: ViewRating
  rt: GroupRuntime | null
  snap: Snapshot
  strainName?: string
  strainType?: string
  compact?: boolean
}) {
  const me = meSig.value!
  const { profile } = useData()
  const author = r.private || r.a === me.id ? profile : memberOf(snap, r.a)
  const photoBytes = r.photo ? (r.private ? pPhotos.get(r.photo.id) : rt?.model.photos.get(r.photo.id)) : undefined
  const effects = Object.entries(r.effects).sort((a, b) => b[1] - a[1])
  const aromas = [...new Set([...r.aromas, ...r.tastes])]
  const src = opt(SOURCES, r.source)
  const form = opt(FORMS, r.form)
  return (
    <article class="card feed-item">
      <div class="head">
        <Avatar emoji={author.avatar} />
        <div class="grow">
          <div>
            <b>{author.name}</b>
            {strainName && (
              <>
                {' '}
                <span class="muted">über</span>{' '}
                <a href={`#/strain/${encodeURIComponent(r.strainId)}`}>
                  {strainType && strainIcon(strainType)} {strainName}
                </a>
              </>
            )}
          </div>
          <div class="tiny muted">
            {fmtDate(r.date)} · {timeAgo(r.t)}
            {r.private && (
              <>
                {' '}
                · <span class="badge gray">🙈 privat</span>
              </>
            )}
            {r.sessionId && (
              <>
                {' '}
                · <span class="badge">🍷 Tasting</span>
              </>
            )}
          </div>
        </div>
        {r.a === me.id && (
          <button class="iconbtn" aria-label="Bearbeiten" onClick={() => go(`/rate?edit=${encodeURIComponent(r.id)}${r.private ? '&p=1' : ''}`)}>
            <Icon name="edit" />
          </button>
        )}
      </div>
      <div class="row between">
        <MiniStars value={r.overall} />
        {r.again !== undefined && <span class="small muted">{r.again ? '🔁 Gerne wieder' : '🚫 Eher nicht wieder'}</span>}
      </div>
      {photoBytes && <img class="photo mt" src={photoUrl(photoBytes)} alt={`Foto von ${strainName ?? 'der Sorte'}`} loading="lazy" />}
      {(aromas.length > 0 || effects.length > 0) && (
        <div class="chips mt">
          {aromas.slice(0, compact ? 4 : 8).map((a) => {
            const o = opt(AROMAS, a)
            return (
              <span class="chip static">
                {o?.icon} {o?.label ?? a}
              </span>
            )
          })}
          {effects.slice(0, compact ? 3 : 6).map(([e, v]) => {
            const o = opt(ALL_EFFECTS, e)
            return (
              <span class="chip static" style={{ background: 'var(--accent-soft)' }}>
                {o?.icon} {o?.label ?? e}
                <span class="lvl">
                  {[1, 2, 3].map((i) => (
                    <i class={i <= v ? 'f' : ''} />
                  ))}
                </span>
              </span>
            )
          })}
        </div>
      )}
      {r.note && <p class="mt" style={{ marginBottom: 0 }}>“{r.note}”</p>}
      {!compact && (src || form || r.batch) && (
        <div class="tiny muted mt">
          {[src && `${src.icon} ${src.label}`, r.batch && `Charge ${r.batch}`, form && `${form.icon} ${form.label}${r.vapeTemp ? ` · ${r.vapeTemp} °C` : ''}`]
            .filter(Boolean)
            .join(' · ')}
        </div>
      )}
      {!r.private && rt && <Social r={r} rt={rt} snap={snap} />}
    </article>
  )
}

function Social({ r, rt, snap }: { r: ViewRating; rt: GroupRuntime; snap: Snapshot }) {
  const me = meSig.value!
  const [text, setText] = useState('')
  const [all, setAll] = useState(false)
  const reacts = snap.reactions.filter((x) => x.on === r.id)
  const comments = snap.comments.filter((c) => c.on === r.id)
  const shown = all ? comments : comments.slice(-2)
  const counts = new Map<string, { n: number; mine: boolean; who: string[] }>()
  for (const x of reacts) {
    const c = counts.get(x.e) ?? { n: 0, mine: false, who: [] }
    c.n++
    c.who.push(memberOf(snap, x.a).name)
    if (x.a === me.id) c.mine = true
    counts.set(x.e, c)
  }
  const toggle = (e: string) => {
    const c = counts.get(e)
    void rt.model.put(me, 'reactions', `${ownKey(me.id)}${r.id}~${e}`, { on: r.id, e, active: !c?.mine, t: Date.now() })
  }
  const send = () => {
    const t = text.trim()
    if (!t) return
    const id = ownKey(me.id) + randomId()
    void rt.model.put(me, 'comments', id, { id, on: r.id, text: t.slice(0, 280), t: Date.now() })
    setText('')
  }
  return (
    <div>
      <div class="reactions">
        {REACTIONS.map((e) => {
          const c = counts.get(e)
          return (
            <button class={'reaction' + (c?.mine ? ' on' : '')} onClick={() => toggle(e)} title={c?.who.join(', ')} aria-label={`Reaktion ${e}`}>
              {e}
              {c ? ` ${c.n}` : ''}
            </button>
          )
        })}
      </div>
      {comments.length > 2 && !all && (
        <button class="btn ghost sm mt" onClick={() => setAll(true)}>
          Alle {comments.length} Kommentare
        </button>
      )}
      {shown.map((c) => {
        const m = memberOf(snap, c.a)
        return (
          <div class="comment">
            <Avatar emoji={m.avatar} />
            <div class="grow">
              <b>{m.name}</b> <span class="tiny muted">{timeAgo(c.t)}</span>
              <div>{c.text}</div>
            </div>
            {c.a === me.id && (
              <button class="iconbtn" style={{ width: 28, height: 28 }} aria-label="Kommentar löschen" onClick={() => void rt.model.put(me, 'comments', c.id, { id: c.id, on: c.on, text: '', t: c.t, deleted: true })}>
                <Icon name="trash" />
              </button>
            )}
          </div>
        )
      })}
      <form
        class="row mt"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <input class="input" style={{ minHeight: 36 }} placeholder="Kurzer Kommentar …" value={text} maxLength={280} onInput={(e) => setText((e.target as HTMLInputElement).value)} />
        <button class="btn sm" disabled={!text.trim()}>
          Senden
        </button>
      </form>
    </div>
  )
}

export function deletePrivateRating(id: string) {
  const r = pPrivate.get(id)
  if (r) pPrivate.set(id, { ...r, deleted: true })
}
