// Startliste bekannter Sorten. Werte sind typische Richtwerte und schwanken stark je Charge.
import type { StrainData } from './model'

type Row = [name: string, type: string, lineage: string, thc: [number, number], cbd: number, terpenes: string, aromas: string]

const ROWS: Row[] = [
  ['OG Kush', 'hybrid', 'Chemdawg × Hindu Kush (vermutet)', [19, 26], 0.3, 'myrcen limonen caryophyllen', 'kiefer diesel zitrus erdig'],
  ['Sour Diesel', 'sativa-hybrid', 'Chemdawg 91 × Super Skunk (vermutet)', [19, 25], 0.2, 'caryophyllen limonen myrcen', 'diesel zitrus kraeuter'],
  ['Blue Dream', 'sativa-hybrid', 'Blueberry × Haze', [17, 24], 0.2, 'myrcen pinen caryophyllen', 'beeren suess kraeuter'],
  ['GSC (Girl Scout Cookies)', 'hybrid', 'OG Kush × Durban Poison', [19, 28], 0.2, 'caryophyllen limonen humulen', 'gebaeck suess erdig'],
  ['Gorilla Glue #4', 'hybrid', "Chem's Sister × Sour Dubb × Chocolate Diesel", [22, 30], 0.1, 'caryophyllen myrcen limonen', 'diesel erdig kiefer kaffee'],
  ['White Widow', 'hybrid', 'Brasilianische Sativa × Südindische Indica', [17, 23], 0.2, 'myrcen caryophyllen pinen', 'holzig erdig kiefer'],
  ['Northern Lights', 'indica', 'Afghani × Thai', [16, 21], 0.2, 'myrcen caryophyllen pinen', 'erdig suess kiefer'],
  ['Amnesia Haze', 'sativa', 'Südostasien × Jamaika × Afghani × Hawaii', [20, 25], 0.2, 'terpinolen limonen caryophyllen', 'zitrus erdig kraeuter'],
  ['Super Lemon Haze', 'sativa-hybrid', 'Lemon Skunk × Super Silver Haze', [18, 25], 0.2, 'terpinolen limonen caryophyllen', 'zitrus suess kraeuter'],
  ['Jack Herer', 'sativa-hybrid', 'Haze × Northern Lights #5 × Shiva Skunk', [18, 23], 0.2, 'terpinolen pinen caryophyllen', 'kiefer holzig kraeuter'],
  ['Granddaddy Purple', 'indica', 'Purple Urkle × Big Bud', [17, 23], 0.1, 'myrcen pinen caryophyllen', 'traube beeren suess'],
  ['Wedding Cake', 'indica-hybrid', 'Triangle Kush × Animal Mints', [21, 27], 0.1, 'limonen caryophyllen myrcen', 'gebaeck vanille pfeffer erdig'],
  ['Gelato', 'hybrid', 'Sunset Sherbet × Thin Mint GSC', [20, 26], 0.1, 'caryophyllen limonen humulen', 'suess beeren sahne zitrus'],
  ['Zkittlez', 'indica-hybrid', 'Grape Ape × Grapefruit', [15, 23], 0.1, 'caryophyllen humulen linalool', 'tropisch beeren suess traube'],
  ['Runtz', 'hybrid', 'Zkittlez × Gelato', [19, 29], 0.1, 'caryophyllen limonen linalool', 'suess tropisch beeren'],
  ['Purple Haze', 'sativa', 'Purple Thai × Haze', [14, 20], 0.2, 'terpinolen myrcen caryophyllen', 'beeren erdig suess'],
  ['AK-47', 'sativa-hybrid', 'Kolumbien × Mexiko × Thai × Afghani', [17, 22], 0.3, 'myrcen pinen caryophyllen', 'erdig blumig holzig'],
  ['Skunk #1', 'hybrid', 'Afghani × Acapulco Gold × Colombian Gold', [15, 20], 0.3, 'myrcen caryophyllen humulen', 'skunk erdig suess'],
  ['Critical Mass', 'indica', 'Afghani × Skunk #1', [17, 22], 0.5, 'myrcen caryophyllen pinen', 'erdig suess skunk'],
  ['Durban Poison', 'sativa', 'Südafrikanische Landrasse', [16, 24], 0.2, 'terpinolen myrcen ocimen', 'anis kiefer erdig suess'],
  ['Bubba Kush', 'indica', 'OG Kush × unbekannte Indica', [15, 22], 0.2, 'caryophyllen limonen myrcen', 'kaffee erdig suess hasch'],
  ['Pineapple Express', 'sativa-hybrid', 'Trainwreck × Hawaiian', [17, 25], 0.2, 'caryophyllen limonen ocimen', 'tropisch zitrus kiefer'],
  ['Strawberry Cough', 'sativa-hybrid', 'Haze × Strawberry Fields (vermutet)', [15, 22], 0.1, 'myrcen pinen caryophyllen', 'beeren suess erdig'],
  ['Trainwreck', 'sativa-hybrid', 'Mexikanisch × Thai × Afghani', [17, 22], 0.2, 'terpinolen myrcen pinen', 'zitrus kiefer pfeffer'],
  ['Green Crack', 'sativa', 'Skunk #1 × Afghani (vermutet)', [16, 22], 0.1, 'myrcen caryophyllen ocimen', 'tropisch zitrus erdig'],
  ['Do-Si-Dos', 'indica-hybrid', 'Face Off OG × GSC', [22, 30], 0.1, 'limonen caryophyllen linalool', 'gebaeck minze erdig blumig'],
  ['Sunset Sherbet', 'indica-hybrid', 'GSC × Pink Panties', [18, 24], 0.1, 'caryophyllen limonen humulen', 'beeren zitrus suess sahne'],
  ['Mimosa', 'sativa-hybrid', 'Clementine × Purple Punch', [19, 27], 0.1, 'limonen myrcen caryophyllen', 'zitrus tropisch suess'],
  ['Tangie', 'sativa-hybrid', 'California Orange × Skunk #1', [19, 22], 0.2, 'terpinolen myrcen caryophyllen', 'zitrus suess kraeuter'],
  ['Chemdawg', 'hybrid', 'Unbekannt (Legende)', [15, 22], 0.2, 'caryophyllen limonen myrcen', 'diesel chemisch erdig'],
  ['Master Kush', 'indica', 'Hindu Kush × Skunk (vermutet)', [17, 22], 0.2, 'myrcen caryophyllen limonen', 'erdig hasch holzig'],
  ['Cheese', 'indica-hybrid', 'Skunk #1 Phäno (UK)', [15, 20], 0.3, 'myrcen caryophyllen pinen', 'kaese skunk erdig'],
  ['Purple Punch', 'indica', 'Larry OG × Granddaddy Purple', [18, 25], 0.1, 'caryophyllen limonen pinen', 'traube beeren vanille suess'],
  ['Ice Cream Cake', 'indica-hybrid', 'Wedding Cake × Gelato #33', [20, 26], 0.1, 'caryophyllen limonen linalool', 'vanille sahne gebaeck'],
  ['MAC (Miracle Alien Cookies)', 'hybrid', 'Alien Cookies × (Colombian × Starfighter)', [20, 28], 0.1, 'limonen caryophyllen pinen', 'zitrus blumig diesel'],
  ['Banana Kush', 'indica-hybrid', 'Ghost OG × Skunk Haze', [15, 22], 0.1, 'myrcen caryophyllen limonen', 'tropisch suess erdig'],
  ['Forbidden Fruit', 'indica', 'Cherry Pie × Tangie', [18, 26], 0.1, 'myrcen limonen pinen', 'kirsche tropisch zitrus'],
  ['Lemon Tree', 'hybrid', 'Lemon Skunk × Sour Diesel', [18, 25], 0.1, 'limonen caryophyllen myrcen', 'zitrus diesel suess'],
  ['Papaya', 'indica-hybrid', 'Citral #13 × Ice #2', [18, 25], 0.1, 'myrcen ocimen caryophyllen', 'tropisch suess erdig'],
  ['Lavender', 'indica-hybrid', 'Super Skunk × Big Skunk Korean × Afghani Hawaiian', [15, 22], 0.2, 'linalool myrcen caryophyllen', 'lavendel blumig erdig'],
  ['Harlequin', 'cbd', 'Colombian Gold × Thai × Schweizer Landrasse', [4, 8], 9, 'myrcen pinen caryophyllen', 'erdig holzig tropisch'],
  ['ACDC', 'cbd', 'Phäno von Cannatonic', [1, 6], 16, 'myrcen pinen caryophyllen', 'erdig holzig kirsche'],
  ['Cannatonic', 'cbd', 'MK Ultra × G13 Haze', [3, 7], 12, 'myrcen caryophyllen pinen', 'erdig zitrus holzig'],
  ['Hindu Kush', 'indica', 'Landrasse (Hindukusch)', [15, 20], 0.3, 'caryophyllen limonen myrcen', 'hasch erdig holzig suess'],
  ['Afghani', 'indica', 'Landrasse (Afghanistan)', [14, 19], 0.4, 'myrcen caryophyllen humulen', 'hasch erdig kraeuter'],
]

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export const STARTER_STRAINS: StrainData[] = ROWS.map(([name, type, lineage, thc, cbd, terp, aro]) => ({
  id: 's~' + slug(name),
  name,
  type,
  lineage,
  thc,
  cbd: [Math.max(0, cbd * 0.5), cbd] as [number, number],
  terpenes: terp.split(' '),
  aromas: aro.split(' '),
  t: 0,
}))
