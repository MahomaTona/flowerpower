# 🌸 FlowerPower

Ein Connoisseur-Notizbuch für Cannabis – für Freundeskreise und Vereine.
**Kein Server, kein Konto:** GitHub Pages liefert nur die leere App, alle Daten bleiben auf euren Geräten
und werden direkt zwischen euch per WebRTC abgeglichen.

## Was die App kann

- **Sorten-Datenbank** mit ~45 bekannten Sorten (Genetik, THC/CBD, Terpene, Aromen) – die Gruppe ergänzt eigene
- **Bewerten per Antippen:** Bezugsquelle & Charge, Konsumform (Vaporizer mit Temperatur), Optik & Qualität,
  Geruch/Geschmack aus einem Aromarad, Wirkungen mit Stärke, Sterne, Foto
- **Gruppen-Feed** mit Reaktionen und kurzen Kommentaren
- **Live-Tasting:** alle bewerten verdeckt dieselbe Sorte, der Host deckt auf
- **Vergleich** als Radar-Diagramm (pro Sorte, pro Person, mehrere Sorten nebeneinander)
- **Merkliste** und **Empfehlungen** nach deinem Geschmacksprofil
- **Privat oder Gruppe** – jede Bewertung einzeln wählbar (Standard: Gruppe)
- **4 Themes:** Cuvée (edel/dunkel), Leinen (hell/clean), Flower Power (bunt), Mitternacht (OLED)
- **Diskreter Modus:** PIN-Sperre, verschlüsselte Daten, neutraler Name „Notizen“ und neutrales Icon
- **Mehrere eigene Geräte** per QR-Code koppeln, **verschlüsselte Sicherungsdatei**
- **Treffen:** Tasting-Abende vorschlagen (Datum, Ort, geplante Sorten), zu-/absagen, Mitbring-Liste,
  Kalender-Export (.ics) – aus einer geplanten Sorte startet per Tipp das Live-Tasting
- **Wartebereich:** Wer nur das Passwort kennt, bleibt unsichtbar, bis ein Mitglied ihn freigibt
- **Admins** können Beiträge ausblenden, Mitglieder stummschalten oder sofort entfernen
- **Abstimmungen:** Jedes Mitglied kann abstimmen lassen (entfernen, stummschalten, ausblenden) –
  angenommen mit ⅔ der Abstimmenden nach 48 h (mind. 3 Stimmen) oder sofort bei ⅔ aller Mitglieder
- **Melden-Knopf** an jedem Beitrag, Meldungsliste für Admins
- Wird jemand entfernt oder abgelehnt, zieht die Gruppe automatisch in einen neuen, geheimen Raum um –
  das alte Passwort ist danach wertlos
- Installierbar als App (PWA), funktioniert offline

## So funktioniert die Verbindung

1. Gruppenname + Passwort ergeben eine geheime Raum-ID.
2. Zum ersten Kennenlernen nutzen die Geräte öffentliche **Nostr-Relays** (über die Bibliothek
   [Trystero](https://github.com/dmotz/trystero)). Was dort durchläuft, ist mit dem Gruppenpasswort verschlüsselt.
3. Danach laufen alle Daten **direkt und Ende-zu-Ende-verschlüsselt** per WebRTC von Gerät zu Gerät.
4. Der Abgleich nutzt [Yjs](https://yjs.dev) (CRDT): Wer online ist, gibt Neues weiter, Konflikte lösen sich von selbst.
5. Jeder Eintrag ist mit dem persönlichen Schlüssel des Autors **signiert** – niemand kann sich als jemand anderes ausgeben.

Lokal liegen alle Daten in IndexedDB, verschlüsselt mit einem Schlüssel, den nur deine PIN öffnet.

**Grenzen, die man kennen sollte**
- Ist gerade niemand aus der Gruppe online, kommen neue Einträge erst an, wenn sich zwei Geräte gleichzeitig sehen.
- In seltenen Netzen (manche Firmen-/Mobilfunknetze) klappt WebRTC ohne TURN-Server nicht.
- Eine 6-stellige PIN schützt vor neugierigen Blicken, nicht vor jemandem, der das Gerät forensisch untersucht.
- Wer das Gruppenpasswort hat, landet im Wartebereich – kann aber mitlesen, bis ihr ihn ablehnt und damit umzieht.
- Regeln (Rollen, Abstimmungen) wertet jedes Gerät selbst aus. Wer die App manipuliert, kann sich lokal anders verhalten,
  aber keine fremden Einträge fälschen und keine anderen Geräte überstimmen.

## Auf GitHub veröffentlichen

1. Auf [github.com](https://github.com) ein Konto anlegen und ein **neues, leeres Repository** erstellen (z. B. `flowerpower`).
2. Diesen Ordner hochladen:
   ```bash
   git remote add origin https://github.com/DEIN-NAME/flowerpower.git
   git push -u origin main
   ```
3. Im Repository: **Settings → Pages → Build and deployment → Source: „GitHub Actions“**.
4. Nach ein bis zwei Minuten läuft die App unter `https://DEIN-NAME.github.io/flowerpower/`.

Jeder weitere Push auf `main` veröffentlicht automatisch die neue Version
(siehe [.github/workflows/deploy.yml](.github/workflows/deploy.yml)).

## Lokal entwickeln

```bash
npm install
npm run dev
```

Zum Testen mit mehreren Nutzern im selben Browser: `?p=anna` bzw. `?p=ben` an die Adresse hängen –
jedes Profil hat seinen eigenen Speicher.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `src/lib/crypto.ts` | AES-GCM, ECDSA-Signaturen, ECDH-Versiegelung |
| `src/lib/vault.ts` | PIN-Sperre, Identität, signierte Einträge |
| `src/lib/store.ts` | Verschlüsselter Speicher (IndexedDB) |
| `src/lib/sync.ts` | WebRTC-Abgleich (Trystero) + Tabs (BroadcastChannel) |
| `src/lib/model.ts` | Gruppen-Datenmodell, Signaturprüfung, Rollen |
| `src/lib/app.ts` | Gruppen, Geräte-Kopplung, Backup, Schlüsselwechsel |
| `src/lib/strains.ts` | Startliste der Sorten |
| `src/lib/taxonomy.ts` | Aromen, Wirkungen, Terpene, Konsumformen … |
| `src/lib/insights.ts` | Statistik, Geschmacksprofil, Empfehlungen |
| `src/ui/*` | Oberfläche (Preact) |
