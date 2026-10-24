// Bewertung anlegen/bearbeiten – fast alles per Antippen.
import { useState } from 'preact/hooks'
import { me as meSig, pPhotos, pPrivate } from '../lib/app'
import { randomId, sha256hex } from '../lib/crypto'
import { compressImage, photoUrl } from '../lib/image'
import { ownKey, type RatingData } from '../lib/model'
import { ASH, AROMA_GROUPS, BURN, COMBUSTION, EFFECTS, FORMS, QUALITY, SIDE_EFFECTS, SOURCES, VAPE } from '../lib/taxonomy'
import { ChipSelect, Empty, Icon, LevelChips, PageHead, PhotoInput, Seg, SingleSelect, Slider, Stars, back, go, route, strainIcon, toast } from './kit'
import { useData } from './data'

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
  const isGroup = share === 'gruppe' && !!d.rt

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
      toast(existing ? 'Bewertung aktualisiert' : isGroup ? 'Mit der Gruppe geteilt' : 'Privat gespeichert')
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
      <PageHead title={existing ? 'Bewertung bearbeiten' : 'Bewerten'} backTo />
      {session && <div class="banner mb">🍷 Live-Tasting – deine Bewertung bleibt verdeckt, bis aufgedeckt wird.</div>}
      <div class="card row">
        <span class="strain-ico">{strainIcon(strain.type)}</span>
        <b class="grow">{strain.name}</b>
        {!session && !existing && (
          <button class="btn sm ghost" onClick={() => setStrainId(undefined)}>
            Ändern
          </button>
        )}
      </div>

      <Section title="Wann & woher">
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

      <Section title="Konsumform">
        <SingleSelect opts={FORMS} value={form} onChange={setForm} />
        {form && VAPE.has(form) && (
          <div class="mt">
            <Slider label="Temperatur" low="150 °C" high="230 °C" min={150} max={230} step={5} value={vapeTemp} onChange={setVapeTemp} fmt={(v) => `${v} °C`} />
          </div>
        )}
      </Section>

      <Section title="Optik & Qualität">
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

      <Section title="Geruch">
        {AROMA_GROUPS.map((g) => (
          <>
            <div class="chipgroup-label">{g.label}</div>
            <ChipSelect opts={g.opts} value={aromas} onChange={setAromas} />
          </>
        ))}
      </Section>

      <Section
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

      <Section title="Wirkung">
        <p class="tiny muted">Mehrmals tippen für die Stärke: leicht → deutlich → stark → aus.</p>
        <LevelChips opts={EFFECTS} value={effects} onChange={setEffects} />
        <div class="chipgroup-label">Nebenwirkungen</div>
        <LevelChips opts={SIDE_EFFECTS} value={effects} onChange={setEffects} />
      </Section>

      <Section title="Gesamteindruck">
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

      {d.rt && !session && (
        <Section title="Sichtbar für">
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

      <div class="stack mt" style={{ position: 'sticky', bottom: 'calc(84px + env(safe-area-inset-bottom))' }}>
        <button class="btn primary block" disabled={!overall || busy} onClick={save}>
          {overall ? (busy ? 'Speichere …' : 'Speichern') : 'Bitte Sterne vergeben'}
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

function Section({ title, right, children }: { title: string; right?: preact.ComponentChildren; children: preact.ComponentChildren }) {
  return (
    <div class="section">
      <div class="row between">
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
  const recent = [...new Set(d.mine.map((r) => r.strainId))].slice(0, 6).map((id) => d.strainMap.get(id)).filter(Boolean)
  const ql = q.trim().toLowerCase()
  const list = ql ? d.strains.filter((s) => s.name.toLowerCase().includes(ql)).slice(0, 12) : []
  return (
    <div class="content">
      <PageHead title="Welche Sorte?" backTo />
      <input class="input" type="search" autoFocus placeholder="Sorte suchen …" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      {!ql && recent.length > 0 && (
        <>
          <div class="chipgroup-label">Zuletzt bewertet</div>
          <div class="chips">
            {recent.map((s) => (
              <button class="chip" onClick={() => onPick(s!.id)}>
                {strainIcon(s!.type)} {s!.name}
              </button>
            ))}
          </div>
        </>
      )}
      {!ql && (
        <>
          <div class="chipgroup-label">Alle Sorten</div>
          <div class="chips">
            {d.strains.slice(0, 60).map((s) => (
              <button class="chip" onClick={() => onPick(s.id)}>
                {strainIcon(s.type)} {s.name}
              </button>
            ))}
          </div>
        </>
      )}
      {ql && (
        <div class="list mt">
          {list.map((s) => (
            <button class="card link strain-row" style={{ textAlign: 'left', width: '100%' }} onClick={() => onPick(s.id)}>
              <span class="strain-ico">{strainIcon(s.type)}</span>
              <b class="grow">{s.name}</b>
            </button>
          ))}
          {!list.length && (
            <Empty icon="🌱">
              <p>„{q.trim()}“ ist noch nicht in der Liste.</p>
              <button class="btn primary" onClick={() => go(`/strain-new?name=${encodeURIComponent(q.trim())}`)}>
                Als neue Sorte anlegen
              </button>
            </Empty>
          )}
        </div>
      )}
    </div>
  )
}
