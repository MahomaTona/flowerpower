// Bewertung anlegen/bearbeiten – fast alles per Antippen.
import { useState } from 'preact/hooks'
import { me as meSig, pPhotos, pPrivate } from '../lib/app'
import { randomId, sha256hex } from '../lib/crypto'
import { compressImage, photoUrl } from '../lib/image'
import { ownKey, type RatingData } from '../lib/model'
import { ASH, AROMA_GROUPS, BURN, COMBUSTION, EFFECTS, FORMS, QUALITY, SIDE_EFFECTS, SOURCES, VAPE } from '../lib/taxonomy'
import { Art, back, ChipArt, ChipSelect, Empty, go, HeroArt, Icon, LevelChips, MiniStars, PageHead, PhotoInput, route, Seg, SingleSelect, Slider, Stars, toast } from './kit'
import { myStatus, useData } from './data'
import { MILESTONES, confetti } from '../lib/confetti'

const today = () => new Date().toISOString().slice(0, 10)

export function RateForm() {
  const d = useData()
  const me = meSig.value!
  const q = route.value.q
  const editId = q.get('edit')
  const editPrivate = q.get('p') === '1'
  const existing: RatingData | undefined = editId ? (editPrivate ? pPrivate.get(editId) : d.snap.ratings.find((r) => r.id === editId && r.a === me.id)) : undefined
  const sessionId = existing?.sessionId ?? q.get('session') ?? undefined
  const session = sessionId ? d.sessions.get(sessionId) : undefined

  const [strainId, setStrainId] = useState<string | undefined>(existing?.strainId ?? session?.strainId ?? q.get('strain') ?? undefined)
  const [date, setDate] = useState(existing?.date ?? today())
  const [source, setSource] = useState(existing?.source)
  const [batch, setBatch] = useState(existing?.batch ?? session?.batch ?? '')
  const [form, setForm] = useState(existing?.form)
  const [vapeTemp, setVapeTemp] = useState<number | undefined>(existing?.vapeTemp)
  const [quality, setQuality] = useState<Record<string, number>>(existing?.quality ?? {})
  const [burn, setBurn] = useState(existing?.burn)
  const [ash, setAsh] = useState(existing?.ash)
  const [aromas, setAromas] = useState<string[]>(existing?.aromas ?? [])
  const [tastes, setTastes] = useState<string[]>(existing?.tastes ?? [])
  const [effects, setEffects] = useState<Record<string, number>>(existing?.effects ?? {})
  const [overall, setOverall] = useState(existing?.overall ?? 0)
  const [again, setAgain] = useState<boolean | undefined>(existing?.again)
  const [note, setNote] = useState(existing?.note ?? '')
  const [photo, setPhoto] = useState<Uint8Array | undefined>(() => {
    if (!existing?.photo) return undefined
    return editPrivate ? pPhotos.get(existing.photo.id) : d.rt?.model.photos.get(existing.photo.id)
  })
  const [share, setShare] = useState<'gruppe' | 'privat'>(existing ? (editPrivate ? 'privat' : 'gruppe') : d.rt ? 'gruppe' : 'privat')
  const [busy, setBusy] = useState(false)

  const strain = strainId ? d.strainMap.get(strainId) : undefined
  const muted = !!d.rt && myStatus(d.snap, me.id).muted
  const isGroup = share === 'gruppe' && !!d.rt && !muted

  const save = async () => {
    if (!strainId || !overall) return
    setBusy(true)
    try {
      const id = existing?.id ?? (isGroup ? ownKey(me.id) : 'p~') + randomId()
      let photoRef: RatingData['photo']
      if (photo) {
        const hash = (await sha256hex(photo)).slice(0, 24)
        const pid = existing?.photo?.hash === hash ? existing.photo.id : (isGroup ? ownKey(me.id) : 'p~') + randomId()
        if (isGroup) d.rt!.model.photos.set(pid, photo)
        else pPhotos.set(pid, photo)
        photoRef = { id: pid, hash }
      }
      const data: RatingData = JSON.parse(
        JSON.stringify({
          id,
          strainId,
          t: existing?.t ?? Date.now(),
          date,
          source,
          batch: batch.trim() || undefined,
          form,
          vapeTemp: form && VAPE.has(form) ? vapeTemp : undefined,
          quality,
          burn: form && COMBUSTION.has(form) ? burn : undefined,
          ash: form && COMBUSTION.has(form) ? ash : undefined,
          aromas,
          tastes,
          effects,
          overall,
          again,
          note: note.trim().slice(0, 300) || undefined,
          photo: photoRef,
          sessionId,
        }),
      )
      // Sichtbarkeit beim Bearbeiten gewechselt? Dann alten Eintrag entfernen.
      if (existing && editPrivate && isGroup) pPrivate.delete(existing.id)
      if (existing && !editPrivate && !isGroup) await d.rt!.model.put(me, 'ratings', existing.id, { ...existing, deleted: true })
      const finalId = existing && editPrivate !== !isGroup ? (isGroup ? ownKey(me.id) : 'p~') + randomId() : id
      data.id = finalId
      if (isGroup) await d.rt!.model.put(me, 'ratings', finalId, data)
      else pPrivate.set(finalId, data)
      const triedBefore = new Set(d.mine.map((r) => r.strainId))
      const triedNow = triedBefore.size + (triedBefore.has(strainId) ? 0 : 1)
      if (!existing && triedNow !== triedBefore.size && MILESTONES.includes(triedNow)) {
        confetti()
        toast(triedNow === 1 ? '🎉 Deine erste Notiz!' : `🎉 ${triedNow} Sorten probiert!`)
      } else if (!existing && overall === 5) {
        confetti({ count: 70 })
        toast('✨ Fünf Sterne – notiert!')
      } else toast(existing ? 'Bewertung aktualisiert' : isGroup ? 'Mit der Gruppe geteilt' : 'Privat gespeichert')
      if (sessionId) go(`/session/${encodeURIComponent(sessionId)}`)
      else go(`/strain/${encodeURIComponent(strainId)}`)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!existing || !confirm('Bewertung löschen?')) return
    if (editPrivate) pPrivate.set(existing.id, { ...existing, deleted: true })
    else await d.rt!.model.put(me, 'ratings', existing.id, { ...existing, deleted: true })
    toast('Gelöscht')
    back()
  }

  if (!strain) return <StrainPicker onPick={setStrainId} />

  return (
    <div class="content">
      <div class="hero short">
        <HeroArt s={strain} />
        <div class="hero-top">
          <button class="glassbtn" aria-label="Zurück" onClick={back}>
            <Icon name="back" />
          </button>
          {!session && !existing && (
            <button class="btn sm" style={{ background: 'rgba(0,0,0,.35)', color: '#fff', borderColor: 'rgba(255,255,255,.2)' }} onClick={() => setStrainId(undefined)}>
              Andere Sorte
            </button>
          )}
        </div>
        <div class="hero-text">
          <span class="eyebrow">{existing ? 'Notiz bearbeiten' : session ? 'Live-Tasting' : 'Neue Notiz'}</span>
          <h1>{strain.name}</h1>
        </div>
      </div>
      {session && <div class="banner mb">🍷 Deine Bewertung bleibt verdeckt, bis der Host aufdeckt.</div>}

      <Section n={1} done={!!source || !!batch} title="Wann & woher">
        <label class="field">
          <span>Datum</span>
          <input class="input" type="date" value={date} max={today()} onInput={(e) => setDate((e.target as HTMLInputElement).value || today())} />
        </label>
        <div class="chipgroup-label">Bezugsquelle</div>
        <SingleSelect opts={SOURCES} value={source} onChange={setSource} />
        <label class="field mt">
          <span>Charge (optional)</span>
          <input class="input" value={batch} maxLength={40} placeholder="z. B. Ernte 03/26" onInput={(e) => setBatch((e.target as HTMLInputElement).value)} />
        </label>
      </Section>

      <Section n={2} done={!!form} title="Konsumform">
        <SingleSelect opts={FORMS} value={form} onChange={setForm} />
        {form && VAPE.has(form) && (
          <div class="mt">
            <Slider label="Temperatur" low="150 °C" high="230 °C" min={150} max={230} step={5} value={vapeTemp} onChange={setVapeTemp} fmt={(v) => `${v} °C`} />
          </div>
        )}
      </Section>

      <Section n={3} done={Object.keys(quality).length > 0} title="Optik & Qualität">
        <div class="stack">
          {QUALITY.map((x) => (
            <Slider label={x.label} low={x.low} high={x.high} value={quality[x.id]} onChange={(v) => setQuality(v === undefined ? omit(quality, x.id) : { ...quality, [x.id]: v })} />
          ))}
        </div>
        {form && COMBUSTION.has(form) && (
          <>
            <div class="chipgroup-label">Abbrand</div>
            <SingleSelect opts={BURN} value={burn} onChange={setBurn} />
            <div class="chipgroup-label">Asche</div>
            <SingleSelect opts={ASH} value={ash} onChange={setAsh} />
          </>
        )}
      </Section>

      <Section n={4} done={aromas.length > 0} title="Geruch">
        {AROMA_GROUPS.map((g) => (
          <>
            <div class="chipgroup-label">{g.label}</div>
            <ChipSelect opts={g.opts} value={aromas} onChange={setAromas} />
          </>
        ))}
      </Section>

      <Section
        n={5}
        done={tastes.length > 0}
        title="Geschmack"
        right={
          aromas.length > 0 && (
            <button class="btn sm ghost" onClick={() => setTastes([...aromas])}>
              Wie Geruch
            </button>
          )
        }
      >
        {AROMA_GROUPS.map((g) => (
          <>
            <div class="chipgroup-label">{g.label}</div>
            <ChipSelect opts={g.opts} value={tastes} onChange={setTastes} />
          </>
        ))}
      </Section>

      <Section n={6} done={Object.keys(effects).length > 0} title="Wirkung">
        <p class="tiny muted">Mehrmals tippen für die Stärke: leicht → deutlich → stark → aus.</p>
        <LevelChips opts={EFFECTS} value={effects} onChange={setEffects} />
        <div class="chipgroup-label">Nebenwirkungen</div>
        <LevelChips opts={SIDE_EFFECTS} value={effects} onChange={setEffects} />
      </Section>

      <Section n={7} done={overall > 0} title="Gesamteindruck">
        <Stars value={overall} onChange={setOverall} />
        <div class="mt">
          <Seg
            value={again === undefined ? '' : again ? 'ja' : 'nein'}
            onChange={(v) => setAgain(v === '' ? undefined : v === 'ja')}
            opts={[
              ['ja', '🔁 Gerne wieder'],
              ['', 'Weiß nicht'],
              ['nein', '🚫 Eher nicht'],
            ]}
          />
        </div>
        <label class="field mt">
          <span>Notiz (optional)</span>
          <textarea class="input" maxLength={300} value={note} placeholder="Ein Satz, der hängen bleibt …" onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)} />
        </label>
        <div class="row mt">
          {photo && <img class="thumb" src={photoUrl(photo)} alt="Foto" />}
          <PhotoInput
            onFile={async (f) => {
              try {
                setPhoto(await compressImage(f))
              } catch {
                toast('Foto konnte nicht gelesen werden')
              }
            }}
          >
            <Icon name="camera" /> {photo ? 'Anderes Foto' : 'Foto hinzufügen'}
          </PhotoInput>
          {photo && (
            <button class="btn ghost" onClick={() => setPhoto(undefined)}>
              Entfernen
            </button>
          )}
        </div>
      </Section>

      {muted && <div class="banner warn mt">🔇 Du bist stummgeschaltet – diese Notiz wird privat gespeichert.</div>}
      {d.rt && !session && !muted && (
        <Section n={8} done title="Sichtbar für">
          <Seg
            value={share}
            onChange={setShare}
            opts={[
              ['gruppe', `👥 ${d.rt.entry.name}`],
              ['privat', '🙈 Nur mich'],
            ]}
          />
        </Section>
      )}

      <div class="savebar">
        <div class="grow" style={{ paddingLeft: 6 }}>
          {overall ? <MiniStars value={overall} /> : <span class="small muted">Noch keine Sterne</span>}
          <div class="tiny muted">{isGroup ? `👥 ${d.rt!.entry.name}` : '🙈 privat'}</div>
        </div>
        <button class="btn primary" disabled={!overall || busy} onClick={save}>
          {busy ? 'Speichere …' : existing ? 'Aktualisieren' : 'Speichern'}
        </button>
      </div>
      {existing && (
        <button class="btn danger block mt" onClick={remove}>
          Bewertung löschen
        </button>
      )}
    </div>
  )
}

function omit(o: Record<string, number>, k: string) {
  const n = { ...o }
  delete n[k]
  return n
}

function Section({ n, done, title, right, children }: { n: number; done?: boolean; title: string; right?: preact.ComponentChildren; children: preact.ComponentChildren }) {
  return (
    <div class="form-section">
      <div class="section-title">
        <span class={'n' + (done ? ' done' : '')}>{done ? '✓' : n}</span>
        <h3>{title}</h3>
        {right}
      </div>
      <div class="card">{children}</div>
    </div>
  )
}

function StrainPicker({ onPick }: { onPick: (id: string) => void }) {
  const d = useData()
  const [q, setQ] = useState('')
  const recent = [...new Set(d.mine.map((r) => r.strainId))].slice(0, 8).map((id) => d.strainMap.get(id)).filter(Boolean)
  const ql = q.trim().toLowerCase()
  const list = ql ? d.strains.filter((s) => s.name.toLowerCase().includes(ql) || s.lineage?.toLowerCase().includes(ql)) : d.strains
  return (
    <div class="content wide">
      <PageHead title="Was probierst du?" backTo />
      <div class="search mb">
        <Icon name="search" />
        <input class="input" type="search" autoFocus placeholder="Sorte suchen …" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      </div>
      {!ql && recent.length > 0 && (
        <>
          <div class="chipgroup-label">Zuletzt bewertet</div>
          <div class="chips mb">
            {recent.map((s) => (
              <button class="chip" onClick={() => onPick(s!.id)}>
                <ChipArt s={s!} /> {s!.name}
              </button>
            ))}
          </div>
        </>
      )}
      {list.length ? (
        <div class="gallery">
          {list.slice(0, 48).map((s, i) => (
            <button class="gcard" style={{ '--i': i, padding: 0, textAlign: 'left', font: 'inherit', cursor: 'pointer' }} onClick={() => onPick(s.id)}>
              <div class="art-wrap">
                <Art s={s} />
                <div class="over">
                  <div class="name">{s.name}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Empty icon="🌱">
          <p>„{q.trim()}“ ist noch nicht in der Liste.</p>
          <button class="btn primary" onClick={() => go(`/strain-new?name=${encodeURIComponent(q.trim())}`)}>
            Als neue Sorte anlegen
          </button>
        </Empty>
      )}
    </div>
  )
}
