# Catalogo scene

Generato da `npm run catalog` a partire dagli schemi (zod) delle scene in `engine/scenes/`: non modificare a mano. La versione per il regista è `CATALOGO.json`.

Contratto di ogni scena: funzione pura `render(props, t, ctx) → HTML` (nessuno stato, nessun `Date.now`/`Math.random`), tempo locale `t` in secondi, `ctx` con formato, safe area e durata dello shot. Funziona in 9:16 e 16:9. Testo ≥ 36 px (≥ 28 px in 16:9), dentro la safe area; solo token del brand (Playfair Display + Inter, mai `#000000`).

Le **durate** qui sotto sono calcolate con le props d'esempio; con altre props cambiano (regola nella scheda). "Minima" = testo leggibile (1,2 s + 0,30 s a parola, minimo 2 s, fermo almeno 1,5 s) e animazioni completate; "consigliata" = respiro in più.

| Scena | Mockup | Minima | Consigliata |
|---|---|---|---|
| [TitleCard](#titlecard) | no | 5,5 s | 6,5 s |
| [HookText](#hooktext) | no | 5 s | 5,5 s |
| [ChatChaos](#chatchaos) | sì | 6,5 s | 8 s |
| [SpreadsheetChaos](#spreadsheetchaos) | sì | 3,5 s | 5,5 s |
| [PhoneMockupSite](#phonemockupsite) | sì | 5,5 s | 6,5 s |
| [RsvpFlow](#rsvpflow) | sì | 7,5 s | 9 s |
| [GuestDashboard](#guestdashboard) | sì | 7 s | 8,5 s |
| [GiftFundCard](#giftfundcard) | sì | 5 s | 6 s |
| [TableSeating](#tableseating) | sì | 6 s | 7,5 s |
| [PlanningChecklist](#planningchecklist) | sì | 6 s | 7,5 s |
| [PriceCard](#pricecard) | no | 4 s | 6 s |
| [KineticList](#kineticlist) | no | 5,5 s | 7,5 s |
| [EndCard](#endcard) | no | 4 s | 5 s |

## TitleCard

Titolo centrato con sottotitolo su sfondo hero con orbi ambientali.

- **Durata**: minima **5,5 s**, consigliata **6,5 s** (props d'esempio).
- **Come scala**: max(testo leggibile, ultima entrata + 1,5 s): con sottotitolo l'ultima entrata è a 1,7 s.
- **Mockup**: no.
- **Cue audio**: nessuno.
- **Fotogramma di prova**: `out/_test/scenes/TitleCard-9x16.png` e `TitleCard-16x9.png` (t = 2.6 s).

| Prop | Tipo | Obbligatoria | Default | Descrizione |
|---|---|---|---|---|
| `eyebrow` | testo (≤ 40 car.) | no | — | Etichetta sopra il titolo (Inter 600, maiuscolo, champagne) |
| `title` | testo (≤ 80 car.) | sì | — | Titolo in Playfair Display. `*parola*` = corsivo, `\n` = a capo |
| `subtitle` | testo (≤ 120 car.) | no | — | Sottotitolo in Inter, colore muted |
| `shimmer` | testo | no | — | Sottostringa del titolo con sfumatura shimmer. Al massimo una per video |

Props d'esempio:

```json
{
  "eyebrow": "MatrimonioSemplice",
  "title": "Il tuo sito matrimonio\n*in pochi minuti.*",
  "subtitle": "Conferme semplici, lista nozze senza commissioni."
}
```

> Lo shimmer va usato su una sola headline per video (BRAND_VIDEO §2).
> Titolo: massimo 80 caratteri, circa 3 righe in 9:16.

## HookText

Gancio: eyebrow + headline Playfair che entra parola per parola, riga di supporto opzionale.

- **Durata**: minima **5 s**, consigliata **5,5 s** (props d'esempio).
- **Come scala**: parole a 0,1 s l'una dal secondo 0,3; poi + 1,5 s di pausa. Con `sub`, +0,7 s.
- **Mockup**: no.
- **Cue audio**: nessuno.
- **Fotogramma di prova**: `out/_test/scenes/HookText-9x16.png` e `HookText-16x9.png` (t = 2.6 s).

| Prop | Tipo | Obbligatoria | Default | Descrizione |
|---|---|---|---|---|
| `eyebrow` | testo (≤ 40 car.) | no | — | Etichetta sopra il gancio |
| `headline` | testo (≤ 70 car.) | sì | — | Gancio in Playfair Display, entra parola per parola. `*parola*` = corsivo, `\n` = a capo |
| `sub` | testo (≤ 100 car.) | no | — | Riga di supporto in Inter, muted |
| `shimmer` | testo | no | — | Sottostringa della headline con sfumatura shimmer. Al massimo una per video |
| `align` | "left" \| "center" | no | `"left"` | Allineamento del testo |

Props d'esempio:

```json
{
  "eyebrow": "RSVP",
  "headline": "Niente app.\nNiente *account.*",
  "sub": "Gli invitati confermano dal link del sito."
}
```

> Gancio da 3-6 parole: 2,5-3 s. Massimo 2 righe di testo corrente per inquadratura.

## ChatChaos

Chat di gruppo generica che si riempie di messaggi sovrapposti (il caos delle conferme).

- **Durata**: minima **6,5 s**, consigliata **8 s** (props d'esempio).
- **Come scala**: 0,9 s + messaggi × passo (0,3 / 0,42 / 0,6 s per densità alta / media / bassa) + 1,5 s.
- **Mockup**: sì, interfaccia ricreata in codice con dati fittizi (`mockup: true`, testi `source: mock`).
- **Cue audio**: ping.
- **Fotogramma di prova**: `out/_test/scenes/ChatChaos-9x16.png` e `ChatChaos-16x9.png` (t = 5.4 s).

| Prop | Tipo | Obbligatoria | Default | Descrizione |
|---|---|---|---|---|
| `title` | testo (≤ 30 car.) | no | `"Gruppo Matrimonio"` | Nome della chat (dato fittizio) |
| `messages` | { text: testo (≤ 40 car.); side: "l" \| "r" }[] (3–16) | no | `[{"text":"ci sono","side":"r"},{"text":"forse","side":"l"},{"text":"n…` | Messaggi in ordine di arrivo (fittizi). `l` = sinistra, `r` = destra |
| `density` | "bassa" \| "media" \| "alta" | no | `"alta"` | Quanto si sovrappongono e quanto in fretta arrivano |
| `headline` | testo (≤ 60 car.) | no | — | Titolo sopra la chat (Playfair) |

Props d'esempio:

```json
{
  "headline": "Dal caos delle\nconferme…"
}
```

> Messaggi e nomi sono fittizi: nello storyboard vanno con `source: mock`.
> Le bolle si sovrappongono di proposito ma con la stessa dolcezza del resto: niente flash, niente scossoni.

## SpreadsheetChaos

Foglio di calcolo disordinato (celle evidenziate a caso, note a margine) che scorre lentamente.

- **Durata**: minima **3,5 s**, consigliata **5,5 s** (props d'esempio).
- **Come scala**: minimo 3 s; con `caption` 3,1 s. Più lungo = scorrimento più lento (copre al massimo 1250 px).
- **Mockup**: sì, interfaccia ricreata in codice con dati fittizi (`mockup: true`, testi `source: mock`).
- **Cue audio**: key.
- **Fotogramma di prova**: `out/_test/scenes/SpreadsheetChaos-9x16.png` e `SpreadsheetChaos-16x9.png` (t = 4.2 s).

| Prop | Tipo | Obbligatoria | Default | Descrizione |
|---|---|---|---|---|
| `title` | testo (≤ 30 car.) | no | `"Invitati_FINALE_v3"` | Nome del file (dato fittizio) |
| `columns` | testo (≤ 14 car.)[] (2–5) | no | `["Nome","Menu","Allergie","+1"]` | Intestazioni di colonna (fittizie) |
| `rows` | testo (≤ 18 car.)[][] (8–∞) | no | `[["Anna R.","carne","noci!!","1?"],["Luca B","pesce","","no"],["Sara"…` | Righe di celle (fittizie), una cella per colonna |
| `caption` | testo (≤ 70 car.) | no | — | Didascalia in card sopra il foglio (Inter) |

Props d'esempio:

```json
{
  "caption": "Menu, allergie, +1…\novunque."
}
```

> Dati del foglio tutti fittizi (`source: mock`).
> Lo scorrimento si adatta alla durata dello shot: copre al massimo 1250 px.

## PhoneMockupSite

Telefono con il sito matrimonio (testata, storia, programma...) che scorre lentamente. Dati fittizi.

- **Durata**: minima **5,5 s**, consigliata **6,5 s** (props d'esempio).
- **Come scala**: 1,2 s + (altezza da scorrere ÷ 240 px/s) + 1,2 s; minimo 4 s. Ogni sezione in più allunga di circa 1,5 s.
- **Mockup**: sì, interfaccia ricreata in codice con dati fittizi (`mockup: true`, testi `source: mock`).
- **Cue audio**: nessuno.
- **Fotogramma di prova**: `out/_test/scenes/PhoneMockupSite-9x16.png` e `PhoneMockupSite-16x9.png` (t = 3.4 s).

| Prop | Tipo | Obbligatoria | Default | Descrizione |
|---|---|---|---|---|
| `names` | [testo (≤ 16 car.), testo (≤ 16 car.)] | no | `["Giulia","Marco"]` | Nomi della coppia (fittizi) |
| `date` | testo (≤ 24 car.) | no | `"12 settembre"` | Data (fittizia) |
| `place` | testo (≤ 40 car.) | no | `"Villa dei Cipressi · Toscana"` | Luogo (fittizio) |
| `sections` | "storia" \| "programma" \| "galleria" \| "fondoRegalo" \| "countdown" \| "viaggio" \| "rsvp"[] (1–4) | no | `["storia","programma","rsvp"]` | Sezioni del sito mostrate scorrendo, in ordine |
| `eyebrow` | testo (≤ 40 car.) | no | — | Etichetta sopra la headline |
| `headline` | testo (≤ 60 car.) | no | — | Didascalia accanto al telefono (Playfair) |
| `shimmer` | testo | no | — | Sottostringa della headline con shimmer. Al massimo una per video |

Props d'esempio:

```json
{
  "headline": "Il tuo sito matrimonio,\npronto in pochi minuti.",
  "sections": [
    "storia",
    "programma",
    "rsvp"
  ]
}
```

> Nomi, data e luogo sono fittizi (`source: mock`).
> Sezioni disponibili: storia, programma, galleria, fondoRegalo, countdown, viaggio, rsvp. Il fondo regalo dice solo "lista nozze senza commissioni".

## RsvpFlow

Telefono: l'invitato apre il sito, tocca la presenza, compila il modulo e conferma. Nessun account.

- **Durata**: minima **7,5 s**, consigliata **9 s** (props d'esempio).
- **Come scala**: fisso: tre tap a 1,5 / 3,0 / 4,3 s, conferma a 5,6 s + 1,5 s di pausa.
- **Mockup**: sì, interfaccia ricreata in codice con dati fittizi (`mockup: true`, testi `source: mock`).
- **Cue audio**: tap, chime.
- **Fotogramma di prova**: `out/_test/scenes/RsvpFlow-9x16.png` e `RsvpFlow-16x9.png` (t = 3.6 s).

| Prop | Tipo | Obbligatoria | Default | Descrizione |
|---|---|---|---|---|
| `names` | [testo (≤ 16 car.), testo (≤ 16 car.)] | no | `["Giulia","Marco"]` | Nomi della coppia (fittizi) |
| `date` | testo (≤ 24 car.) | no | `"12 settembre"` | Data (fittizia) |
| `place` | testo (≤ 40 car.) | no | `"Villa dei Cipressi · Toscana"` | Luogo (fittizio) |
| `guestName` | testo (≤ 24 car.) | no | `"Anna Rossi"` | Nome dell'invitato che conferma (fittizio) |
| `fields` | "menu" \| "accompagnatore" \| "allergie"[] (0–2) | no | `["menu","accompagnatore"]` | Campi del modulo oltre a nome e presenza (massimo 2) |
| `menuChoice` | testo (≤ 20 car.) | no | `"Vegetariano"` | Scelta di menu mostrata (fittizia) |
| `eyebrow` | testo (≤ 40 car.) | no | — | Etichetta sopra la headline |
| `headline` | testo (≤ 60 car.) | no | — | Didascalia accanto al telefono (Playfair) |
| `shimmer` | testo | no | — | Sottostringa della headline con shimmer. Al massimo una per video |

Props d'esempio:

```json
{
  "headline": "Pochi tap,\nnessun account."
}
```

> Tre tap con onda blush: presenza, "Ci sarò", "Invia conferma". Nessun campo password o login, per costruzione.
> Nome dell'invitato e dati sono fittizi (`source: mock`).

## GuestDashboard

Dashboard invitati: il contatore delle conferme sale e le righe si ordinano per stato. Dati fittizi.

- **Durata**: minima **7 s**, consigliata **8,5 s** (props d'esempio).
- **Come scala**: ultima conferma (1,4 s + 0,9 s × conferme) + 1,1 s di riordino + 1,5 s; minimo 4 s.
- **Mockup**: sì, interfaccia ricreata in codice con dati fittizi (`mockup: true`, testi `source: mock`).
- **Cue audio**: tick, sort.
- **Fotogramma di prova**: `out/_test/scenes/GuestDashboard-9x16.png` e `GuestDashboard-16x9.png` (t = 5.6 s).

| Prop | Tipo | Obbligatoria | Default | Descrizione |
|---|---|---|---|---|
| `eyebrow` | testo (≤ 40 car.) | no | — | Etichetta sopra la headline (es. nomi della coppia, fittizi) |
| `headline` | testo (≤ 60 car.) | no | — | Titolo sopra il contatore (Playfair) |
| `counterLabel` | testo (≤ 20 car.) | no | `"Conferme"` | Etichetta del contatore |
| `guests` | { name: testo (≤ 24 car.); status: "confermato" \| "in_attesa" \| "non_puo"; note: testo (≤ 40 car.); confirmedNote?: testo (≤ 40 car.) }[] (4–8) | no | `[{"name":"Luca Bianchi","status":"in_attesa","note":"In attesa di ris…` | Invitati (fittizi). `confirmedNote` = nota che compare quando un invitato in attesa conferma |
| `confirmCount` | intero 0–6 | no | `4` | Quanti invitati in attesa confermano durante la scena |

Props d'esempio:

```json
{
  "eyebrow": "Giulia & Marco",
  "headline": "Le conferme si ordinano\nda sole."
}
```

> Invitati, note e conteggi sono fittizi (`source: mock`).
> Il contatore parte dai confermati di `guests` e sale di uno a ogni conferma; massimo 8 invitati.

## GiftFundCard

Sezione fondo regalo: l'IBAN (segnaposto grafico, mai reale) si copia con un tap e compare il grazie.

- **Durata**: minima **5 s**, consigliata **6 s** (props d'esempio).
- **Come scala**: tap a 1,9 s, ringraziamento a 2,4 s + 0,7 s + 1,5 s.
- **Mockup**: sì, interfaccia ricreata in codice con dati fittizi (`mockup: true`, testi `source: mock`).
- **Cue audio**: tap, copy, chime.
- **Fotogramma di prova**: `out/_test/scenes/GiftFundCard-9x16.png` e `GiftFundCard-16x9.png` (t = 3.8 s).

| Prop | Tipo | Obbligatoria | Default | Descrizione |
|---|---|---|---|---|
| `headline` | testo (≤ 60 car.) | no | — | Titolo sopra la card (Playfair). Dire solo: lista nozze senza commissioni, bonifico diretto |
| `title` | testo (≤ 24 car.) | no | `"Fondo regalo"` | Titolo della card |
| `subtitle` | testo (≤ 40 car.) | no | `"Bonifico diretto"` | Riga sotto il titolo |
| `copyLabel` | testo (≤ 20 car.) | no | `"Copia IBAN"` | Etichetta del bottone prima del tap |
| `copiedLabel` | testo (≤ 20 car.) | no | `"Copiato"` | Etichetta del bottone dopo il tap |
| `thankYou` | testo (≤ 40 car.) | no | `"Grazie di cuore!"` | Messaggio di ringraziamento che compare dopo la copia |

Props d'esempio:

```json
{
  "headline": "Lista nozze\nsenza commissioni."
}
```

> L'IBAN è sempre un segnaposto grafico (puntini): non esiste modo di mostrare un IBAN reale.
> Claim ammesso: lista nozze / fondo regalo senza commissioni, bonifico diretto (PRODOTTO_FATTI).

## TableSeating

Piantina della sala: gli invitati vengono trascinati dai tavoli ai posti. Etichetta Premium sempre visibile.

- **Durata**: minima **6 s**, consigliata **7,5 s** (props d'esempio).
- **Come scala**: 1,0 s + invitati × 0,55 s + 0,6 s di trascinamento + 1,5 s; minimo 4 s.
- **Mockup**: sì, interfaccia ricreata in codice con dati fittizi (`mockup: true`, testi `source: mock`).
- **Cue audio**: drop.
- **Fotogramma di prova**: `out/_test/scenes/TableSeating-9x16.png` e `TableSeating-16x9.png` (t = 3.6 s).

| Prop | Tipo | Obbligatoria | Default | Descrizione |
|---|---|---|---|---|
| `headline` | testo (≤ 60 car.) | no | — | Titolo accanto alla piantina (Playfair) |
| `tables` | { label: testo (≤ 14 car.); seats: intero 4–8 }[] (2–6) | no | `[{"label":"Tavolo 1","seats":6},{"label":"Tavolo 2","seats":6},{"labe…` | Tavoli della sala (etichette fittizie) e numero di posti |
| `guests` | testo (≤ 12 car.)[] (2–12) | no | `["Anna","Luca","Sara","Paolo","Elena","Davide"]` | Nomi degli invitati da sistemare (fittizi) |

Props d'esempio:

```json
{
  "headline": "Il piano tavoli,\ncon drag and drop."
}
```

> Il piano tavoli è Premium: l'etichetta Premium è sempre mostrata, non si può togliere (decisione 13).
> Nomi e tavoli sono fittizi (`source: mock`). Massimo 12 invitati e 6 tavoli.

## PlanningChecklist

Planning: checklist che si spunta, budget a barre e timeline del giorno. Etichetta Premium sempre visibile.

- **Durata**: minima **6 s**, consigliata **7,5 s** (props d'esempio).
- **Come scala**: ultima voce tra spunte (1,0 s + 0,5 s a voce), barre e timeline (2,6 s + 0,35 s a punto) + 1,5 s; minimo 4 s.
- **Mockup**: sì, interfaccia ricreata in codice con dati fittizi (`mockup: true`, testi `source: mock`).
- **Cue audio**: tick.
- **Fotogramma di prova**: `out/_test/scenes/PlanningChecklist-9x16.png` e `PlanningChecklist-16x9.png` (t = 5.2 s).

| Prop | Tipo | Obbligatoria | Default | Descrizione |
|---|---|---|---|---|
| `headline` | testo (≤ 60 car.) | no | — | Titolo sopra le card (Playfair) |
| `items` | testo (≤ 30 car.)[] (3–5) | no | `["Scegliere la location","Prenotare il catering","Inviare il salva la…` | Voci della checklist (fittizie), spuntate in ordine |
| `budget` | { label: testo (≤ 16 car.); pct: numero 5–100 }[] (2–4) | no | `[{"label":"Location","pct":80},{"label":"Catering","pct":55},{"label"…` | Barre del budget: etichetta e riempimento in % (fittizi, senza importi) |
| `timeline` | { time?: testo (≤ 6 car.); label: testo (≤ 14 car.) }[] (3–5) | no | `[{"time":"16:00","label":"Cerimonia"},{"time":"17:30","label":"Aperit…` | Timeline del giorno (fittizia) |

Props d'esempio:

```json
{
  "headline": "Tutto il planning\nin un unico posto."
}
```

> Planning (checklist, budget, fornitori, timeline) è Premium: l'etichetta Premium è sempre mostrata.
> Voci, percentuali e orari sono fittizi (`source: mock`); il budget non mostra importi.

## PriceCard

Card dei prezzi (mensile e/o una tantum) letti da file. Senza elenco di funzioni: i file non dicono cosa includa ciascun piano.

- **Durata**: minima **4 s**, consigliata **6 s** (props d'esempio).
- **Come scala**: minimo 4 s: la seconda card entra a 0,8 s e resta ferma almeno 1,5 s.
- **Mockup**: no.
- **Cue audio**: nessuno.
- **Fotogramma di prova**: `out/_test/scenes/PriceCard-9x16.png` e `PriceCard-16x9.png` (t = 2.8 s).

| Prop | Tipo | Obbligatoria | Default | Descrizione |
|---|---|---|---|---|
| `eyebrow` | testo (≤ 30 car.) | no | — | Etichetta sopra la headline |
| `headline` | testo (≤ 60 car.) | no | — | Titolo sopra le card (Playfair) |
| `plans` | { kind: "mensile" \| "unaTantum"; label?: testo (≤ 20 car.); unit?: testo (≤ 30 car.) }[] (1–2) | no | `[{"kind":"mensile"},{"kind":"unaTantum"}]` | Card da mostrare. Etichetta e unità hanno un default; il prezzo viene sempre da file |
| `priceRef` | testo | no | `"brand/prezzi.json"` | File da cui sono letti i prezzi (content/commercial.ts se esiste, altrimenti brand/prezzi.json) |
| `prices` | { valuta: "EUR"; mensile: numero; unaTantum: numero; source: testo } | no | — | Compilato da `resolve` (non scriverlo a mano). Se manca il render mostra [PREZZO] |

Props d'esempio:

```json
{
  "eyebrow": "Prezzi",
  "plans": [
    {
      "kind": "mensile"
    },
    {
      "kind": "unaTantum"
    }
  ]
}
```

> I prezzi non sono mai nelle props scritte dal regista: `resolve` li legge da content/commercial.ts (se esiste) o da brand/prezzi.json (EUR 12 al mese, EUR 79 una tantum, confermati il 2026-11-13).
> Senza file leggibile la scena mostra [PREZZO] e il lint dello storyboard segnala E_PRICE_UNVERIFIED (solo bozza).
> Non dire cosa include ciascun piano e non scrivere "Premium" accanto ai prezzi: nei file non è detto.

## KineticList

Elenco animato: una voce alla volta con icona semplice, le precedenti si attenuano.

- **Durata**: minima **5,5 s**, consigliata **7,5 s** (props d'esempio).
- **Come scala**: minima 0,5 s + (voci − 1) × 1,4 s + 0,7 s + 1,5 s; consigliata con `step` (2 s di default) a voce.
- **Mockup**: no.
- **Cue audio**: tick.
- **Fotogramma di prova**: `out/_test/scenes/KineticList-9x16.png` e `KineticList-16x9.png` (t = 6.2 s).

| Prop | Tipo | Obbligatoria | Default | Descrizione |
|---|---|---|---|---|
| `eyebrow` | testo (≤ 30 car.) | no | — | Etichetta sopra il titolo |
| `title` | testo (≤ 60 car.) | no | — | Titolo sopra l'elenco (Playfair) |
| `items` | { icon: "check" \| "heart" \| "calendar" \| "gift" \| "users" \| "table" \| "list" \| "phone" \| "link" \| "clock" \| "mail"; text: testo (≤ 48 car.) }[] (2–5) | sì | — | Voci dell'elenco, mostrate una dopo l'altra |
| `step` | numero 1.4–4 | no | `2` | Secondi tra una voce e la successiva (si accorcia se lo shot è corto) |

Props d'esempio:

```json
{
  "eyebrow": "MatrimonioSemplice",
  "title": "Tutto in un posto",
  "items": [
    {
      "icon": "phone",
      "text": "Il sito, pronto in pochi minuti"
    },
    {
      "icon": "check",
      "text": "Conferme senza account"
    },
    {
      "icon": "gift",
      "text": "Lista nozze senza commissioni"
    }
  ]
}
```

> Massimo 5 voci da 8 parole. Ogni voce deve essere un claim di PRODOTTO_FATTI.
> Durata: circa 2 s a voce (consigliata), 1,4 s a voce al minimo; se lo shot è corto il passo si accorcia da solo.

## EndCard

Chiusura: logo, frase, un solo CTA a pillola (con tap simulato) e URL.

- **Durata**: minima **4 s**, consigliata **5 s** (props d'esempio).
- **Come scala**: minimo 4 s: la pillola entra entro 1,0 s e resta ferma almeno 3 s (BRAND_VIDEO §6).
- **Mockup**: no.
- **Cue audio**: press.
- **Fotogramma di prova**: `out/_test/scenes/EndCard-9x16.png` e `EndCard-16x9.png` (t = 3.2 s).

| Prop | Tipo | Obbligatoria | Default | Descrizione |
|---|---|---|---|---|
| `tagline` | testo (≤ 50 car.) | no | — | Frase di chiusura in Playfair corsivo. `*parola*` = corsivo, `\n` = a capo |
| `cta` | testo (≤ 40 car.) | no | `"Crea il tuo sito matrimonio"` | Testo della pillola CTA (copy ufficiale, decisione 6) |
| `url` | testo (≤ 60 car.) | no | `"www.matrimoniosemplice.com"` | URL sotto la pillola (ufficiale, decisione 6) |
| `wordmark` | sì/no | no | `true` | Mostra il nome MatrimonioSemplice sotto il logo |
| `press` | sì/no | no | `true` | Simula il tap sulla pillola (onda blush) |

Props d'esempio:

```json
{
  "tagline": "Dal caos\nall'*RSVP.*"
}
```

> Un solo CTA per end card. Il testo del CTA deve coincidere con `brief.cta.label`.
> Il logo è assets/logo/icon.svg (solo icona): il nome è reso come testo Playfair.
