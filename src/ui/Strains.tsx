import { useState } from 'preact/hooks'
import { me as meSig, pStrains, pWishlist, type GroupRuntime } from '../lib/app'
import { randomId } from '../lib/crypto'
import { ownKey, type StrainData } from '../lib/model'
import { byStrain, statsFor, type R, type StrainStats } from '../lib/insights'
import { AROMA_GROUPS, AROMAS, EFFECTS, SOURCES, STRAIN_TYPES, TERPENES, opt, optLabel } from '../lib/taxonomy'
import { ChipSelect, Empty, Icon, MiniStars, PageHead, Seg, SingleSelect, Slider, go, pct, route, strainIcon, toast } from './kit'
import { RatingCard } from './Feed'
import { Radar, SERIES_COLORS } from './Radar'
import { memberOf, useData, type ViewRating } from './data'

type Tab = 'alle' | 'merkliste' | 'probiert'

export function StrainList() {
  const d = useData()
  const [q, setQ] = useState('')
  const [types, setTypes] = useState<string[]>([])
  const [terps, setTerps] = useState<string[]>([])
  const [tab, setTab] = useState<Tab>('alle')
  const [sort, setSort] = useState<'name' | 'top' | 'oft'>('name')
  const [showFilter, setShowFilter] = useState(false)
  const all: R[] = [...d.group, ...d.priv]
  const stats = new Map([...byStrain(all)].map(([k, v]) => [k, statsFor(v)]))
  const tried = new Set(d.mine.map((r) => r.strainId))
  const ql = q.trim().toLowerCase()
  let list = d.strains.filter(
    (s) =>
      (!ql || s.name.toLowerCase().includes(ql) || s.lineage?.toLowerCase().includes(ql)) &&
      (!types.length || types.includes(s.type)) &&
      (!terps.length || terps.every((t) => s.terpenes.includes(t))) &&
      (tab === 'alle' || (tab === 'merkliste' ? pWishlist.has(s.id) : tried.has(s.id))),
  )
  if (sort === 'top') list = [...list].sort((a, b) => (stats.get(b.id)?.avg ?? 0) - (stats.get(a.id)?.avg ?? 0))
  if (sort === 'oft') list = [...list].sort((a, b) => (stats.get(b.id)?.n ?? 0) - (stats.get(a.id)?.n ?? 0))
  return (
    <div class="content">
      <PageHead
        title="Sorten"
        right={
          <button class="btn sm" onClick={() => go('/strain-new')}>
            + Neue Sorte
          </button>
        }
      />
      <div class="tabs">
        {(
          [
            ['alle', `Alle (${d.strains.length})`],
            ['merkliste', `♡ Merkliste (${pWishlist.size})`],
            ['probiert', `Probiert (${tried.size})`],
          ] as [Tab, string][]
        ).map(([t, l]) => (
          <button class={'chip' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>
            {l}
          </button>
        ))}
      </div>
      <div class="row mb">
        <div class="search grow">
          <Icon name="search" />
          <input class="input" type="search" placeholder="Sorte oder Genetik suchen" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        </div>
        <button class={'btn' + (types.length || terps.length ? ' primary' : '')} onClick={() => setShowFilter(!showFilter)}>
          Filter
        </button>
      </div>
      {showFilter && (
        <div class="card flat mb">
          <div class="chipgroup-label" style={{ marginTop: 0 }}>
            Typ
          </div>
          <ChipSelect opts={STRAIN_TYPES} value={types} onChange={setTypes} />
          <div class="chipgroup-label">Enthält Terpene</div>
          <ChipSelect opts={TERPENES} value={terps} onChange={setTerps} />
          <div class="chipgroup-label">Sortieren</div>
          <Seg
            value={sort}
            onChange={setSort}
            opts={[
              ['name', 'A–Z'],
              ['top', 'Beste'],
              ['oft', 'Meistbewertet'],
            ]}
          />
        </div>
      )}
      {list.length === 0 ? (
        <Empty icon={tab === 'merkliste' ? '♡' : '🔍'}>
          {tab === 'merkliste' ? 'Tippe bei einer Sorte auf ♡, um sie dir zu merken.' : 'Keine Sorte gefunden.'}
          {ql && (
            <div class="mt">
              <button class="btn" onClick={() => go(`/strain-new?name=${encodeURIComponent(q.trim())}`)}>
                „{q.trim()}“ anlegen
              </button>
            </div>
          )}
        </Empty>
      ) : (
        <div class="list">
          {list.map((s) => (
            <StrainRow s={s} st={stats.get(s.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function StrainRow({ s, st }: { s: StrainData & { origin: string }; st?: StrainStats }) {
  const wish = pWishlist.has(s.id)
  return (
    <a class="card link strain-row" href={`#/strain/${encodeURIComponent(s.id)}`}>
      <span class="strain-ico">{strainIcon(s.type)}</span>
      <div class="grow">
        <div class="row" style={{ gap: 6 }}>
          <b>{s.name}</b>
          {s.origin === 'private' && <span class="badge gray">privat</span>}
          {s.origin === 'group' && <span class="badge">Gruppe</span>}
        </div>
        <div class="tiny muted">
          {optLabel(STRAIN_TYPES, s.type)} · THC {pct(s.thc)} · {s.terpenes.slice(0, 2).map((t) => optLabel(TERPENES, t)).join(', ')}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {st ? (
          <>
            <MiniStars value={st.avg} />
            <div class="tiny muted">{st.n}×</div>
          </>
        ) : (
          <span class="tiny muted">neu</span>
        )}
      </div>
      <button
        class="iconbtn"
        aria-label={wish ? 'Von Merkliste entfernen' : 'Auf die Merkliste'}
        style={{ color: wish ? 'var(--accent)' : undefined }}
        onClick={(e) => {
          e.preventDefault()
          toggleWish(s.id)
        }}
      >
        {wish ? '♥' : '♡'}
      </button>
    </a>
  )
}

export function toggleWish(id: string) {
  if (pWishlist.has(id)) pWishlist.delete(id)
  else {
    pWishlist.set(id, Date.now())
    toast('Auf der Merkliste')
  }
}

export const RADAR_EFFECTS = ['entspannt', 'euphorisch', 'kreativ', 'fokussiert', 'energie', 'koerper', 'muede', 'hunger']

export function aromaAxes() {
  return AROMA_GROUPS.map((g) => ({ id: g.id, label: g.label.split(' ')[0] }))
}
export function aromaValues(st: StrainStats): Record<string, number> {
  const out: Record<string, number> = {}
  for (const g of AROMA_GROUPS) out[g.id] = Math.min(1, g.opts.reduce((s, o) => s + (st.aromas[o.id] ?? 0), 0))
  return out
}
export const effectAxes = () => RADAR_EFFECTS.map((id) => ({ id, label: optLabel(EFFECTS, id) }))
export function effectValues(st: StrainStats): Record<string, number> {
  return Object.fromEntries(RADAR_EFFECTS.map((e) => [e, (st.effects[e] ?? 0) / 3]))
}

export function StrainDetail({ id }: { id: string }) {
  const d = useData()
  const s = d.strainMap.get(id)
  const [view, setView] = useState<'aroma' | 'wirkung' | 'vergleich'>('aroma')
  if (!s)
    return (
      <div class="content">
        <PageHead title="Sorte" backTo />
        <Empty icon="🌫️">Diese Sorte gibt es (noch) nicht – vielleicht synchronisiert sie gerade.</Empty>
      </div>
    )
  const ratings: ViewRating[] = [...d.group, ...d.priv].filter((r) => r.strainId === id).sort((a, b) => b.t - a.t)
  const st = statsFor(ratings)
  const wish = pWishlist.has(id)
  const me = meSig.value!
  const canEdit = s.origin === 'private' || (s.origin === 'group' && s.a === me.id)
  // Pro Person ein Durchschnittsprofil für den Vergleich
  const perPerson = new Map<string, R[]>()
  for (const r of ratings) perPerson.set(r.a ?? me.id, [...(perPerson.get(r.a ?? me.id) ?? []), r])
  const batches = new Map<string, R[]>()
  for (const r of ratings)
    if (r.batch || r.source) {
      const k = `${r.source ?? ''}|${r.batch ?? ''}`
      batches.set(k, [...(batches.get(k) ?? []), r])
    }
  return (
    <div class="content">
      <PageHead
        title={s.name}
        backTo
        right={
          <button class="iconbtn" style={{ color: wish ? 'var(--accent)' : undefined, fontSize: '1.4rem' }} aria-label="Merkliste" onClick={() => toggleWish(id)}>
            {wish ? '♥' : '♡'}
          </button>
        }
      />
      <div class="card">
        <div class="row mb">
          <span class="strain-ico">{strainIcon(s.type)}</span>
          <div class="grow">
            <b>{optLabel(STRAIN_TYPES, s.type)}</b>
            {s.lineage && <div class="small muted">{s.lineage}</div>}
          </div>
          {st.n > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.5rem', fontFamily: 'var(--font-head)' }}>{st.avg.toFixed(1)}</div>
              <div class="tiny muted">{st.n} Bewertung{st.n === 1 ? '' : 'en'}</div>
            </div>
          )}
        </div>
        <dl class="kv">
          <dt>THC</dt>
          <dd>{pct(s.thc)}</dd>
          <dt>CBD</dt>
          <dd>{pct(s.cbd)}</dd>
          {s.breeder && (
            <>
              <dt>Züchter</dt>
              <dd>{s.breeder}</dd>
            </>
          )}
        </dl>
        <div class="chipgroup-label">Terpene</div>
        <div class="stack" style={{ gap: 6 }}>
          {s.terpenes.map((t, i) => {
            const o = opt(TERPENES, t)
            return (
              <div>
                <div class="row between small">
                  <b>{o?.label ?? t}</b>
                  <span class="muted tiny">{o?.hint}</span>
                </div>
                <div class="bar">
                  <i style={{ width: `${100 - i * 25}%` }} />
                </div>
              </div>
            )
          })}
        </div>
        {s.aromas.length > 0 && (
          <>
            <div class="chipgroup-label">Typische Aromen</div>
            <div class="chips">
              {s.aromas.map((a) => {
                const o = opt(AROMAS, a)
                return (
                  <span class="chip static">
                    {o?.icon} {o?.label}
                  </span>
                )
              })}
            </div>
          </>
        )}
        {s.origin === 'start' && <p class="tiny muted mt" style={{ marginBottom: 0 }}>Richtwerte aus der Startliste – echte Werte schwanken je Charge.</p>}
        <div class="row mt">
          <button class="btn primary grow" onClick={() => go(`/rate?strain=${encodeURIComponent(id)}`)}>
            Bewerten
          </button>
          {d.rt && (
            <button class="btn" onClick={() => go(`/sessions?strain=${encodeURIComponent(id)}`)}>
              🍷 Tasting starten
            </button>
          )}
          {canEdit && (
            <button class="btn" onClick={() => go(`/strain-new?edit=${encodeURIComponent(id)}`)} aria-label="Sorte bearbeiten">
              <Icon name="edit" />
            </button>
          )}
        </div>
      </div>

      {st.n > 0 && (
        <div class="section">
          <h3>Profil der Gruppe</h3>
          <div class="card">
            <Seg
              value={view}
              onChange={setView}
              opts={[
                ['aroma', 'Aroma'],
                ['wirkung', 'Wirkung'],
                ['vergleich', 'Pro Person'],
              ]}
            />
            <div class="mt">
              {view === 'aroma' && <Radar axes={aromaAxes()} series={[{ label: 'Gruppe', values: aromaValues(st), color: 'var(--accent)' }]} />}
              {view === 'wirkung' && <Radar axes={effectAxes()} series={[{ label: 'Gruppe', values: effectValues(st), color: 'var(--accent)' }]} />}
              {view === 'vergleich' && (
                <Radar
                  axes={effectAxes()}
                  series={[...perPerson].slice(0, 8).map(([a, rs], i) => ({
                    label: a === me.id ? 'Ich' : memberOf(d.snap, a).name,
                    values: effectValues(statsFor(rs)),
                    color: SERIES_COLORS[i % SERIES_COLORS.length],
                  }))}
                />
              )}
            </div>
            <div class="chipgroup-label">Probiert von</div>
            <div class="row wrap">
              {[...perPerson].map(([a, rs]) => {
                const m = a === me.id ? d.profile : memberOf(d.snap, a)
                const avg = rs.reduce((x, r) => x + r.overall, 0) / rs.length
                return (
                  <span class="chip static">
                    {m.avatar} {m.name} · {avg.toFixed(1)}★
                  </span>
                )
              })}
            </div>
            <CompareLink id={id} />
          </div>
        </div>
      )}

      {batches.size > 1 && (
        <div class="section">
          <h3>Nach Bezugsquelle & Charge</h3>
          <div class="card flat">
            {[...batches].map(([k, rs]) => {
              const [src, batch] = k.split('|')
              const avg = rs.reduce((x, r) => x + r.overall, 0) / rs.length
              return (
                <div class="row between small" style={{ padding: '4px 0' }}>
                  <span>
                    {src ? optLabel(SOURCES, src) : 'Unbekannte Quelle'}
                    {batch && <span class="muted"> · {batch}</span>}
                  </span>
                  <span>
                    <MiniStars value={avg} /> <span class="muted">({rs.length})</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div class="section">
        <h3>Bewertungen</h3>
        {ratings.length === 0 ? (
          <Empty icon="📝">Noch niemand hat diese Sorte bewertet.</Empty>
        ) : (
          <div class="list">
            {ratings.map((r) => (
              <RatingCard r={r} rt={d.rt} snap={d.snap} compact />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


function CompareLink({ id }: { id: string }) {
  return (
    <button class="btn sm mt" onClick={() => go(`/compare?ids=${encodeURIComponent(id)}`)}>
      Mit anderen Sorten vergleichen
    </button>
  )
}

export function Compare() {
  const d = useData()
  const ids = (route.value.q.get('ids') ?? '').split(',').filter(Boolean)
  const [q, setQ] = useState('')
  const [axis, setAxis] = useState<'aroma' | 'wirkung'>('wirkung')
  const all: R[] = [...d.group, ...d.priv]
  const grouped = byStrain(all)
  const setIds = (n: string[]) => go(`/compare?ids=${n.map(encodeURIComponent).join(',')}`)
  const chosen = ids.map((id) => d.strainMap.get(id)).filter(Boolean) as StrainData[]
  const candidates = d.strains.filter((s) => !ids.includes(s.id) && grouped.has(s.id) && s.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div class="content">
      <PageHead title="Vergleich" backTo />
      <div class="card">
        <Seg
          value={axis}
          onChange={setAxis}
          opts={[
            ['wirkung', 'Wirkung'],
            ['aroma', 'Aroma'],
          ]}
        />
        <div class="mt">
          {chosen.length ? (
            <Radar
              axes={axis === 'aroma' ? aromaAxes() : effectAxes()}
              series={chosen.map((s, i) => {
                const st = statsFor(grouped.get(s.id) ?? [])
                return { label: s.name, values: axis === 'aroma' ? aromaValues(st) : effectValues(st), color: SERIES_COLORS[i] }
              })}
            />
          ) : (
            <Empty icon="📊">Wähle bis zu 4 Sorten aus.</Empty>
          )}
        </div>
        <div class="list mt">
          {chosen.map((s, i) => {
            const st = statsFor(grouped.get(s.id) ?? [])
            return (
              <div class="row">
                <i style={{ width: 12, height: 12, borderRadius: 3, background: SERIES_COLORS[i] }} />
                <b class="grow">{s.name}</b>
                {st.n ? <MiniStars value={st.avg} /> : <span class="tiny muted">keine Bewertung</span>}
                <span class="tiny muted">{st.raters.size} Pers.</span>
                <button class="iconbtn" aria-label="Entfernen" onClick={() => setIds(ids.filter((x) => x !== s.id))}>
                  <Icon name="close" />
                </button>
              </div>
            )
          })}
        </div>
      </div>
      {ids.length < 4 && (
        <div class="section">
          <h3>Sorte hinzufügen</h3>
          <input class="input mb" placeholder="Suchen (nur bewertete Sorten)" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
          <div class="chips">
            {candidates.slice(0, 30).map((s) => (
              <button class="chip" onClick={() => setIds([...ids, s.id])}>
                {strainIcon(s.type)} {s.name}
              </button>
            ))}
            {!candidates.length && <span class="muted small">Keine weiteren bewerteten Sorten.</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export function StrainForm() {
  const d = useData()
  const editId = route.value.q.get('edit')
  const existing = editId ? d.strainMap.get(editId) : undefined
  const [name, setName] = useState(existing?.name ?? route.value.q.get('name') ?? '')
  const [type, setType] = useState<string | undefined>(existing?.type ?? 'hybrid')
  const [lineage, setLineage] = useState(existing?.lineage ?? '')
  const [breeder, setBreeder] = useState(existing?.breeder ?? '')
  const [thc, setThc] = useState<number | undefined>(existing?.thc?.[1])
  const [cbd, setCbd] = useState<number | undefined>(existing?.cbd?.[1])
  const [terpenes, setTerpenes] = useState<string[]>(existing?.terpenes ?? [])
  const [aromas, setAromas] = useState<string[]>(existing?.aromas ?? [])
  const [share, setShare] = useState<'gruppe' | 'privat'>(existing ? (existing.origin === 'private' ? 'privat' : 'gruppe') : d.rt ? 'gruppe' : 'privat')
  const dup = !existing && d.strains.find((s) => s.name.toLowerCase() === name.trim().toLowerCase())
  const save = async () => {
    const me = meSig.value!
    const id = existing?.id ?? (share === 'gruppe' ? ownKey(me.id) : 'p~') + randomId()
    const data: StrainData = {
      id,
      name: name.trim(),
      type: type ?? 'hybrid',
      lineage: lineage.trim() || undefined,
      breeder: breeder.trim() || undefined,
      thc: thc !== undefined ? [Math.max(0, thc - 3), thc] : undefined,
      cbd: cbd !== undefined ? [Math.max(0, cbd - 1), cbd] : undefined,
      terpenes,
      aromas,
      t: Date.now(),
    }
    const clean = JSON.parse(JSON.stringify(data)) as StrainData
    if (share === 'gruppe' && d.rt) await (d.rt as GroupRuntime).model.put(me, 'strains', id, clean)
    else pStrains.set(id, clean)
    toast(existing ? 'Gespeichert' : 'Sorte angelegt')
    go(`/strain/${encodeURIComponent(id)}`)
  }
  return (
    <div class="content">
      <PageHead title={existing ? 'Sorte bearbeiten' : 'Neue Sorte'} backTo />
      <div class="stack">
        <label class="field">
          <span>Name *</span>
          <input class="input" value={name} maxLength={60} onInput={(e) => setName((e.target as HTMLInputElement).value)} placeholder="z. B. Lemon Cherry Gelato" />
        </label>
        {dup && (
          <div class="banner">
            „{dup.name}“ gibt es schon. <a href={`#/strain/${encodeURIComponent(dup.id)}`}>Ansehen</a>
          </div>
        )}
        <div>
          <div class="chipgroup-label">Typ</div>
          <SingleSelect opts={STRAIN_TYPES} value={type} onChange={setType} allowNone={false} />
        </div>
        <div class="card flat stack">
          <Slider label="THC (max.)" low="0 %" high="35 %" min={0} max={35} step={0.5} value={thc} onChange={setThc} fmt={(v) => `${v} %`} />
          <Slider label="CBD (max.)" low="0 %" high="20 %" min={0} max={20} step={0.5} value={cbd} onChange={setCbd} fmt={(v) => `${v} %`} />
        </div>
        <div>
          <div class="chipgroup-label">Dominante Terpene (bis zu 3, wichtigstes zuerst)</div>
          <ChipSelect opts={TERPENES} value={terpenes} onChange={setTerpenes} max={3} />
        </div>
        <div>
          <div class="chipgroup-label">Typische Aromen</div>
          <ChipSelect opts={AROMAS} value={aromas} onChange={setAromas} max={6} />
        </div>
        <label class="field">
          <span>Genetik (optional)</span>
          <input class="input" value={lineage} maxLength={100} onInput={(e) => setLineage((e.target as HTMLInputElement).value)} placeholder="z. B. Gelato × Runtz" />
        </label>
        <label class="field">
          <span>Züchter (optional)</span>
          <input class="input" value={breeder} maxLength={60} onInput={(e) => setBreeder((e.target as HTMLInputElement).value)} />
        </label>
        {!existing && d.rt && (
          <div>
            <div class="chipgroup-label">Sichtbar für</div>
            <Seg
              value={share}
              onChange={setShare}
              opts={[
                ['gruppe', `👥 ${d.rt.entry.name}`],
                ['privat', '🙈 Nur mich'],
              ]}
            />
          </div>
        )}
        <button class="btn primary" disabled={!name.trim() || !!dup} onClick={save}>
          Speichern
        </button>
      </div>
    </div>
  )
}

