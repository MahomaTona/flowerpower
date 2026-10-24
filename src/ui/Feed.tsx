import { useState } from 'preact/hooks'
import { me as meSig, pPhotos, pPrivate, type GroupRuntime } from '../lib/app'
import { randomId } from '../lib/crypto'
import { photoUrl } from '../lib/image'
import { ownKey, type Snapshot, type StrainData } from '../lib/model'
import { byStrain, statsFor } from '../lib/insights'
import { renderShareCard, shareOrDownload } from '../lib/sharecard'
import { discreet } from '../lib/prefs'
import { STARTER_STRAINS } from '../lib/strains'
import { ALL_EFFECTS, AROMAS, FORMS, REACTIONS, SOURCES, STRAIN_TYPES, opt, optLabel } from '../lib/taxonomy'
import { Art, Avatar, Empty, Icon, MiniStars, Score, Skeleton, TerpDots, fmtDate, go, timeAgo, toast } from './kit'
import { memberOf, onlineMembers, openSessions, useData, type ViewRating } from './data'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Gute Nacht'
  if (h < 11) return 'Guten Morgen'
  if (h < 17) return 'Hallo'
  if (h < 22) return 'Guten Abend'
  return 'Gute Nacht'
}

const WEEK = 7 * 864e5

export function Feed() {
  const d = useData()
  const [filter, setFilter] = useState<'all' | 'mine'>('all')
  const today = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
  const head = (
    <div class="greet">
      <h1>
        {greeting()}, <em>{d.profile.name}</em>
      </h1>
      <div class="date">{today}</div>
    </div>
  )

  if (!d.rt && !d.priv.length)
    return (
      <div class="content">
        {head}
        <div class="overview">
          <div class="card stack">
            <span class="eyebrow">Gemeinsam genießen</span>
            <h2 style={{ margin: 0 }}>Gründe deine Runde</h2>
            <p class="muted" style={{ margin: 0 }}>
              Lade Freunde oder deinen Verein ein – oder tritt mit Name und Passwort einer bestehenden Gruppe bei.
            </p>
            <button class="btn primary" onClick={() => go('/group')}>
              Gruppe gründen oder beitreten
            </button>
          </div>
          <div class="card flat stack">
            <span class="eyebrow">Erstmal für dich</span>
            <h2 style={{ margin: 0 }}>Erste Notiz</h2>
            <p class="muted small" style={{ margin: 0 }}>
              Bewertungen kannst du auch privat anlegen und später teilen.
            </p>
            <button class="btn" onClick={() => go('/rate')}>
              Sorte bewerten
            </button>
          </div>
        </div>
        <Discover strains={d.strains} />
      </div>
    )

  const online = onlineMembers(d.rt)
  const items: ViewRating[] = (filter === 'mine' ? d.mine : [...d.group, ...d.priv]).sort((a, b) => b.t - a.t)
  const live = openSessions(d.sessions)
  const waiting = !!d.rt && !d.snap.info && d.rt.entry.founder !== d.me.id && d.group.length === 0
  const now = Date.now()
  const weekRatings = d.group.filter((r) => now - r.t < WEEK)
  const spotlight = pickSpotlight(weekRatings.length ? weekRatings : d.group, d.strainMap, weekRatings.length > 0)
  const members = [...d.snap.members.values()].filter((m) => !d.snap.banned.has(m.id))
  const tried = new Set(d.group.map((r) => r.strainId)).size

  return (
    <div class="content">
      {head}

      {live.map((s) => {
        const st = d.strainMap.get(s.strainId)
        return (
          <a class="card link live-card mb" href={`#/session/${encodeURIComponent(s.id)}`}>
            <div class="row">
              {st && <Art s={st} size="md" />}
              <div class="grow">
                <span class="badge live">Live-Tasting</span>
                <h3 style={{ margin: '0.35rem 0 0.1rem' }}>{st?.name ?? 'Unbekannte Sorte'}</h3>
                <div class="small muted">gestartet von {memberOf(d.snap, s.a).name}</div>
              </div>
              <span class="btn sm primary">Mitmachen</span>
            </div>
          </a>
        )
      })}

      {d.rt && (
        <div class="overview mb">
          {spotlight ? (
            <a class="card link spotlight" href={`#/strain/${encodeURIComponent(spotlight.strain.id)}`}>
              <Art s={spotlight.strain} />
              <div>
                <span class="eyebrow">{spotlight.label}</span>
                <h2>{spotlight.strain.name}</h2>
                <div class="row small muted" style={{ gap: 6 }}>
                  <TerpDots s={spotlight.strain} /> {optLabel(STRAIN_TYPES, spotlight.strain.type)}
                </div>
                {spotlight.avg > 0 && (
                  <div class="row mt" style={{ gap: 8 }}>
                    <Score value={spotlight.avg} />
                    <span class="tiny muted">aus {spotlight.n}</span>
                  </div>
                )}
              </div>
            </a>
          ) : (
            <Discover strains={d.strains} inline />
          )}
          <a class="card link stack" href="#/group" style={{ gap: '0.8rem' }}>
            <div class="row between">
              <div>
                <span class="eyebrow">Deine Gruppe</span>
                <h3 style={{ margin: '0.2rem 0 0' }}>{d.rt.entry.name}</h3>
              </div>
              <span class={'online' + (online.size ? ' on' : '')}>
                <i /> {online.size ? `${online.size} online` : 'offline'}
              </span>
            </div>
            <div class="avatar-stack">
              {members.slice(0, 7).map((m) => (
                <Avatar emoji={m.avatar} online={online.has(m.id)} />
              ))}
            </div>
            <div class="stat-tiles">
              <div class="stat">
                <span class="num">{d.group.length}</span>
                <span class="lbl">Notizen</span>
              </div>
              <div class="stat">
                <span class="num">{weekRatings.length}</span>
                <span class="lbl">diese Woche</span>
              </div>
              <div class="stat">
                <span class="num">{tried}</span>
                <span class="lbl">Sorten</span>
              </div>
            </div>
          </a>
        </div>
      )}

      <div class="section-head" style={{ marginTop: '1.6rem' }}>
        <h2>Neueste Notizen</h2>
        <div class="seg" style={{ width: 170 }}>
          <button class={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>
            Alle
          </button>
          <button class={filter === 'mine' ? 'on' : ''} onClick={() => setFilter('mine')}>
            Meine
          </button>
        </div>
      </div>

      {waiting ? (
        <>
          <p class="muted small">Verbinde mit deiner Gruppe … Sobald jemand online ist, erscheinen hier die Notizen.</p>
          <Skeleton rows={2} />
        </>
      ) : items.length === 0 ? (
        <Empty icon="🌱">
          <p>Hier ist noch nichts los.</p>
          <button class="btn primary" onClick={() => go('/rate')}>
            Erste Bewertung schreiben
          </button>
        </Empty>
      ) : (
        <div class="list">
          {items.map((r, i) => (
            <div style={{ '--i': i }} key={r.id}>
              <RatingCard r={r} rt={d.rt} snap={d.snap} strain={d.strainMap.get(r.strainId)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function pickSpotlight(rs: ViewRating[], strains: Map<string, StrainData>, thisWeek: boolean) {
  const by = byStrain(rs)
  let best: { strain: StrainData; avg: number; n: number; label: string } | null = null
  for (const [id, list] of by) {
    const s = strains.get(id)
    if (!s) continue
    const st = statsFor(list)
    const score = st.avg + Math.min(1, st.n / 4) * 0.3
    if (!best || score > best.avg + Math.min(1, best.n / 4) * 0.3)
      best = { strain: s, avg: st.avg, n: st.n, label: thisWeek ? 'Sorte der Woche' : 'Liebling der Gruppe' }
  }
  return best
}

/** Wöchentlich wechselnde Entdeckung aus der Startliste. */
function Discover({ strains, inline }: { strains: StrainData[]; inline?: boolean }) {
  const week = Math.floor(Date.now() / WEEK)
  const pool = strains.length ? strains : STARTER_STRAINS
  const s = pool[week % pool.length]
  const card = (
    <a class="card link spotlight" href={`#/strain/${encodeURIComponent(s.id)}`}>
      <Art s={s} />
      <div>
        <span class="eyebrow">Entdeckung der Woche</span>
        <h2>{s.name}</h2>
        <div class="row small muted" style={{ gap: 6 }}>
          <TerpDots s={s} /> {optLabel(STRAIN_TYPES, s.type)}
        </div>
        {s.lineage && <div class="tiny muted mt">{s.lineage}</div>}
      </div>
    </a>
  )
  return inline ? card : <div class="section">{card}</div>
}

export function RatingCard({ r, rt, snap, strain }: { r: ViewRating; rt: GroupRuntime | null; snap: Snapshot; strain?: StrainData }) {
  const me = meSig.value!
  const { profile } = useData()
  const author = r.private || r.a === me.id ? profile : memberOf(snap, r.a)
  const photoBytes = r.photo ? (r.private ? pPhotos.get(r.photo.id) : rt?.model.photos.get(r.photo.id)) : undefined
  const effects = Object.entries(r.effects).sort((a, b) => b[1] - a[1])
  const aromas = [...new Set([...r.aromas, ...r.tastes])]
  const src = opt(SOURCES, r.source)
  const form = opt(FORMS, r.form)
  const [sharing, setSharing] = useState(false)
  const [talk, setTalk] = useState(false)
  const nComments = rt && !r.private ? snap.comments.filter((c) => c.on === r.id).length : 0
  const share = async () => {
    if (!strain) return
    setSharing(true)
    try {
      const blob = await renderShareCard({ strain, rating: r, author, brand: discreet.peek() ? undefined : 'FlowerPower' })
      await shareOrDownload(blob, `${strain.name.replace(/[^\wäöüÄÖÜß-]+/g, '-')}.png`)
    } catch {
      toast('Bild konnte nicht erstellt werden')
    } finally {
      setSharing(false)
    }
  }
  return (
    <article class="card feed-item">
      <div class="head">
        {strain && (
          <a href={`#/strain/${encodeURIComponent(r.strainId)}`} aria-label={strain.name}>
            <Art s={strain} size="sm" />
          </a>
        )}
        <div class="grow">
          <a class="strain-name" href={`#/strain/${encodeURIComponent(r.strainId)}`}>
            {strain?.name ?? 'Unbekannte Sorte'}
          </a>
          <div class="by">
            <Avatar emoji={author.avatar} /> {author.name} · {timeAgo(r.t)}
            {r.private && <span class="badge gray">🙈 privat</span>}
            {r.sessionId && <span class="badge">🍷 Tasting</span>}
          </div>
        </div>
        <Score value={r.overall} />
      </div>
      {photoBytes && <img class="photo" src={photoUrl(photoBytes)} alt={`Foto von ${strain?.name ?? 'der Sorte'}`} loading="lazy" />}
      {(aromas.length > 0 || effects.length > 0) && (
        <div class="chips" style={{ marginTop: photoBytes ? '0.75rem' : 0 }}>
          {aromas.slice(0, 6).map((a) => {
            const o = opt(AROMAS, a)
            return (
              <span class="chip static">
                {o?.icon} {o?.label ?? a}
              </span>
            )
          })}
          {effects.slice(0, 4).map(([e, v]) => {
            const o = opt(ALL_EFFECTS, e)
            return (
              <span class="chip static tint">
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
      {r.note && <p class="quote">{r.note}</p>}
      {(src || form || r.batch || r.again !== undefined) && (
        <div class="tiny muted mt">
          {[
            fmtDate(r.date),
            src && `${src.icon} ${src.label}`,
            r.batch && `Charge ${r.batch}`,
            form && `${form.icon} ${form.label}${r.vapeTemp ? ` · ${r.vapeTemp} °C` : ''}`,
            r.again !== undefined && (r.again ? '🔁 gerne wieder' : '🚫 eher nicht wieder'),
          ]
            .filter(Boolean)
            .join('  ·  ')}
        </div>
      )}
      <div class="foot">
        {!r.private && rt ? <Reactions r={r} rt={rt} snap={snap} /> : <MiniStars value={r.overall} />}
        <div class="row" style={{ gap: 2 }}>
          {!r.private && rt && (
            <button class={'iconbtn' + (talk ? ' on' : '')} aria-label="Kommentieren" aria-expanded={talk} onClick={() => setTalk(!talk)}>
              <Icon name="chat" />
              {nComments > 0 && <span class="tiny" style={{ marginLeft: -4 }}>{nComments}</span>}
            </button>
          )}
          {strain && (
            <button class="iconbtn" aria-label="Als Bild teilen" title="Als Bild teilen" disabled={sharing} onClick={share}>
              <Icon name="share" />
            </button>
          )}
          {r.a === me.id && (
            <button class="iconbtn" aria-label="Bearbeiten" onClick={() => go(`/rate?edit=${encodeURIComponent(r.id)}${r.private ? '&p=1' : ''}`)}>
              <Icon name="edit" />
            </button>
          )}
        </div>
      </div>
      {!r.private && rt && (nComments > 0 || talk) && <Comments r={r} rt={rt} snap={snap} input={talk} />}
    </article>
  )
}

function Reactions({ r, rt, snap }: { r: ViewRating; rt: GroupRuntime; snap: Snapshot }) {
  const me = meSig.value!
  const reacts = snap.reactions.filter((x) => x.on === r.id)
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
  const [pick, setPick] = useState(false)
  const shown = pick ? REACTIONS : REACTIONS.filter((e) => counts.has(e))
  return (
    <div class="reactions">
      {shown.map((e) => {
        const c = counts.get(e)
        return (
          <button
            key={e + (c?.mine ? '1' : '0')}
            class={'reaction' + (c?.mine ? ' on' : '')}
            onClick={() => {
              toggle(e)
              setPick(false)
            }}
            title={c?.who.join(', ')}
            aria-label={`Reaktion ${e}`}
          >
            {e}
            {c && <span class="n">{c.n}</span>}
          </button>
        )
      })}
      <button class="reaction add" aria-label={pick ? 'Auswahl schließen' : 'Reagieren'} aria-expanded={pick} onClick={() => setPick(!pick)}>
        {pick ? '×' : '☺︎+'}
      </button>
    </div>
  )
}

function Comments({ r, rt, snap, input }: { r: ViewRating; rt: GroupRuntime; snap: Snapshot; input: boolean }) {
  const me = meSig.value!
  const [text, setText] = useState('')
  const [all, setAll] = useState(false)
  const comments = snap.comments.filter((c) => c.on === r.id)
  const shown = all ? comments : comments.slice(-2)
  const send = () => {
    const t = text.trim()
    if (!t) return
    const id = ownKey(me.id) + randomId()
    void rt.model.put(me, 'comments', id, { id, on: r.id, text: t.slice(0, 280), t: Date.now() })
    setText('')
  }
  return (
    <div>
      {comments.length > 2 && !all && (
        <button class="btn ghost sm mt" onClick={() => setAll(true)}>
          Alle {comments.length} Kommentare
        </button>
      )}
      {shown.map((c) => {
        const m = memberOf(snap, c.a)
        return (
          <div class="comment" key={c.id}>
            <Avatar emoji={m.avatar} />
            <div class="bubble grow">
              <b>{m.name}</b> <span class="tiny muted">{timeAgo(c.t)}</span>
              <div>{c.text}</div>
            </div>
            {c.a === me.id && (
              <button
                class="iconbtn"
                style={{ width: 30, height: 30 }}
                aria-label="Kommentar löschen"
                onClick={() => void rt.model.put(me, 'comments', c.id, { id: c.id, on: c.on, text: '', t: c.t, deleted: true })}
              >
                <Icon name="trash" />
              </button>
            )}
          </div>
        )
      })}
      {input && (
      <form
        class="row"
        style={{ marginTop: '0.7rem', animation: 'rise .3s ease both' }}
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <input class="input" autoFocus style={{ minHeight: 38 }} placeholder="Kommentieren …" value={text} maxLength={280} onInput={(e) => setText((e.target as HTMLInputElement).value)} />
        {text.trim() && <button class="btn sm primary">Senden</button>}
      </form>
      )}
    </div>
  )
}

export function deletePrivateRating(id: string) {
  const r = pPrivate.get(id)
  if (r) pPrivate.set(id, { ...r, deleted: true })
}
