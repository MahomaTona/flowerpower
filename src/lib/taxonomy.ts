// Alles, was man auswählt statt tippt.

export type Opt = { id: string; label: string; icon?: string; hint?: string }
export type Group = { id: string; label: string; opts: Opt[] }

export const AROMA_GROUPS: Group[] = [
  {
    id: 'frucht',
    label: 'Fruchtig',
    opts: [
      { id: 'zitrus', label: 'Zitrus', icon: '🍋' },
      { id: 'beeren', label: 'Beeren', icon: '🫐' },
      { id: 'tropisch', label: 'Tropisch', icon: '🥭' },
      { id: 'traube', label: 'Traube', icon: '🍇' },
      { id: 'apfel', label: 'Apfel/Birne', icon: '🍏' },
      { id: 'kirsche', label: 'Kirsche', icon: '🍒' },
    ],
  },
  {
    id: 'suess',
    label: 'Süß',
    opts: [
      { id: 'suess', label: 'Süß', icon: '🍬' },
      { id: 'honig', label: 'Honig', icon: '🍯' },
      { id: 'vanille', label: 'Vanille', icon: '🍦' },
      { id: 'gebaeck', label: 'Gebäck/Teig', icon: '🍪' },
      { id: 'sahne', label: 'Sahnig', icon: '🥛' },
    ],
  },
  {
    id: 'erdig',
    label: 'Erdig & Holzig',
    opts: [
      { id: 'erdig', label: 'Erdig', icon: '🟤' },
      { id: 'holzig', label: 'Holzig', icon: '🪵' },
      { id: 'moschus', label: 'Moschus', icon: '🍂' },
      { id: 'kaffee', label: 'Kaffee/Kakao', icon: '☕' },
      { id: 'hasch', label: 'Hasch/Würzig-warm', icon: '🟫' },
    ],
  },
  {
    id: 'kraeuter',
    label: 'Würzig & Kräuter',
    opts: [
      { id: 'pfeffer', label: 'Pfeffer', icon: '🌶️' },
      { id: 'kraeuter', label: 'Kräuter', icon: '🌿' },
      { id: 'minze', label: 'Minze', icon: '🍃' },
      { id: 'anis', label: 'Anis/Lakritz', icon: '⭐' },
      { id: 'zimt', label: 'Zimt/Nelke', icon: '🟠' },
    ],
  },
  {
    id: 'gruen',
    label: 'Frisch & Blumig',
    opts: [
      { id: 'kiefer', label: 'Kiefer', icon: '🌲' },
      { id: 'gras', label: 'Gras/Heu', icon: '🌾' },
      { id: 'blumig', label: 'Blumig', icon: '🌸' },
      { id: 'lavendel', label: 'Lavendel', icon: '💜' },
    ],
  },
  {
    id: 'gas',
    label: 'Gas & Funk',
    opts: [
      { id: 'diesel', label: 'Diesel/Gas', icon: '⛽' },
      { id: 'skunk', label: 'Skunk', icon: '🦨' },
      { id: 'kaese', label: 'Käse', icon: '🧀' },
      { id: 'chemisch', label: 'Chemisch', icon: '🧪' },
      { id: 'knoblauch', label: 'Knoblauch/Zwiebel', icon: '🧄' },
    ],
  },
]

export const AROMAS: Opt[] = AROMA_GROUPS.flatMap((g) => g.opts)

export const EFFECTS: Opt[] = [
  { id: 'entspannt', label: 'Entspannt', icon: '😌' },
  { id: 'euphorisch', label: 'Euphorisch', icon: '🤩' },
  { id: 'gluecklich', label: 'Glücklich', icon: '😊' },
  { id: 'kreativ', label: 'Kreativ', icon: '🎨' },
  { id: 'fokussiert', label: 'Fokussiert', icon: '🎯' },
  { id: 'gespraechig', label: 'Gesprächig', icon: '💬' },
  { id: 'energie', label: 'Energiegeladen', icon: '⚡' },
  { id: 'kribbelig', label: 'Kribbelnd', icon: '✨' },
  { id: 'koerper', label: 'Körperlich schwer', icon: '🛋️' },
  { id: 'kopf', label: 'Kopflastig', icon: '🧠' },
  { id: 'muede', label: 'Schläfrig', icon: '😴' },
  { id: 'hunger', label: 'Hungrig', icon: '🍕' },
  { id: 'schmerz', label: 'Schmerzlindernd', icon: '🩹' },
]

export const SIDE_EFFECTS: Opt[] = [
  { id: 'mund', label: 'Trockener Mund', icon: '🏜️' },
  { id: 'augen', label: 'Trockene Augen', icon: '👁️' },
  { id: 'unruhe', label: 'Unruhe', icon: '😬' },
  { id: 'paranoia', label: 'Paranoid', icon: '😰' },
  { id: 'kopfweh', label: 'Kopfschmerz', icon: '🤕' },
  { id: 'schwindel', label: 'Schwindel', icon: '😵‍💫' },
]

export const ALL_EFFECTS = [...EFFECTS, ...SIDE_EFFECTS]
export const EFFECT_LEVELS = ['', 'leicht', 'deutlich', 'stark']

export const TERPENES: Opt[] = [
  { id: 'myrcen', label: 'Myrcen', hint: 'erdig, moschus, Mango – oft entspannend' },
  { id: 'limonen', label: 'Limonen', hint: 'Zitrus – oft stimmungshebend' },
  { id: 'caryophyllen', label: 'β-Caryophyllen', hint: 'Pfeffer, Gewürz' },
  { id: 'pinen', label: 'Pinen', hint: 'Kiefer, Rosmarin – oft klärend' },
  { id: 'linalool', label: 'Linalool', hint: 'Lavendel, blumig – oft beruhigend' },
  { id: 'humulen', label: 'Humulen', hint: 'Hopfen, holzig' },
  { id: 'terpinolen', label: 'Terpinolen', hint: 'frisch, Kräuter, Apfel' },
  { id: 'ocimen', label: 'Ocimen', hint: 'süß, Kräuter, Holz' },
  { id: 'bisabolol', label: 'Bisabolol', hint: 'Kamille, blumig-süß' },
  { id: 'nerolidol', label: 'Nerolidol', hint: 'holzig, Rinde' },
]

export const STRAIN_TYPES: Opt[] = [
  { id: 'indica', label: 'Indica', icon: '🌙' },
  { id: 'indica-hybrid', label: 'Hybrid (Indica-dominant)', icon: '🌗' },
  { id: 'hybrid', label: 'Hybrid', icon: '☯️' },
  { id: 'sativa-hybrid', label: 'Hybrid (Sativa-dominant)', icon: '🌓' },
  { id: 'sativa', label: 'Sativa', icon: '☀️' },
  { id: 'cbd', label: 'CBD-reich', icon: '💧' },
]

export const FORMS: Opt[] = [
  { id: 'joint', label: 'Joint', icon: '🚬' },
  { id: 'pfeife', label: 'Pfeife', icon: '🪈' },
  { id: 'bong', label: 'Bong', icon: '🫙' },
  { id: 'vape', label: 'Vaporizer (Blüte)', icon: '♨️' },
  { id: 'vape-extrakt', label: 'Vaporizer (Extrakt)', icon: '💨' },
  { id: 'dab', label: 'Dab', icon: '🔥' },
  { id: 'edible', label: 'Edible', icon: '🧁' },
  { id: 'oel', label: 'Öl/Tinktur', icon: '💧' },
]

export const COMBUSTION = new Set(['joint', 'pfeife', 'bong'])
export const VAPE = new Set(['vape', 'vape-extrakt'])

export const SOURCES: Opt[] = [
  { id: 'verein', label: 'Anbauvereinigung', icon: '🏡' },
  { id: 'apotheke', label: 'Apotheke', icon: '⚕️' },
  { id: 'eigen', label: 'Eigenanbau', icon: '🪴' },
  { id: 'weitergabe', label: 'Von Freunden', icon: '🤝' },
  { id: 'sonstige', label: 'Sonstige', icon: '📦' },
]

/** Slider 1–5. Bei 'curing' ist 3 ideal. */
export const QUALITY: { id: string; label: string; low: string; high: string }[] = [
  { id: 'frost', label: 'Trichome / Frost', low: 'kaum', high: 'zuckrig' },
  { id: 'dichte', label: 'Dichte', low: 'luftig', high: 'steinhart' },
  { id: 'curing', label: 'Feuchte / Curing', low: 'zu trocken', high: 'zu feucht' },
  { id: 'smooth', label: 'Sanftheit', low: 'kratzig', high: 'samtig' },
  { id: 'nachhall', label: 'Nachhall', low: 'kurz', high: 'lang' },
]

export const BURN: Opt[] = [
  { id: 'gleichmaessig', label: 'Gleichmäßig' },
  { id: 'okay', label: 'Okay' },
  { id: 'ungleich', label: 'Ungleich/geht aus' },
]

export const ASH: Opt[] = [
  { id: 'weiss', label: 'Weiß', icon: '⚪' },
  { id: 'grau', label: 'Grau', icon: '🔘' },
  { id: 'dunkel', label: 'Dunkel', icon: '⚫' },
]

export const REACTIONS = ['🔥', '😍', '🌿', '😴', '🤯', '👍', '🤔']

export const AVATARS = ['🌸', '🌻', '🌺', '🌼', '🍁', '🌿', '🍄', '🌵', '🦋', '🐝', '🦉', '🦊', '🐸', '🐢', '🐙', '🦄', '🌙', '⭐', '🔮', '🎨', '🎸', '🧘', '🌊', '🍇']

export const optLabel = (list: Opt[], id: string | undefined) => list.find((o) => o.id === id)?.label ?? id ?? ''
export const opt = (list: Opt[], id: string | undefined) => list.find((o) => o.id === id)
