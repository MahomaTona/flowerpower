// Persönlicher Bereich: Geschmacksprofil, Empfehlungen, Merkliste, eigene Bewertungen.
import { useState } from 'preact/hooks'
import { pWishlist, setProfile } from '../lib/app'
import { byStrain, recommend, tasteProfile } from '../lib/insights'
import { AROMAS, AVATARS, EFFECTS, FORMS, TERPENES, opt, optLabel } from '../lib/taxonomy'
import { Avatar, Empty, MiniStars, Sheet, go, strainIcon } from './kit'
import { RatingCard } from './Feed'
import { Radar } from './Radar'
import { effectAxes, effectValues } from './Strains'
import { statsFor } from '../lib/insights'
import { useData } from './data'

export function Me() {
  const d = useData()
  const [edit, setEdit] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const prof = tasteProfile(d.mine, d.strainMap)
  const tried = new Set(d.mine.map((r) => r.strainId))
  const recs = recommend(prof, d.strains, byStrain([...d.group, ...d.priv]), tried)
  const wish = [...pWishlist.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => d.strainMap.get(id)).filter(Boolean)
  const avg = d.mine.length ? d.mine.reduce((s, r) => s + r.overall, 0) / d.mine.length : 0
  const forms = new Map<string, number>()
  for (const r of d.mine) if (r.form) forms.set(r.form, (forms.get(r.form) ?? 0) + 1)
  const favForm = [...forms].sort((a, b) => b[1] - a[1])[0]?.[0]
  const myStats = statsFor(d.mine)
  return (
    <div class="content">
      <div class="row mb">
        <Avatar emoji={d.profile.avatar} lg />
        <div class="grow">
          <h1 style={{ margin: 0 }}>{d.profile.name}</h1>
          <div class="small muted">
            {d.mine.length} Bewertung{d.mine.length === 1 ? '' : 'en'} · {tried.size} Sorten
          </div>
        </div>
        <button class="btn sm" onClick={() => setEdit(true)}>
          Profil
        </button>
      </div>

      {d.mine.length === 0 ? (
        <div class="card">
          <h3>Dein Geschmacksprofil</h3>
          <p class="muted">Sobald du ein paar Sorten bewertet hast, siehst du hier, welche Terpene und Aromen du magst – und bekommst passende Empfehlungen.</p>
          <button class="btn primary" onClick={() => go('/rate')}>
            Erste Bewertung
          </button>
        </div>
      ) : (
        <div class="card">
          <h3>Dein Geschmacksprofil</h3>
          <div class="grid2">
            <div>
              <div class="chipgroup-label">Lieblings-Terpene</div>
              <div class="chips">
                {prof.topTerpenes.length ? prof.topTerpenes.map((t) => <span class="chip static">{optLabel(TERPENES, t)}</span>) : <span class="muted small">–</span>}
              </div>
              <div class="chipgroup-label">Lieblings-Aromen</div>
              <div class="chips">
                {prof.topAromas.length
                  ? prof.topAromas.map((a) => (
                      <span class="chip static">
                        {opt(AROMAS, a)?.icon} {optLabel(AROMAS, a)}
                      </span>
                    ))
                  : <span class="muted small">–</span>}
              </div>
              <div class="chipgroup-label">Gesuchte Wirkung</div>
              <div class="chips">
                {prof.topEffects.length
                  ? prof.topEffects.map((e) => (
                      <span class="chip static">
                        {opt(EFFECTS, e)?.icon} {optLabel(EFFECTS, e)}
                      </span>
                    ))
                  : <span class="muted small">–</span>}
              </div>
              <dl class="kv mt">
                <dt>Ø Bewertung</dt>
                <dd>
                  <MiniStars value={avg} /> {avg.toFixed(1)}
                </dd>
                {favForm && (
                  <>
                    <dt>Am liebsten</dt>
                    <dd>
                      {opt(FORMS, favForm)?.icon} {optLabel(FORMS, favForm)}
                    </dd>
                  </>
                )}
              </dl>
            </div>
            <Radar axes={effectAxes()} series={[{ label: 'Ich', values: effectValues(myStats), color: 'var(--accent-2)' }]} size={260} />
          </div>
        </div>
      )}

      <div class="section">
        <h3>Könnte dir gefallen</h3>
        {recs.length === 0 ? (
          <Empty icon="✨">Bewerte ein paar Sorten, dann gibt’s Empfehlungen.</Empty>
        ) : (
          <div class="list">
            {recs.map((r) => (
              <a class="card link strain-row" href={`#/strain/${encodeURIComponent(r.strain.id)}`}>
                <span class="strain-ico">{strainIcon(r.strain.type)}</span>
                <div class="grow">
                  <b>{r.strain.name}</b>
                  <div class="tiny muted">{r.reason}</div>
                </div>
                {pWishlist.has(r.strain.id) && <span aria-label="auf der Merkliste">♥</span>}
              </a>
            ))}
          </div>
        )}
      </div>

      <div class="section">
        <h3>♡ Merkliste</h3>
        {wish.length === 0 ? (
          <p class="muted small">Leer – tippe bei einer Sorte auf ♡.</p>
        ) : (
          <div class="chips">
            {wish.map((s) => (
              <a class="chip" style={{ textDecoration: 'none' }} href={`#/strain/${encodeURIComponent(s!.id)}`}>
                {strainIcon(s!.type)} {s!.name}
              </a>
            ))}
          </div>
        )}
      </div>

      <div class="section">
        <h3>Meine Bewertungen</h3>
        {d.mine.length === 0 ? (
          <p class="muted small">Noch keine.</p>
        ) : (
          <div class="list">
            {(showAll ? d.mine : d.mine.slice(0, 5)).map((r) => (
              <RatingCard r={r} rt={d.rt} snap={d.snap} strainName={d.strainMap.get(r.strainId)?.name} strainType={d.strainMap.get(r.strainId)?.type} compact />
            ))}
            {!showAll && d.mine.length > 5 && (
              <button class="btn" onClick={() => setShowAll(true)}>
                Alle {d.mine.length} anzeigen
              </button>
            )}
          </div>
        )}
      </div>
      <ProfileSheet open={edit} onClose={() => setEdit(false)} name={d.profile.name} avatar={d.profile.avatar} />
    </div>
  )
}

export function ProfileSheet({ open, onClose, name, avatar }: { open: boolean; onClose: () => void; name: string; avatar: string }) {
  const [n, setN] = useState(name)
  const [a, setA] = useState(avatar)
  return (
    <Sheet open={open} onClose={onClose}>
      <h2>Profil</h2>
      <label class="field">
        <span>Spitzname</span>
        <input class="input" value={n} maxLength={24} onInput={(e) => setN((e.target as HTMLInputElement).value)} />
      </label>
      <div class="chipgroup-label">Avatar</div>
      <div class="avatar-pick">
        {AVATARS.map((x) => (
          <button type="button" class={x === a ? 'on' : ''} onClick={() => setA(x)} aria-label={x}>
            {x}
          </button>
        ))}
      </div>
      <div class="row mt">
        <button class="btn ghost" onClick={onClose}>
          Abbrechen
        </button>
        <button
          class="btn primary grow"
          disabled={!n.trim()}
          onClick={() => {
            setProfile(n.trim(), a)
            onClose()
          }}
        >
          Speichern
        </button>
      </div>
    </Sheet>
  )
}
