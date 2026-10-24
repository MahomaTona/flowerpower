// Live-Tasting: alle bewerten dieselbe Sorte, der Host deckt am Ende auf.
import { useEffect, useRef, useState } from 'preact/hooks'
import { confetti } from '../lib/confetti'
import { me as meSig } from '../lib/app'
import { randomId } from '../lib/crypto'
import { ownKey, type SessionData } from '../lib/model'
import { statsFor } from '../lib/insights'
import { AROMAS, opt } from '../lib/taxonomy'
import { Art, Avatar, back, ChipArt, Empty, go, HeroArt, Icon, MiniStars, PageHead, route, timeAgo, toast } from './kit'
import { RatingCard } from './Feed'
import { Radar, SERIES_COLORS } from './Radar'
import { aromaAxes, aromaValues, effectAxes, effectValues } from './Strains'
import { memberOf, onlineMembers, useData } from './data'

export function Sessions() {
  const d = useData()
  const preset = route.value.q.get('strain')
  const [strainId, setStrainId] = useState<string | null>(preset)
  const [q, setQ] = useState('')
  const [batch, setBatch] = useState('')
  if (!d.rt)
    return (
      <div class="content">
        <PageHead title="Live-Tasting" />
        <Empty icon="🍷">
          <p>Tasting-Runden brauchen eine Gruppe.</p>
          <button class="btn primary" onClick={() => go('/group')}>
            Gruppe gründen oder beitreten
          </button>
        </Empty>
      </div>
    )
  const start = async () => {
    if (!strainId) return
    const me = meSig.value!
    const id = ownKey(me.id) + randomId()
    const s: SessionData = { id, strainId, t: Date.now(), status: 'open', ...(batch.trim() ? { batch: batch.trim() } : {}) }
    await d.rt!.model.put(me, 'sessions', id, s)
    toast('Tasting gestartet')
    go(`/session/${encodeURIComponent(id)}`)
  }
  const ql = q.trim().toLowerCase()
  const options = d.strains.filter((s) => !ql || s.name.toLowerCase().includes(ql)).slice(0, 40)
  const chosen = strainId ? d.strainMap.get(strainId) : undefined
  return (
    <div class="content">
      <PageHead title="Live-Tasting" />
      <p class="muted">
        Alle probieren dieselbe Sorte und bewerten für sich. Die Ergebnisse bleiben verdeckt, bis der Host aufdeckt – dann seht ihr, wie unterschiedlich ihr
        schmeckt.
      </p>
      <div class="card stack">
        <h3>Neue Runde</h3>
        {chosen ? (
          <div class="row">
            <Art s={chosen} size="sm" />
            <b class="grow">{chosen.name}</b>
            <button class="btn sm ghost" onClick={() => setStrainId(null)}>
              Ändern
            </button>
          </div>
        ) : (
          <>
            <input class="input" type="search" placeholder="Sorte wählen …" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
            <div class="chips">
              {options.map((s) => (
                <button class="chip" onClick={() => setStrainId(s.id)}>
                  <ChipArt s={s} /> {s.name}
                </button>
              ))}
            </div>
          </>
        )}
        <input class="input" placeholder="Charge (optional)" value={batch} maxLength={40} onInput={(e) => setBatch((e.target as HTMLInputElement).value)} />
        <button class="btn primary" disabled={!strainId} onClick={start}>
          🍷 Runde starten
        </button>
      </div>

      <div class="section">
        <h3>Runden</h3>
        {d.snap.sessions.length === 0 ? (
          <Empty icon="🥂">Noch keine Tasting-Runde.</Empty>
        ) : (
          <div class="list">
            {d.snap.sessions.map((s) => {
              const st = d.strainMap.get(s.strainId)
              const n = d.snap.ratings.filter((r) => r.sessionId === s.id).length
              return (
                <a class="card link row" href={`#/session/${encodeURIComponent(s.id)}`}>
                  {st ? <Art s={st} size="sm" /> : <span class="art sm" />}
                  <div class="grow">
                    <b>{st?.name ?? 'Unbekannte Sorte'}</b>
                    <div class="tiny muted">
                      {memberOf(d.snap, s.a).name} · {timeAgo(s.t)} · {n} Bewertung{n === 1 ? '' : 'en'}
                    </div>
                  </div>
                  <span class={'badge' + (s.status === 'open' ? '' : ' gray')}>{s.status === 'open' ? 'läuft' : 'aufgedeckt'}</span>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function SessionView({ id }: { id: string }) {
  const d = useData()
  const me = meSig.value!
  const s = d.sessions.get(id)
  const [axis, setAxis] = useState<'wirkung' | 'aroma'>('wirkung')
  // Beim Aufdecken feiern – auch auf den Geräten der anderen
  const status = s?.status
  const prev = useRef(status)
  useEffect(() => {
    if (prev.current === 'open' && status === 'revealed') confetti({ count: 180 })
    prev.current = status
  }, [status])
  if (!s || !d.rt)
    return (
      <div class="content">
        <PageHead title="Tasting" backTo />
        <Empty icon="🌫️">Diese Runde ist (noch) nicht da – vielleicht synchronisiert sie gerade.</Empty>
      </div>
    )
  const strain = d.strainMap.get(s.strainId)
  const all = d.snap.ratings.filter((r) => r.sessionId === id)
  const mine = all.find((r) => r.a === me.id)
  const isHost = s.a === me.id
  const revealed = s.status !== 'open'
  const online = onlineMembers(d.rt)
  const setStatus = async (status: SessionData['status']) => {
    const { a: _a, ...data } = s
    await d.rt!.model.put(me, 'sessions', id, { ...data, status })
  }
  const st = statsFor(all)
  const spread = all.length > 1 ? Math.max(...all.map((r) => r.overall)) - Math.min(...all.map((r) => r.overall)) : 0
  return (
    <div class="content">
      <div class="hero short">
        {strain ? <HeroArt s={strain} /> : <div class="art" />}
        <div class="hero-top">
          <button class="glassbtn" aria-label="Zurück" onClick={back}>
            <Icon name="back" />
          </button>
          <span class={'badge' + (revealed ? '' : ' live')} style={{ alignSelf: 'center', background: 'rgba(0,0,0,.4)', color: '#fbf4e2' }}>
            {revealed ? 'aufgedeckt' : 'läuft'}
          </span>
        </div>
        <div class="hero-text">
          <span class="eyebrow">Live-Tasting · Host {memberOf(d.snap, s.a).name}</span>
          <h1>{strain?.name ?? 'Unbekannte Sorte'}</h1>
          <div class="sub">
            {s.batch && `Charge ${s.batch} · `}
            {timeAgo(s.t)}
          </div>
        </div>
      </div>
      <div class="card">
        <div class="chipgroup-label" style={{ marginTop: 0 }}>
          Abgegeben ({all.length})
        </div>
        <div class="row wrap">
          {all.map((r) => {
            const m = memberOf(d.snap, r.a)
            return (
              <span class="row" style={{ gap: 4 }}>
                <Avatar emoji={m.avatar} online={online.has(r.a)} /> <span class="small">{m.name}</span> {!revealed && '✓'}
              </span>
            )
          })}
          {!all.length && <span class="muted small">Noch niemand.</span>}
        </div>
        <div class="row mt wrap">
          {!revealed && (
            <button class="btn primary grow" onClick={() => go(`/rate?session=${encodeURIComponent(id)}${mine ? `&edit=${encodeURIComponent(mine.id)}` : ''}`)}>
              {mine ? 'Meine Bewertung ändern' : 'Jetzt bewerten'}
            </button>
          )}
          {isHost && !revealed && (
            <button class="btn" disabled={!all.length} onClick={() => confirm('Jetzt für alle aufdecken?') && void setStatus('revealed')}>
              🎉 Aufdecken
            </button>
          )}
          {isHost && revealed && (
            <button class="btn ghost" onClick={() => void setStatus('open')}>
              Wieder öffnen
            </button>
          )}
        </div>
      </div>

      {revealed && all.length > 0 && (
        <>
          <div class="section">
            <h3>Ergebnis</h3>
            <div class="card">
              <div class="row between">
                <div>
                  <div style={{ fontSize: '2rem', fontFamily: 'var(--font-head)' }}>{st.avg.toFixed(1)} ★</div>
                  <div class="tiny muted">Durchschnitt aus {all.length}</div>
                </div>
                <div class="small" style={{ textAlign: 'right' }}>
                  {all.length < 2 ? '' : spread <= 1 ? '🤝 Ihr seid euch einig' : spread >= 3 ? '⚡ Geschmäcker gehen weit auseinander' : '🙂 Leicht unterschiedlich'}
                </div>
              </div>
              <div class="seg mt">
                <button class={axis === 'wirkung' ? 'on' : ''} onClick={() => setAxis('wirkung')}>
                  Wirkung
                </button>
                <button class={axis === 'aroma' ? 'on' : ''} onClick={() => setAxis('aroma')}>
                  Aroma
                </button>
              </div>
              <div class="mt">
                <Radar
                  axes={axis === 'aroma' ? aromaAxes() : effectAxes()}
                  series={all.slice(0, 8).map((r, i) => {
                    const one = statsFor([r])
                    return {
                      label: r.a === me.id ? 'Ich' : memberOf(d.snap, r.a).name,
                      values: axis === 'aroma' ? aromaValues(one) : effectValues(one),
                      color: SERIES_COLORS[i % SERIES_COLORS.length],
                    }
                  })}
                />
              </div>
              <div class="chipgroup-label">Am häufigsten genannt</div>
              <div class="chips">
                {Object.entries(st.aromas)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([a, f]) => {
                    const o = opt(AROMAS, a)
                    return (
                      <span class="chip static">
                        {o?.icon} {o?.label ?? a} · {Math.round(f * 100)} %
                      </span>
                    )
                  })}
              </div>
            </div>
          </div>
          <div class="section">
            <h3>Alle Bewertungen</h3>
            <div class="list">
              {[...all]
                .sort((a, b) => b.overall - a.overall)
                .map((r) => (
                  <RatingCard r={r} rt={d.rt} snap={d.snap} strain={strain} />
                ))}
            </div>
          </div>
        </>
      )}
      {!revealed && mine && (
        <div class="section">
          <h3>Deine (verdeckte) Bewertung</h3>
          <div class="card row">
            <MiniStars value={mine.overall} />
            <span class="muted small">Die anderen sehen sie erst nach dem Aufdecken.</span>
          </div>
        </div>
      )}
    </div>
  )
}
